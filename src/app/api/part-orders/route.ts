import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { partOrders, spareParts } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { resolveTechnicianId } from '@/lib/auth/technician'

const createSchema = z.object({
  partId: z.string().uuid(),
  maintenanceRequestId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  neededBy: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const filters = []
    const technicianProfileId = session.user.role === 'technician' 
      ? await resolveTechnicianId(session.user)
      : null

    if (session.user.role === 'technician') {
      if (!technicianProfileId) {
        return NextResponse.json({ error: 'Technician profile not found' }, { status: 404 })
      }
      filters.push(eq(partOrders.requestedById, technicianProfileId))
    }
    if (status) {
      filters.push(eq(partOrders.status, status as any))
    }

    const orders = await db
      .select({
        order: partOrders,
        part: spareParts,
      })
      .from(partOrders)
      .leftJoin(spareParts, eq(partOrders.partId, spareParts.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(partOrders.createdAt))
      .limit(200)

    return NextResponse.json({ success: true, data: orders })
  } catch (error) {
    console.error('Error fetching part orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'technician' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const parsed = createSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const id = randomUUID()
    const technicianProfileId = session.user.role === 'technician'
      ? await resolveTechnicianId(session.user)
      : null
    if (session.user.role === 'technician' && !technicianProfileId) {
      return NextResponse.json({ error: 'Technician profile not found' }, { status: 404 })
    }
    await db.insert(partOrders).values({
      id,
      partId: parsed.data.partId,
      requestedById: session.user.role === 'admin' ? session.user.id : technicianProfileId!,
      requestedByType: session.user.role === 'admin' ? 'admin' : 'technician',
      maintenanceRequestId: parsed.data.maintenanceRequestId ?? null,
      quantity: parsed.data.quantity,
      priority: parsed.data.priority ?? 'medium',
      status: session.user.role === 'admin' ? 'approved' : 'pending_approval',
      neededBy: parsed.data.neededBy ? new Date(parsed.data.neededBy) : null,
      notes: parsed.data.notes ?? null,
    })

    return NextResponse.json({ success: true, data: { id } }, { status: 201 })
  } catch (error) {
    console.error('Error creating part order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

