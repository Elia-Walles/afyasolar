import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarClientServices,
  afyaSolarServiceStatusHistory,
  afyaSolarMeterCommands
} from '@/lib/db/afya-solar-schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/afya-solar/automation/reactivate
 * Reactivate services when payments are cleared
 * This endpoint is typically called by payment processing system
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { serviceIds, paymentReference } = body

    if (!serviceIds || !Array.isArray(serviceIds)) {
      return NextResponse.json({ error: 'serviceIds array is required' }, { status: 400 })
    }

    const results = {
      reactivated: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    for (const serviceId of serviceIds) {
      try {
        // Check if service is suspended due to overdue
        const [service] = await db
          .select({
            id: afyaSolarClientServices.id,
            status: afyaSolarClientServices.status,
            smartmeterId: afyaSolarClientServices.smartmeterId,
            siteName: afyaSolarClientServices.siteName
          })
          .from(afyaSolarClientServices)
          .where(and(
            eq(afyaSolarClientServices.id, serviceId),
            eq(afyaSolarClientServices.status, 'SUSPENDED_OVERDUE')
          ))
          .limit(1)

        if (!service) {
          results.errors.push(`Service ${serviceId}: Not found or not suspended due to overdue`)
          continue
        }

        // Reactivate service
        await db.transaction(async (tx) => {
          // Update service status
          await tx
            .update(afyaSolarClientServices)
            .set({
              status: 'ACTIVE',
              updatedAt: new Date()
            })
            .where(eq(afyaSolarClientServices.id, serviceId))

          // Create status history entry
          await tx.insert(afyaSolarServiceStatusHistory).values({
            clientServiceId: serviceId,
            oldStatus: 'SUSPENDED_OVERDUE',
            newStatus: 'ACTIVE',
            reasonCode: 'PAYMENT_CLEARED',
            reasonText: `Service reactivated. Payment reference: ${paymentReference}`,
            changedByUserId: 'system'
          })

          // Create meter enable command if smartmeter is linked
          if (service.smartmeterId) {
            await tx.insert(afyaSolarMeterCommands).values({
              smartmeterId: service.smartmeterId,
              clientServiceId: serviceId,
              commandType: 'ENABLE',
              requestedByUserId: 'system',
              requestedReasonCode: 'ADMIN_OVERRIDE',
              requestedReasonText: `Service reactivated after payment clearance. Reference: ${paymentReference}`,
              status: 'QUEUED'
            })
          }
        })

        results.reactivated++
        results.details.push({
          serviceId,
          siteName: service.siteName,
          action: 'REACTIVATED',
          paymentReference,
          smartmeterCommand: service.smartmeterId ? 'ENABLE command queued' : 'No smartmeter linked'
        })

      } catch (error) {
        console.error(`Error reactivating service ${serviceId}:`, error)
        results.errors.push(`Service ${serviceId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    console.log(`✅ Reactivation completed: ${results.reactivated} services reactivated`)

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('Error in service reactivation automation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
