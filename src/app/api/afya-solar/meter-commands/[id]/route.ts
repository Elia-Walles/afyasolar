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

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/afya-solar/meter-commands/[id]
 * Fetch a specific meter command with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const commandId = parseInt(params.id)
    if (isNaN(commandId)) {
      return NextResponse.json({ error: 'Invalid command ID' }, { status: 400 })
    }

    const [command] = await db
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
          apiEndpoint: afyaSolarSmartmeters.apiEndpoint,
          siteAddress: afyaSolarSmartmeters.siteAddress,
          installedAt: afyaSolarSmartmeters.installedAt,
          lastSeenAt: afyaSolarSmartmeters.lastSeenAt
        },
        service: {
          id: afyaSolarClientServices.id,
          facilityId: afyaSolarClientServices.facilityId,
          status: afyaSolarClientServices.status,
          siteName: afyaSolarClientServices.siteName,
          serviceLocation: afyaSolarClientServices.serviceLocation
        }
      })
      .from(afyaSolarMeterCommands)
      .leftJoin(afyaSolarSmartmeters, eq(afyaSolarMeterCommands.smartmeterId, afyaSolarSmartmeters.id))
      .leftJoin(afyaSolarClientServices, eq(afyaSolarMeterCommands.clientServiceId, afyaSolarClientServices.id))
      .where(eq(afyaSolarMeterCommands.id, commandId))
      .limit(1)

    if (!command) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: command
    })

  } catch (error) {
    console.error('Error fetching meter command:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/afya-solar/meter-commands/[id]
 * Cancel a queued meter command
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const commandId = parseInt(params.id)
    if (isNaN(commandId)) {
      return NextResponse.json({ error: 'Invalid command ID' }, { status: 400 })
    }

    // Check if command exists and can be cancelled
    const [command] = await db
      .select()
      .from(afyaSolarMeterCommands)
      .where(eq(afyaSolarMeterCommands.id, commandId))
      .limit(1)

    if (!command) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 })
    }

    if (command.status !== 'QUEUED') {
      return NextResponse.json({ 
        error: 'Cannot cancel command that is already processed' 
      }, { status: 400 })
    }

    // Delete the command
    await db
      .delete(afyaSolarMeterCommands)
      .where(eq(afyaSolarMeterCommands.id, commandId))

    return NextResponse.json({
      success: true,
      message: 'Command cancelled successfully'
    })

  } catch (error) {
    console.error('Error cancelling meter command:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
