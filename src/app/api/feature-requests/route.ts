import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { featureRequests, facilities } from '@/lib/db/schema'
import { randomUUID } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { sendFeatureRequestEmail } from '@/lib/email'
import { notificationCreators } from '@/lib/notifications/event-notifications'

const createFeatureRequestSchema = z.object({
  serviceName: z.enum(['afya-solar']),
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title must be less than 255 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID not found' }, { status: 400 })
    }

    const body = await request.json()
    const { serviceName, title, description, priority } = createFeatureRequestSchema.parse(body)

    const requestId = randomUUID()

    await db.insert(featureRequests).values({
      id: requestId,
      facilityId,
      serviceName,
      title,
      description,
      priority: priority || 'medium',
      status: 'pending',
      adminNotes: null,
    })

    // Get facility details for notification
    const [facility] = await db
      .select({
        name: facilities.name,
        email: facilities.email,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    // Trigger admin notification for new feature request
    try {
      await notificationCreators.featureRequestCreated({
        requestNumber: requestId,
        facilityName: facility?.name || 'Unknown Facility',
        facilityId: facilityId,
        facilityEmail: facility?.email || '',
        serviceName: serviceName,
        title: title,
        description: description,
        priority: priority || 'medium',
      })
    } catch (notificationError) {
      console.error('Failed to create feature request notification:', notificationError)
      // Don't fail the request if notification fails
    }

    // Send email notification to admin
    if (facility) {
      try {
        await sendFeatureRequestEmail({
          facilityName: facility.name,
          facilityEmail: facility.email || session.user.email || 'unknown@example.com',
          serviceName,
          title,
          description,
          priority: priority || 'medium',
          requestId,
        })
      } catch (emailError) {
        console.error('Failed to send feature request email:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Feature request submitted successfully',
        requestId,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating feature request:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit feature request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const serviceName = searchParams.get('serviceName')
    const status = searchParams.get('status')

    // Facilities can only see their own requests
    if (session.user.role === 'facility') {
      const facilityId = session.user.facilityId
      if (!facilityId) {
        return NextResponse.json({ error: 'Facility ID not found' }, { status: 400 })
      }

      // For facilities, filter by facilityId and optionally by serviceName
      const conditions = [eq(featureRequests.facilityId, facilityId)]
      if (serviceName) {
        conditions.push(eq(featureRequests.serviceName, serviceName as any))
      }

      const requests = await db
        .select()
        .from(featureRequests)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])

      return NextResponse.json({ requests }, { status: 200 })
    }

    // Admins can see all requests with facility details
    if (session.user.role === 'admin') {
      // Build conditions array
      const conditions = []
      if (serviceName) {
        conditions.push(eq(featureRequests.serviceName, serviceName as any))
      }
      if (status) {
        conditions.push(eq(featureRequests.status, status))
      }

      // Build query with conditional where clause
      const results = await db
        .select({
          id: featureRequests.id,
          facilityId: featureRequests.facilityId,
          serviceName: featureRequests.serviceName,
          title: featureRequests.title,
          description: featureRequests.description,
          priority: featureRequests.priority,
          status: featureRequests.status,
          adminNotes: featureRequests.adminNotes,
          createdAt: featureRequests.createdAt,
          updatedAt: featureRequests.updatedAt,
          facilityName: facilities.name,
          facilityEmail: facilities.email,
        })
        .from(featureRequests)
        .leftJoin(facilities, eq(featureRequests.facilityId, facilities.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      // Transform to include facility object
      const requests = results.map((r) => ({
        id: r.id,
        facilityId: r.facilityId,
        serviceName: r.serviceName,
        title: r.title,
        description: r.description,
        priority: r.priority,
        status: r.status,
        adminNotes: r.adminNotes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        facility: r.facilityName
          ? {
              id: r.facilityId,
              name: r.facilityName,
              email: r.facilityEmail || '',
            }
          : undefined,
      }))

      return NextResponse.json({ requests }, { status: 200 })
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  } catch (error: any) {
    console.error('Error fetching feature requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature requests' },
      { status: 500 }
    )
  }
}
