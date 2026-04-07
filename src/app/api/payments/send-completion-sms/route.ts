import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, serviceSubscriptions, facilities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { sendPaymentVerificationSMS, normalizeTanzaniaPhone } from '@/lib/sms'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/payments/send-completion-sms
 * Send SMS notification when payment transaction is completed
 * This endpoint can be called by frontend when it detects a completed transaction
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { transactionId, externalId } = body

    if (!transactionId && !externalId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID or External ID required' },
        { status: 400 }
      )
    }

    // Find transaction by ID or external ID
    let transaction = null
    if (transactionId) {
      const [found] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, transactionId))
        .limit(1)
      transaction = found || null
    }
    
    if (!transaction && externalId) {
      const [found] = await db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.externalId, externalId))
        .limit(1)
      transaction = found || null
    }

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Only send SMS if transaction is completed
    if (transaction.status !== 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transaction is not completed',
          status: transaction.status 
        },
        { status: 400 }
      )
    }

    // Basic authorization: admins can send for any, facilities only for their own subscriptions
    const isAdmin = session.user.role === 'admin'
    const isFacilityOwner =
      session.user.role === 'facility' &&
      session.user.facilityId &&
      transaction.facilityId === session.user.facilityId

    if (!isAdmin && !isFacilityOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

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

    if (!subscription || !subscription.expiryDate) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Subscription not found or missing expiry date' 
        },
        { status: 404 }
      )
    }

    // Phone number comes from the PAYER's input at payment time (payment_transactions.mobile_number
    // or bank_mobile_number), NOT from facilities.phone. So it can be invalid (typos, wrong format).
    let phoneNumber = transaction.mobileNumber || transaction.bankMobileNumber
    let normalizedPhone = phoneNumber ? normalizeTanzaniaPhone(phoneNumber) : null

    // If transaction phone is missing or invalid, fall back to facility phone so the facility still gets the SMS
    if (!normalizedPhone && transaction.facilityId) {
      const [facility] = await db
        .select({ phone: facilities.phone })
        .from(facilities)
        .where(eq(facilities.id, transaction.facilityId))
        .limit(1)
      const facilityPhone = facility?.phone
      if (facilityPhone) {
        normalizedPhone = normalizeTanzaniaPhone(facilityPhone)
        if (normalizedPhone) {
          console.log(`[SendCompletionSMS] Transaction phone invalid/missing; using facility phone: ${facilityPhone}`)
        }
      }
    }

    if (!phoneNumber && !normalizedPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number not found in transaction or facility' },
        { status: 400 }
      )
    }

    if (!normalizedPhone) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid phone number for SMS',
          details: 'Payer number was invalid and facility has no valid phone. Use a valid Tanzania mobile (e.g. 0712345678 or 255712345678).'
        },
        { status: 400 }
      )
    }

    // Map service name to display name
    const serviceDisplayNames: Record<string, string> = {
      'afya-solar': 'Afya Solar',
    }
    
    const serviceDisplayName = serviceDisplayNames[transaction.serviceName] || transaction.serviceName

    // Send SMS
    console.log(`[SendCompletionSMS] Sending SMS to: ${normalizedPhone} for transaction: ${transaction.externalId}`)
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
      console.log(`[SendCompletionSMS] ✅ SMS sent successfully to: ${normalizedPhone}`)
      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully',
        phoneNumber: normalizedPhone,
      })
    } else {
      console.error(`[SendCompletionSMS] ❌ Failed to send SMS:`, smsResult.message)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send SMS',
          details: smsResult.message 
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[SendCompletionSMS] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
