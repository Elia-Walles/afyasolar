import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, serviceAccessPayments, serviceSubscriptions } from '@/lib/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { updateTransactionStatus } from '@/lib/payments/transaction-service'
import { createAzamPayService } from '@/lib/payments/azam-pay'
import { sendPaymentVerificationSMS } from '@/lib/sms'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/transactions/[id]/verify
 * Manually verify payment status with Azam Pay API (Admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transactionId = params.id

    // Get current transaction
    const [transaction] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, transactionId))
      .limit(1)

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // If transaction already completed, return current status
    if (transaction.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Transaction already completed',
        data: {
          transactionId: transaction.id,
          status: transaction.status,
          verified: true,
        }
      })
    }

    // If no Azam transaction ID, can't verify
    if (!transaction.azamTransactionId) {
      return NextResponse.json(
        { error: 'No Azam Pay transaction ID available for verification' },
        { status: 400 }
      )
    }

    console.log(`[Admin Verify] Verifying transaction ${transaction.id} with Azam Pay ID: ${transaction.azamTransactionId}`)

    // Verify with Azam Pay
    const azamPay = createAzamPayService()
    let verificationResult
    try {
      verificationResult = await azamPay.verifyPayment(transaction.azamTransactionId)
      console.log('[Admin Verify] Azam Pay verification response:', verificationResult)
    } catch (error: any) {
      console.error('[Admin Verify] Error verifying with Azam Pay:', error)
      return NextResponse.json(
        { 
          error: 'Failed to verify with Azam Pay',
          message: error.message || 'Verification API call failed'
        },
        { status: 500 }
      )
    }

    // Parse verification response
    // Azam Pay response structure may vary, check common patterns
    const verificationData = verificationResult.data || verificationResult
    const azamStatus = verificationData.status || verificationData.transactionStatus || verificationData.transactionstatus
    
    // Map Azam Pay status to our status
    let newStatus: 'completed' | 'failed' | 'processing' | 'pending' = 'pending'
    const statusLower = (azamStatus || '').toLowerCase()
    
    if (statusLower === 'success' || statusLower === 'completed' || statusLower === 'successful') {
      newStatus = 'completed'
    } else if (statusLower === 'failed' || statusLower === 'failure' || statusLower === 'cancelled' || statusLower === 'rejected') {
      newStatus = 'failed'
    } else if (statusLower === 'pending' || statusLower === 'processing') {
      newStatus = 'processing'
    }

    console.log(`[Admin Verify] Mapped status: ${statusLower} -> ${newStatus}`)

    // Update transaction status if it changed
    if (newStatus !== transaction.status) {
      console.log(`[Admin Verify] Updating status from ${transaction.status} to ${newStatus}`)
      
      await updateTransactionStatus({
        transactionId: transaction.id,
        status: newStatus,
        statusMessage: `Payment verified via admin: ${verificationData.message || azamStatus || 'Status updated'}`,
        changedBy: `admin:${session.user.id}`,
        responsePayload: verificationResult,
      })

      // Also update service access payment if status is completed
      if (newStatus === 'completed') {
        // Update service access payment (handlePaymentCompleted also does this, but we ensure it's done)
        const conditions = [eq(serviceAccessPayments.transactionId, transaction.externalId)]
        if (transaction.azamTransactionId) {
          conditions.push(eq(serviceAccessPayments.transactionId, transaction.azamTransactionId))
        }
        
        await db
          .update(serviceAccessPayments)
          .set({
            status: 'completed',
            paidAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(serviceAccessPayments.transactionId, transaction.externalId))
        
        console.log('[Admin Verify] Service access payment updated to completed')
        
        // Note: handlePaymentCompleted is automatically called by updateTransactionStatus
        // when status is 'completed', so subscription should already be created/updated
        // Wait a moment for subscription to be created, then send SMS
        await new Promise(resolve => setTimeout(resolve, 500)) // Small delay to ensure subscription is created
        
        // Send SMS notification to user
        try {
          // Get phone number from transaction
          const phoneNumber = transaction.mobileNumber || transaction.bankMobileNumber
          
          if (phoneNumber) {
            // Get subscription details (should exist after handlePaymentCompleted)
            const [subscription] = await db
              .select()
              .from(serviceSubscriptions)
              .where(
                and(
                  eq(serviceSubscriptions.facilityId, transaction.facilityId),
                  eq(serviceSubscriptions.serviceName, transaction.serviceName)
                )
              )
              .limit(1)
            
            if (subscription) {
              // Map service name to display name
              const serviceDisplayNames: Record<string, string> = {
                'afya-solar': 'Afya Solar',
              }
              
              const serviceDisplayName = serviceDisplayNames[transaction.serviceName] || transaction.serviceName
              
              // Normalize phone number (ensure it starts with country code)
              let normalizedPhone = phoneNumber.replace(/\s/g, '')
              if (!normalizedPhone.startsWith('255') && !normalizedPhone.startsWith('+255')) {
                if (normalizedPhone.startsWith('0')) {
                  normalizedPhone = '255' + normalizedPhone.substring(1)
                } else {
                  normalizedPhone = '255' + normalizedPhone
                }
              }
              normalizedPhone = normalizedPhone.replace(/^\+/, '') // Remove + if present
              
              // Send SMS - check if expiry date exists
              if (!subscription.expiryDate) {
                console.warn('[Admin Verify] ⚠️ Subscription expiry date is missing, cannot send SMS')
              } else {
                const smsResult = await sendPaymentVerificationSMS(normalizedPhone, {
                  transactionId: transaction.id,
                  externalId: transaction.externalId,
                  amount: String(transaction.amount),
                  currency: transaction.currency || 'TZS',
                  serviceName: transaction.serviceName,
                  serviceDisplayName,
                  billingCycle: transaction.billingCycle as 'monthly' | 'yearly' | null,
                  subscriptionStartDate: subscription.startDate instanceof Date ? subscription.startDate : new Date(subscription.startDate),
                  subscriptionEndDate: subscription.expiryDate instanceof Date ? subscription.expiryDate : new Date(subscription.expiryDate),
                  paymentMethod: transaction.paymentMethod || undefined,
                })
                
                if (smsResult.success) {
                  console.log('[Admin Verify] ✅ SMS sent successfully to:', normalizedPhone)
                } else {
                  console.error('[Admin Verify] ❌ Failed to send SMS:', smsResult.message)
                }
              }
            } else {
              console.warn('[Admin Verify] ⚠️ Subscription not found after payment completion, cannot send SMS with subscription details')
            }
          } else {
            console.warn('[Admin Verify] ⚠️ No phone number found in transaction, cannot send SMS')
          }
        } catch (smsError: any) {
          console.error('[Admin Verify] ❌ Error sending SMS:', smsError)
          // Don't fail the verification if SMS fails
        }
      }

      return NextResponse.json({
        success: true,
        message: `Transaction status updated from ${transaction.status} to ${newStatus}`,
        data: {
          transactionId: transaction.id,
          previousStatus: transaction.status,
          newStatus: newStatus,
          azamPayStatus: azamStatus,
          verified: true,
        }
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Transaction status verified - no change needed',
        data: {
          transactionId: transaction.id,
          status: transaction.status,
          azamPayStatus: azamStatus,
          verified: true,
        }
      })
    }
  } catch (error) {
    console.error('[Admin Verify] Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

