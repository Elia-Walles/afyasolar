import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { helpRequests, facilities } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { sendHelpRequestEmail } from '@/lib/email'

const helpRequestSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(20).optional(),
  subject: z.string().min(1).max(255),
  message: z.string().min(1),
})

/**
 * GET /api/help-requests
 * Get help requests (admin can see all, users can see their own)
 */
const helpRequestSelect = {
  id: helpRequests.id,
  facilityId: helpRequests.facilityId,
  userId: helpRequests.userId,
  name: helpRequests.name,
  email: helpRequests.email,
  phone: helpRequests.phone,
  subject: helpRequests.subject,
  message: helpRequests.message,
  status: helpRequests.status,
  adminNotes: helpRequests.adminNotes,
  createdAt: helpRequests.createdAt,
  updatedAt: helpRequests.updatedAt,
  facilityName: facilities.name,
  facilityCity: facilities.city,
  facilityRegion: facilities.region,
  facilityPaymentModel: facilities.paymentModel,
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const facilityId = searchParams.get('facilityId')

    const conditions: any[] = []

    // Admin can see all, others see only their own
    if (session.user.role !== 'admin') {
      conditions.push(eq(helpRequests.facilityId, session.user.facilityId || ''))
    } else {
      // Admin filters
      if (facilityId) {
        conditions.push(eq(helpRequests.facilityId, facilityId))
      }
    }

    // Status filter
    if (status) {
      conditions.push(eq(helpRequests.status, status))
    }

    // Build query with conditions
    let query = db
      .select(helpRequestSelect)
      .from(helpRequests)
      .leftJoin(facilities, eq(helpRequests.facilityId, facilities.id))

    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)
      query = query.where(whereClause) as typeof query
    }

    const requests = await query.orderBy(desc(helpRequests.createdAt))

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error('Error fetching help requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/help-requests
 * Create a new help request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const body = await request.json()
    const validatedData = helpRequestSchema.parse(body)

    const requestId = randomUUID()
    const facilityId = session?.user?.facilityId || null
    const userId = session?.user?.id || null

    await db.insert(helpRequests).values({
      id: requestId,
      facilityId: facilityId,
      userId: userId,
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone || null,
      subject: validatedData.subject,
      message: validatedData.message,
      status: 'pending',
    })

    // Fetch facility name if facilityId exists
    let facilityName: string | null = null
    if (facilityId) {
      try {
        const [facility] = await db
          .select({ name: facilities.name })
          .from(facilities)
          .where(eq(facilities.id, facilityId))
          .limit(1)
        facilityName = facility?.name || null
      } catch (error) {
        console.error('Error fetching facility name:', error)
        // Continue without facility name
      }
    }

    // Send email notification to admin
    try {
      await sendHelpRequestEmail({
        fromEmail: validatedData.email,
        fromName: validatedData.name,
        subject: validatedData.subject,
        message: validatedData.message,
        phone: validatedData.phone,
        facilityId: facilityId,
        facilityName: facilityName,
      })
    } catch (emailError) {
      console.error('Error sending help request email:', emailError)
      // Don't fail the request if email fails
    }

    // Fetch the created request
    const [newRequest] = await db
      .select(helpRequestSelect)
      .from(helpRequests)
      .leftJoin(facilities, eq(helpRequests.facilityId, facilities.id))
      .where(eq(helpRequests.id, requestId))
      .limit(1)

    if (!newRequest) {
      throw new Error('Failed to retrieve created help request')
    }

    return NextResponse.json({ success: true, data: newRequest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating help request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

