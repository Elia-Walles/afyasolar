import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarMeterCommands,
  afyaSolarSmartmeters,
  afyaSolarClientServices
} from '@/lib/db/afya-solar-schema'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schema
const createCommandSchema = z.object({
  smartmeterId: z.number().positive(),
  clientServiceId: z.number().positive(),
  commandType: z.enum(['DISABLE', 'ENABLE']),
  reasonCode: z.enum(['OVERDUE', 'ADMIN_OVERRIDE', 'PLAN_CHANGE']),
  reasonText: z.string().optional()
})

/**
 * GET /api/afya-solar/meter-commands
 * Fetch meter commands with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'QUEUED', 'SENT', 'ACKED', 'FAILED'
    const commandType = searchParams.get('commandType') // 'ENABLE', 'DISABLE'
    const smartmeterId = searchParams.get('smartmeterId')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    // Build query conditions
    const conditions = []
    if (status) {
      conditions.push(eq(afyaSolarMeterCommands.status, status))
    }
    if (commandType) {
      conditions.push(eq(afyaSolarMeterCommands.commandType, commandType))
    }
    if (smartmeterId) {
      conditions.push(eq(afyaSolarMeterCommands.smartmeterId, parseInt(smartmeterId)))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    const commands = await db
      .select({
        id: afyaSolarMeterCommands.id,
        smartmeterId: afyaSolarMeterCommands.smartmeterId,
        clientServiceId: afyaSolarMeterCommands.clientServiceId,
        commandType: afyaSolarMeterCommands.commandType,
        requestedByUserId: afyaSolarMeterCommands.requestedByUserId,
        requestedReasonCode: afyaSolarMeterCommands.requestedReasonCode,
        requestedReasonText: afyaSolarMeterCommands.requestedReasonText,
        status: afyaSolarMeterCommands.status,
        vendorRequestId: afyaSolarMeterCommands.vendorRequestId,
        sentAt: afyaSolarMeterCommands.sentAt,
        ackedAt: afyaSolarMeterCommands.ackedAt,
        errorMessage: afyaSolarMeterCommands.errorMessage,
        createdAt: afyaSolarMeterCommands.createdAt,
        // Related info
        smartmeter: {
          id: afyaSolarSmartmeters.id,
          meterSerial: afyaSolarSmartmeters.meterSerial,
          vendor: afyaSolarSmartmeters.vendor,
          siteAddress: afyaSolarSmartmeters.siteAddress
        },
        service: {
          id: afyaSolarClientServices.id,
          facilityId: afyaSolarClientServices.facilityId,
          status: afyaSolarClientServices.status,
          siteName: afyaSolarClientServices.siteName
        }
      })
      .from(afyaSolarMeterCommands)
      .leftJoin(afyaSolarSmartmeters, eq(afyaSolarMeterCommands.smartmeterId, afyaSolarSmartmeters.id))
      .leftJoin(afyaSolarClientServices, eq(afyaSolarMeterCommands.clientServiceId, afyaSolarClientServices.id))
      .where(whereCondition)
      .orderBy(desc(afyaSolarMeterCommands.createdAt))
      .limit(limit || 50)

    return NextResponse.json({
      success: true,
      data: commands
    })

  } catch (error) {
    console.error('Error fetching meter commands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/afya-solar/meter-commands
 * Create a new meter command
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createCommandSchema.parse(body)

    // Verify smart meter exists
    const [smartmeter] = await db
      .select()
      .from(afyaSolarSmartmeters)
      .where(eq(afyaSolarSmartmeters.id, validated.smartmeterId))
      .limit(1)

    if (!smartmeter) {
      return NextResponse.json({ error: 'Smart meter not found' }, { status: 404 })
    }

    // Verify client service exists
    const [service] = await db
      .select()
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.id, validated.clientServiceId))
      .limit(1)

    if (!service) {
      return NextResponse.json({ error: 'Client service not found' }, { status: 404 })
    }

    // Create meter command
    const [commandResult] = await db.insert(afyaSolarMeterCommands).values({
      smartmeterId: validated.smartmeterId,
      clientServiceId: validated.clientServiceId,
      commandType: validated.commandType,
      requestedByUserId: session.user.id,
      requestedReasonCode: validated.reasonCode,
      requestedReasonText: validated.reasonText,
      status: 'QUEUED'
    })

    return NextResponse.json({
      success: true,
      message: 'Meter command created successfully',
      data: {
        id: commandResult.insertId
      }
    })

  } catch (error) {
    console.error('Error creating meter command:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
