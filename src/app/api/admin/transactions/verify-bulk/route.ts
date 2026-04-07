import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, serviceAccessPayments } from '@/lib/db/schema'
import { eq, sql, or, and, inArray } from 'drizzle-orm'
import { updateTransactionStatus } from '@/lib/payments/transaction-service'
import { createAzamPayService } from '@/lib/payments/azam-pay'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/transactions/verify-bulk
 * Verify multiple transactions by Azam transaction IDs or reference numbers (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { azamTransactionIds, referenceNumbers } = body

    if (!azamTransactionIds && !referenceNumbers) {
      return NextResponse.json(
        { error: 'azamTransactionIds or referenceNumbers required' },
        { status: 400 }
      )
    }

    const results: Array<{
      identifier: string
      found: boolean
      verified: boolean
      status?: string
      message: string
    }> = []

    const azamPay = createAzamPayService()

    // Process Azam transaction IDs
    if (azamTransactionIds && Array.isArray(azamTransactionIds)) {
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
              identifier: `Azam ID: ${azamId}`,
              found: false,
              verified: false,
              message: 'Transaction not found in database',
            })
            continue
          }

          // Verify with Azam Pay
          try {
            const verificationResult = await azamPay.verifyPayment(String(azamId))
            const verificationData = verificationResult.data || verificationResult
            const azamStatus = verificationData.status || verificationData.transactionStatus || verificationData.transactionstatus
            const statusLower = (azamStatus || '').toLowerCase().trim()

            if (statusLower === 'success' || statusLower === 'completed' || statusLower === 'successful' || statusLower === 'paid') {
              // Update to completed
              if (transaction.status !== 'completed') {
                await updateTransactionStatus({
                  transactionId: transaction.id,
                  status: 'completed',
                  statusMessage: `Payment verified via bulk verification: ${verificationData.message || azamStatus || 'Status updated'}`,
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
                  identifier: `Azam ID: ${azamId}`,
                  found: true,
                  verified: true,
                  status: 'completed',
                  message: `Updated from ${transaction.status} to completed`,
                })
              } else {
                results.push({
                  identifier: `Azam ID: ${azamId}`,
                  found: true,
                  verified: true,
                  status: 'completed',
                  message: 'Already completed',
                })
              }
            } else {
              results.push({
                identifier: `Azam ID: ${azamId}`,
                found: true,
                verified: false,
                status: transaction.status,
                message: `Azam Pay status: ${azamStatus || 'unknown'}`,
              })
            }
          } catch (verifyError: any) {
            results.push({
              identifier: `Azam ID: ${azamId}`,
              found: true,
              verified: false,
              status: transaction.status,
              message: `Verification failed: ${verifyError.message || 'Unknown error'}`,
            })
          }
        } catch (error: any) {
          results.push({
            identifier: `Azam ID: ${azamId}`,
            found: false,
            verified: false,
            message: `Error: ${error.message || 'Unknown error'}`,
          })
        }
      }
    }

    // Process reference numbers (external IDs)
    if (referenceNumbers && Array.isArray(referenceNumbers)) {
      for (const ref of referenceNumbers) {
        try {
          // Find transaction by external ID
          const [transaction] = await db
            .select()
            .from(paymentTransactions)
            .where(eq(paymentTransactions.externalId, String(ref)))
            .limit(1)

          if (!transaction) {
            results.push({
              identifier: `Reference: ${ref}`,
              found: false,
              verified: false,
              message: 'Transaction not found in database',
            })
            continue
          }

          // If transaction has Azam ID, verify with Azam Pay
          if (transaction.azamTransactionId) {
            try {
              const verificationResult = await azamPay.verifyPayment(transaction.azamTransactionId)
              const verificationData = verificationResult.data || verificationResult
              const azamStatus = verificationData.status || verificationData.transactionStatus || verificationData.transactionstatus
              const statusLower = (azamStatus || '').toLowerCase().trim()

              if (statusLower === 'success' || statusLower === 'completed' || statusLower === 'successful' || statusLower === 'paid') {
                if (transaction.status !== 'completed') {
                  await updateTransactionStatus({
                    transactionId: transaction.id,
                    status: 'completed',
                    statusMessage: `Payment verified via bulk verification: ${verificationData.message || azamStatus || 'Status updated'}`,
                    changedBy: `admin:${session.user.id}`,
                    responsePayload: verificationResult,
                  })

                  await db
                    .update(serviceAccessPayments)
                    .set({
                      status: 'completed',
                      paidAt: sql`CURRENT_TIMESTAMP`,
                      updatedAt: sql`CURRENT_TIMESTAMP`,
                    })
                    .where(eq(serviceAccessPayments.transactionId, transaction.externalId))

                  results.push({
                    identifier: `Reference: ${ref}`,
                    found: true,
                    verified: true,
                    status: 'completed',
                    message: `Updated from ${transaction.status} to completed`,
                  })
                } else {
                  results.push({
                    identifier: `Reference: ${ref}`,
                    found: true,
                    verified: true,
                    status: 'completed',
                    message: 'Already completed',
                  })
                }
              } else {
                results.push({
                  identifier: `Reference: ${ref}`,
                  found: true,
                  verified: false,
                  status: transaction.status,
                  message: `Azam Pay status: ${azamStatus || 'unknown'}`,
                })
              }
            } catch (verifyError: any) {
              results.push({
                identifier: `Reference: ${ref}`,
                found: true,
                verified: false,
                status: transaction.status,
                message: `Verification failed: ${verifyError.message || 'Unknown error'}`,
              })
            }
          } else {
            results.push({
              identifier: `Reference: ${ref}`,
              found: true,
              verified: false,
              status: transaction.status,
              message: 'No Azam transaction ID available for verification',
            })
          }
        } catch (error: any) {
          results.push({
            identifier: `Reference: ${ref}`,
            found: false,
            verified: false,
            message: `Error: ${error.message || 'Unknown error'}`,
          })
        }
      }
    }

    const verifiedCount = results.filter(r => r.verified).length
    const updatedCount = results.filter(r => r.verified && r.status === 'completed').length

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
    console.error('[Bulk Verify] Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

