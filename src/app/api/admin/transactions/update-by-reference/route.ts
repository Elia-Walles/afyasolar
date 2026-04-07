import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, serviceAccessPayments, serviceSubscriptions } from '@/lib/db/schema'
import { eq, sql, or, like, and } from 'drizzle-orm'
import { updateTransactionStatus } from '@/lib/payments/transaction-service'
import { sendPaymentVerificationSMS } from '@/lib/sms'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/transactions/update-by-reference
 * Manually update transaction status by Azam reference number or transaction ID (Admin only)
 * 
 * This is useful when callbacks aren't received but we have confirmation (e.g., from SMS)
 * 
 * Body: {
 *   reference: "251217fE27p3GgL", // Azam reference from SMS
 *   azamTransactionId: "3979949617", // Optional: Azam transaction ID from SMS
 *   status: "completed", // New status
 *   notes: "Payment confirmed via SMS" // Optional admin notes
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { reference, azamTransactionId, status, notes } = body

    if (!reference && !azamTransactionId) {
      return NextResponse.json(
        { error: 'reference or azamTransactionId is required' },
        { status: 400 }
      )
    }

    if (!status || !['completed', 'failed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: completed, failed, cancelled' },
        { status: 400 }
      )
    }

    console.log(`[Update By Reference] Searching for transaction:`, {
      reference,
      azamTransactionId,
      requestedStatus: status,
    })

    // Try to find transaction by multiple methods
    let transaction = null

    // Method 1: Search by Azam transaction ID
    if (azamTransactionId) {
      const [byAzamId] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.azamTransactionId, String(azamTransactionId)))
        .limit(1)
      
      if (byAzamId) {
        transaction = byAzamId
        console.log(`[Update By Reference] Found by azamTransactionId: ${azamTransactionId}`)
      }
    }

    // Method 2: Search by reference in azamReference field
    if (!transaction && reference) {
      const [byRef] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.azamReference, String(reference)))
        .limit(1)
      
      if (byRef) {
        transaction = byRef
        console.log(`[Update By Reference] Found by azamReference: ${reference}`)
      }
    }

    // Method 3: Search by reference in externalId (some systems store reference as externalId)
    if (!transaction && reference) {
      const [byExternalId] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.externalId, String(reference)))
        .limit(1)
      
      if (byExternalId) {
        transaction = byExternalId
        console.log(`[Update By Reference] Found by externalId: ${reference}`)
      }
    }

    // Method 4: Search by reference pattern (partial match in externalId)
    if (!transaction && reference) {
      const [byPattern] = await db
        .select()
        .from(paymentTransactions)
        .where(like(paymentTransactions.externalId, `%${reference}%`))
        .limit(1)
      
      if (byPattern) {
        transaction = byPattern
        console.log(`[Update By Reference] Found by pattern match: ${reference}`)
      }
    }

    // Method 5: Search in service_access_payments by transactionId
    if (!transaction && reference) {
      const [accessPayment] = await db
        .select()
        .from(serviceAccessPayments)
        .where(eq(serviceAccessPayments.transactionId, String(reference)))
        .limit(1)

      if (accessPayment) {
        // Find the related transaction
        const [relatedTransaction] = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.externalId, accessPayment.transactionId || ''))
          .limit(1)
        
        if (relatedTransaction) {
          transaction = relatedTransaction
          console.log(`[Update By Reference] Found via serviceAccessPayments: ${reference}`)
        }
      }
    }

    if (!transaction) {
      return NextResponse.json(
        { 
          error: 'Transaction not found',
          searched: { reference, azamTransactionId },
          message: 'Could not find transaction with the provided reference or transaction ID. Please verify the reference number from the SMS.'
        },
        { status: 404 }
      )
    }

    console.log(`[Update By Reference] Found transaction:`, {
      id: transaction.id,
      externalId: transaction.externalId,
      azamTransactionId: transaction.azamTransactionId,
      azamReference: transaction.azamReference,
      currentStatus: transaction.status,
      requestedStatus: status,
    })

    // Update transaction status
    if (transaction.status !== status) {
      await updateTransactionStatus({
        transactionId: transaction.id,
        status: status as 'completed' | 'failed' | 'cancelled',
        statusMessage: notes || `Status updated manually by admin: ${status}. Reference: ${reference || azamTransactionId}`,
        changedBy: `admin:${session.user.id}`,
        failureReason: status === 'failed' ? (notes || 'Marked as failed by admin') : undefined,
      })

      // Update service access payment if status is completed
      if (status === 'completed') {
        // Update service access payment
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
        
        console.log(`[Update By Reference] ✅ Service access payment updated to completed`)
        
        // Note: handlePaymentCompleted is automatically called by updateTransactionStatus
        // Wait a moment for subscription to be created
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Send SMS notification to user
        try {
          const phoneNumber = transaction.mobileNumber || transaction.bankMobileNumber
          
          if (phoneNumber) {
            // Get subscription details
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
              const serviceDisplayNames: Record<string, string> = {
                'afya-solar': 'Afya Solar',
              }
              
              const serviceDisplayName = serviceDisplayNames[transaction.serviceName] || transaction.serviceName
              
              // Normalize phone number
              let normalizedPhone = phoneNumber.replace(/\s/g, '')
              if (!normalizedPhone.startsWith('255') && !normalizedPhone.startsWith('+255')) {
                if (normalizedPhone.startsWith('0')) {
                  normalizedPhone = '255' + normalizedPhone.substring(1)
                } else {
                  normalizedPhone = '255' + normalizedPhone
                }
              }
              normalizedPhone = normalizedPhone.replace(/^\+/, '')
              
              // Send SMS - check if expiry date exists
              if (!subscription.expiryDate) {
                console.warn('[Update By Reference] ⚠️ Subscription expiry date is missing, cannot send SMS')
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
                  console.log(`[Update By Reference] ✅ SMS sent successfully to: ${normalizedPhone}`)
                } else {
                  console.error(`[Update By Reference] ❌ Failed to send SMS: ${smsResult.message}`)
                }
              }
            }
          }
        } catch (smsError: any) {
          console.error('[Update By Reference] Error sending SMS:', smsError)
        }
      } else if (status === 'failed') {
        await db
          .update(serviceAccessPayments)
          .set({
            status: 'failed',
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(serviceAccessPayments.transactionId, transaction.externalId))
      }

      return NextResponse.json({
        success: true,
        message: `Transaction status updated from ${transaction.status} to ${status}`,
        data: {
          transactionId: transaction.id,
          externalId: transaction.externalId,
          previousStatus: transaction.status,
          newStatus: status,
          reference: reference || azamTransactionId,
        }
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Transaction already has the requested status',
        data: {
          transactionId: transaction.id,
          externalId: transaction.externalId,
          status: transaction.status,
          reference: reference || azamTransactionId,
        }
      })
    }
  } catch (error) {
    console.error('[Update By Reference] Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

