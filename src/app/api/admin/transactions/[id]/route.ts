import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, transactionStatusHistory, serviceAccessPayments, facilities, serviceSubscriptions } from '@/lib/db/schema'
import { eq, sql, desc, and } from 'drizzle-orm'
import { updateTransactionStatus } from '@/lib/payments/transaction-service'
import { sendPaymentVerificationSMS } from '@/lib/sms'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

const updateStatusSchema = z.object({
  status: z.enum(['initiated', 'pending', 'awaiting_confirmation', 'processing', 'completed', 'failed', 'cancelled']),
  adminNotes: z.string().optional(),
})

/**
 * GET /api/admin/transactions/[id]
 * Get transaction details with full history (Admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transactionId = id

    // Get transaction with facility info
    const [result] = await db
      .select({
        transaction: paymentTransactions,
        facilityName: facilities.name,
        facilityEmail: facilities.email,
      })
      .from(paymentTransactions)
      .leftJoin(facilities, eq(paymentTransactions.facilityId, facilities.id))
      .where(eq(paymentTransactions.id, transactionId))
      .limit(1)

    if (!result) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Get status history
    const statusHistory = await db
      .select()
      .from(transactionStatusHistory)
      .where(eq(transactionStatusHistory.transactionId, transactionId))
      .orderBy(desc(transactionStatusHistory.createdAt))

    // Parse JSON fields
    let requestPayload = null
    let responsePayload = null
    let callbackPayload = null

    try {
      if (result.transaction.requestPayload) {
        requestPayload = JSON.parse(result.transaction.requestPayload)
      }
      if (result.transaction.responsePayload) {
        responsePayload = JSON.parse(result.transaction.responsePayload)
      }
      if (result.transaction.callbackPayload) {
        callbackPayload = JSON.parse(result.transaction.callbackPayload)
      }
    } catch (e) {
      // Ignore JSON parse errors
    }

    return NextResponse.json({
      transaction: {
        ...result.transaction,
        facilityName: result.facilityName,
        facilityEmail: result.facilityEmail,
        requestPayload,
        responsePayload,
        callbackPayload,
      },
      statusHistory: statusHistory.map(h => ({
        ...h,
        metadata: h.metadata ? JSON.parse(h.metadata) : null,
      })),
    })
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/transactions/[id]
 * Update transaction status (Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const transactionId = id
    const body = await request.json()
    const { status, adminNotes } = updateStatusSchema.parse(body)

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

    // Update transaction status using the transaction service
    const updateResult = await updateTransactionStatus({
      transactionId: transaction.id,
      status,
      statusMessage: adminNotes || `Status updated by admin to ${status}`,
      changedBy: `admin:${session.user.id}`,
      failureReason: status === 'failed' ? (adminNotes || 'Marked as failed by admin') : undefined,
    })

    // Also update service access payment if status is completed or failed
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
            
            // Send SMS
            if (!subscription.expiryDate) {
              console.warn('[Admin PATCH] Subscription expiry date is missing, cannot send SMS')
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
                console.log('[Admin PATCH] ✅ SMS sent successfully to:', normalizedPhone)
              } else {
                console.error('[Admin PATCH] ❌ Failed to send SMS:', smsResult.message)
              }
            }
            
          }
        }
      } catch (smsError: any) {
        console.error('[Admin PATCH] Error sending SMS:', smsError)
        // Don't fail the update if SMS fails
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
      message: 'Transaction status updated successfully',
      data: {
        transactionId: transaction.id,
        previousStatus: updateResult.previousStatus,
        newStatus: updateResult.newStatus,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
