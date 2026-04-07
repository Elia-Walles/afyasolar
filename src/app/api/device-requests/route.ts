import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceRequests } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { sendDeviceRequestEmail } from '@/lib/email'
import { notificationCreators } from '@/lib/notifications/event-notifications'

const deviceRequestSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(1).max(20),
  facilityName: z.string().max(255).optional(),
  deviceType: z.string().max(50).optional(),
  quantity: z.number().int().min(1).default(1),
  message: z.string().optional(),
})

/**
 * GET /api/device-requests
 * Get device requests (admin can see all, users can see their own)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const facilityId = searchParams.get('facilityId')

    // Build conditions array
    const conditions = []

    // Admin can see all, others see only their own
    if (session.user.role !== 'admin') {
      conditions.push(eq(deviceRequests.facilityId, session.user.facilityId || ''))
    } else {
      // Admin filters
      if (facilityId) {
        conditions.push(eq(deviceRequests.facilityId, facilityId))
      }
    }

    // Status filter
    if (status) {
      conditions.push(eq(deviceRequests.status, status))
    }

    // Build query with conditions
    let query = db.select().from(deviceRequests)
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const requests = await query.orderBy(desc(deviceRequests.createdAt))

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error('Error fetching device requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/device-requests
 * Create a new device request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const body = await request.json()
    const validatedData = deviceRequestSchema.parse(body)

    const requestId = randomUUID()

    await db.insert(deviceRequests).values({
      id: requestId,
      facilityId: session?.user.facilityId || null,
      userId: session?.user.id || null,
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone,
      facilityName: validatedData.facilityName || null,
      deviceType: validatedData.deviceType || null,
      quantity: validatedData.quantity,
      message: validatedData.message || null,
      status: 'pending',
    })

    // Trigger admin notification for new device request
    try {
      await notificationCreators.deviceRequestCreated({
        requestId: requestId,
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        facilityName: validatedData.facilityName || undefined,
        deviceType: validatedData.deviceType || undefined,
        quantity: validatedData.quantity,
        message: validatedData.message || undefined,
        facilityId: session?.user.facilityId || undefined,
      })
    } catch (notificationError) {
      console.error('Failed to create device request notification:', notificationError)
      // Don't fail the device request if notification fails
    }

    // Send email notification to admin
    try {
      await sendDeviceRequestEmail({
        fromEmail: validatedData.email,
        fromName: validatedData.name,
        phone: validatedData.phone,
        facilityName: validatedData.facilityName || 'N/A',
        deviceType: validatedData.deviceType || 'Not specified',
        quantity: validatedData.quantity,
        message: validatedData.message,
        facilityId: session?.user.facilityId || null,
      })
    } catch (emailError) {
      console.error('Error sending device request email:', emailError)
      // Don't fail the request if email fails
    }

    // Fetch the created request
    const [newRequest] = await db
      .select()
      .from(deviceRequests)
      .where(eq(deviceRequests.id, requestId))
      .limit(1)

    if (!newRequest) {
      throw new Error('Failed to retrieve created device request')
    }

    return NextResponse.json({ success: true, data: newRequest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating device request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/device-requests
 * Update device request status (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, status, adminNotes } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 })
    }

    const updateData: any = { status }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes
    }

    await db
      .update(deviceRequests)
      .set(updateData)
      .where(eq(deviceRequests.id, id))

    const [updatedRequest] = await db
      .select()
      .from(deviceRequests)
      .where(eq(deviceRequests.id, id))
      .limit(1)

    return NextResponse.json({ success: true, data: updatedRequest })
  } catch (error) {
    console.error('Error updating device request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

