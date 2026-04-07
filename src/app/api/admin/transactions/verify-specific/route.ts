import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, serviceAccessPayments } from '@/lib/db/schema'
import { eq, sql, or } from 'drizzle-orm'
import { updateTransactionStatus } from '@/lib/payments/transaction-service'
import { createAzamPayService } from '@/lib/payments/azam-pay'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/transactions/verify-specific
 * Verify specific transactions by Azam transaction IDs (Admin only)
 * 
 * Body: {
 *   azamTransactionIds: ["3979949617", "3980028639", ...]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { azamTransactionIds } = body

    if (!azamTransactionIds || !Array.isArray(azamTransactionIds) || azamTransactionIds.length === 0) {
      return NextResponse.json(
        { error: 'azamTransactionIds array is required' },
        { status: 400 }
      )
    }

    console.log(`[Verify Specific] Verifying ${azamTransactionIds.length} transactions`)

    const results: Array<{
      azamTransactionId: string
      found: boolean
      verified: boolean
      previousStatus?: string
      newStatus?: string
      message: string
    }> = []

    const azamPay = createAzamPayService()

    for (const azamId of azamTransactionIds) {
      try {
        // Find transaction by Azam transaction ID
        const [transaction] = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.azamTransactionId, String(azamId)))
          .limit(1)

        if (!transaction) {
          results.push({
            azamTransactionId: String(azamId),
            found: false,
            verified: false,
            message: 'Transaction not found in database',
          })
          continue
        }

        console.log(`[Verify Specific] Found transaction ${transaction.id} for Azam ID ${azamId}, current status: ${transaction.status}`)

        // Verify with Azam Pay
        const verificationResult = await azamPay.verifyPayment(String(azamId))
        const verificationData = verificationResult.data || verificationResult
        const azamStatus = verificationData.status || verificationData.transactionStatus || verificationData.transactionstatus
        const statusLower = (azamStatus || '').toLowerCase().trim()

        console.log(`[Verify Specific] Azam Pay status for ${azamId}: ${azamStatus}`)

        if (statusLower === 'success' || statusLower === 'completed' || statusLower === 'successful' || statusLower === 'paid') {
          // Payment is completed
          if (transaction.status !== 'completed') {
            console.log(`[Verify Specific] Updating transaction ${transaction.id} from ${transaction.status} to completed`)

            await updateTransactionStatus({
              transactionId: transaction.id,
              status: 'completed',
              statusMessage: `Payment verified via admin verification: ${verificationData.message || azamStatus || 'Status updated'}`,
              changedBy: `admin:${session.user.id}`,
              responsePayload: verificationResult,
            })

            // Update service access payment
            await db
              .update(serviceAccessPayments)
              .set({
                status: 'completed',
                paidAt: sql`CURRENT_TIMESTAMP`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
              })
              .where(eq(serviceAccessPayments.transactionId, transaction.externalId))

            results.push({
              azamTransactionId: String(azamId),
              found: true,
              verified: true,
              previousStatus: transaction.status,
              newStatus: 'completed',
              message: `Successfully updated from ${transaction.status} to completed`,
            })
          } else {
            results.push({
              azamTransactionId: String(azamId),
              found: true,
              verified: true,
              previousStatus: 'completed',
              newStatus: 'completed',
              message: 'Already marked as completed',
            })
          }
        } else {
          results.push({
            azamTransactionId: String(azamId),
            found: true,
            verified: false,
            previousStatus: transaction.status,
            message: `Azam Pay status is: ${azamStatus || 'unknown'} (not completed)`,
          })
        }
      } catch (error: any) {
        console.error(`[Verify Specific] Error verifying ${azamId}:`, error)
        results.push({
          azamTransactionId: String(azamId),
          found: false,
          verified: false,
          message: `Error: ${error.message || 'Unknown error'}`,
        })
      }
    }

    const verifiedCount = results.filter(r => r.verified).length
    const updatedCount = results.filter(r => r.verified && r.previousStatus !== 'completed').length

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} transactions. ${verifiedCount} verified, ${updatedCount} updated to completed.`,
      results,
      summary: {
        total: results.length,
        found: results.filter(r => r.found).length,
        verified: verifiedCount,
        updated: updatedCount,
      },
    })
  } catch (error) {
    console.error('[Verify Specific] Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

