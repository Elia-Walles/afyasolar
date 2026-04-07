import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceJobs } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { serviceJobSchema } from '@/lib/validations'
import { resolveTechnicianId } from '@/lib/auth/technician'

/**
 * GET /api/service-jobs
 * Get service jobs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId')
    const technicianId = searchParams.get('technicianId')
    const status = searchParams.get('status')

    let query = db.select().from(serviceJobs)

    // Build where conditions
    const conditions = []

    if (facilityId) {
      conditions.push(eq(serviceJobs.facilityId, facilityId))
    }

    if (technicianId) {
      conditions.push(eq(serviceJobs.technicianId, technicianId))
    }

    if (status) {
      conditions.push(eq(serviceJobs.status, status))
    }

    // Check access
    if (session.user.role === 'facility') {
      // Facility users can only see their own facility's jobs
      if (facilityId && session.user.facilityId !== facilityId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!facilityId && session.user.facilityId) {
        conditions.push(eq(serviceJobs.facilityId, session.user.facilityId))
      }
    } else if (session.user.role === 'technician') {
      // Technicians can only see their own jobs
      const sessionTechnicianId = await resolveTechnicianId(session.user)
      if (!sessionTechnicianId) {
        return NextResponse.json({ error: 'Technician profile not found' }, { status: 404 })
      }
      if (technicianId && sessionTechnicianId !== technicianId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!technicianId) {
        conditions.push(eq(serviceJobs.technicianId, sessionTechnicianId))
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const jobs = await query.orderBy(desc(serviceJobs.createdAt))

    return NextResponse.json({ success: true, data: jobs })
  } catch (error) {
    console.error('Error fetching service jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/service-jobs
 * Create a new service job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = serviceJobSchema.parse(body)

    // Check access
    if (session.user.role === 'facility' && session.user.facilityId !== validatedData.facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Generate ID first (MySQL doesn't support RETURNING clause)
    const jobId = crypto.randomUUID()
    
    await db
      .insert(serviceJobs)
      .values({
        id: jobId,
        ...validatedData,
        scheduledDate: validatedData.scheduledDate ? new Date(validatedData.scheduledDate) : null,
      })

    // Fetch the created job (MySQL doesn't support RETURNING clause)
    const [newJob] = await db
      .select()
      .from(serviceJobs)
      .where(eq(serviceJobs.id, jobId))
      .limit(1)

    if (!newJob) {
      throw new Error('Failed to retrieve created service job')
    }

    return NextResponse.json({ success: true, data: newJob }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error creating service job:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

