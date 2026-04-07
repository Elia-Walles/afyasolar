import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { facilities, visits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const visitSchema = z.object({
  slug: z.string().min(1),
  action: z.enum(['start', 'selected_department', 'selected_doctor', 'selected_slot', 'confirmed']),
  visitType: z.enum(['standalone', 'widget']).default('standalone'),
  sessionId: z.string().uuid().optional(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = visitSchema.parse(body)

    const [facility] = await db
      .select({
        id: facilities.id,
      })
      .from(facilities)
      .where(eq(facilities.bookingSlug, payload.slug))
      .limit(1)

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    if (payload.action === 'start') {
      const sessionId = randomUUID()
      await db.insert(visits).values({
        id: randomUUID(),
        facilityId: facility.id,
        visitType: payload.visitType,
        referrer: payload.referrer?.slice(0, 500) || null,
        userAgent: payload.userAgent?.slice(0, 500) || null,
        ipAddress: payload.ipAddress?.slice(0, 100) || null,
        sessionId,
        selectedDepartment: false,
        selectedDoctor: false,
        selectedTimeSlot: false,
        confirmedBooking: false,
      } as any)

      return NextResponse.json({ success: true, sessionId })
    }

    if (!payload.sessionId) {
      return NextResponse.json({ error: 'Session ID required for updates' }, { status: 400 })
    }

    const updates: Record<string, any> = {}

    if (payload.action === 'selected_department') {
      updates.selectedDepartment = true
    } else if (payload.action === 'selected_doctor') {
      updates.selectedDoctor = true
    } else if (payload.action === 'selected_slot') {
      updates.selectedTimeSlot = true
    } else if (payload.action === 'confirmed') {
      updates.confirmedBooking = true
    }

    await db
      .update(visits)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(visits.sessionId, payload.sessionId))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    console.error('Visit tracking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

