import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarSmartmeters,
  afyaSolarMeterCommands,
  afyaSolarClientServices
} from '@/lib/db/afya-solar-schema'
import { eq, and, desc, or, like } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schemas
const createSmartmeterSchema = z.object({
  meterSerial: z.string().min(1).max(80),
  vendor: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
  siteAddress: z.string().optional()
})

/**
 * GET /api/afya-solar/smartmeters
 * Fetch all smart meters with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const vendor = searchParams.get('vendor')
    const status = searchParams.get('status') // 'active' | 'inactive'
    const search = searchParams.get('search')

    // Build query conditions
    const conditions = []
    if (vendor) {
      conditions.push(eq(afyaSolarSmartmeters.vendor, vendor))
    }
    if (search) {
      conditions.push(or(
        like(afyaSolarSmartmeters.meterSerial, `%${search}%`),
        like(afyaSolarSmartmeters.siteAddress, `%${search}%`)
      ))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    const smartmeters = await db
      .select({
        id: afyaSolarSmartmeters.id,
        meterSerial: afyaSolarSmartmeters.meterSerial,
        vendor: afyaSolarSmartmeters.vendor,
        apiEndpoint: afyaSolarSmartmeters.apiEndpoint,
        siteAddress: afyaSolarSmartmeters.siteAddress,
        installedAt: afyaSolarSmartmeters.installedAt,
        lastSeenAt: afyaSolarSmartmeters.lastSeenAt,
        createdAt: afyaSolarSmartmeters.createdAt,
        updatedAt: afyaSolarSmartmeters.updatedAt,
        // Service info if linked
        serviceId: afyaSolarClientServices.id,
        serviceFacilityId: afyaSolarClientServices.facilityId,
        serviceStatus: afyaSolarClientServices.status,
        serviceSiteName: afyaSolarClientServices.siteName
      })
      .from(afyaSolarSmartmeters)
      .leftJoin(afyaSolarClientServices, eq(afyaSolarSmartmeters.id, afyaSolarClientServices.smartmeterId))
      .where(whereCondition)
      .orderBy(desc(afyaSolarSmartmeters.createdAt))

    // Transform flat response into nested structure
    const transformedSmartmeters = smartmeters.map(meter => ({
      ...meter,
      service: meter.serviceId ? {
        id: meter.serviceId,
        facilityId: meter.serviceFacilityId,
        status: meter.serviceStatus,
        siteName: meter.serviceSiteName
      } : null,
      // Remove flat fields
      serviceId: undefined,
      serviceFacilityId: undefined,
      serviceStatus: undefined,
      serviceSiteName: undefined
    }))

    return NextResponse.json({
      success: true,
      data: transformedSmartmeters
    })

  } catch (error) {
    console.error('Error fetching smart meters:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/afya-solar/smartmeters
 * Register a new smart meter
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createSmartmeterSchema.parse(body)

    // Check if meter serial already exists
    const [existingMeter] = await db
      .select()
      .from(afyaSolarSmartmeters)
      .where(eq(afyaSolarSmartmeters.meterSerial, validated.meterSerial))
      .limit(1)

    if (existingMeter) {
      return NextResponse.json({ error: 'Meter serial already exists' }, { status: 409 })
    }

    // Create smart meter
    const [meterResult] = await db.insert(afyaSolarSmartmeters).values({
      meterSerial: validated.meterSerial,
      vendor: validated.vendor,
      apiEndpoint: validated.apiEndpoint,
      siteAddress: validated.siteAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Smart meter registered successfully',
      data: {
        id: meterResult.insertId
      }
    })

  } catch (error) {
    console.error('Error creating smart meter:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/afya-solar/smartmeters
 * Update smart meter information
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, vendor, apiEndpoint, siteAddress, installedAt, lastSeenAt } = body

    if (!id) {
      return NextResponse.json({ error: 'Smart meter ID is required' }, { status: 400 })
    }

    // Build update data
    const updateData: any = {}
    if (vendor !== undefined) updateData.vendor = vendor
    if (apiEndpoint !== undefined) updateData.apiEndpoint = apiEndpoint
    if (siteAddress !== undefined) updateData.siteAddress = siteAddress
    if (installedAt !== undefined) updateData.installedAt = new Date(installedAt)
    if (lastSeenAt !== undefined) updateData.lastSeenAt = new Date(lastSeenAt)
    updateData.updatedAt = new Date()

    // Update smart meter
    await db
      .update(afyaSolarSmartmeters)
      .set(updateData)
      .where(eq(afyaSolarSmartmeters.id, id))

    return NextResponse.json({
      success: true,
      message: 'Smart meter updated successfully'
    })

  } catch (error) {
    console.error('Error updating smart meter:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
