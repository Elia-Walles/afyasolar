import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { sql } from 'drizzle-orm'

import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments } from '@/lib/db/schema'
import { createAzamPayService } from '@/lib/payments/azam-pay'
import { createTransaction, updateTransactionStatus } from '@/lib/payments/transaction-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const requestSchema = z.object({
  deviceId: z.string().min(1).max(120),
  amount: z.number().positive(),
  phoneNumber: z.string().min(9).max(20),
})

function normalizeMobileNumber(mobile: string): string {
  let cleaned = mobile.replace(/\s/g, '').trim().replace(/^\+/, '')
  const digitsOnly = cleaned.replace(/\D/g, '')
  if (digitsOnly.length === 0) throw new Error('Invalid mobile number format: no digits found')

  let normalized: string
  if (digitsOnly.startsWith('255') && digitsOnly.length === 12) normalized = digitsOnly
  else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) normalized = '255' + digitsOnly.substring(1)
  else if (digitsOnly.length === 9) normalized = '255' + digitsOnly
  else if (digitsOnly.length >= 9) normalized = '255' + digitsOnly.slice(-9)
  else throw new Error(`Invalid mobile number format: expected 9-12 digits, got ${digitsOnly.length}`)

  if (!normalized.startsWith('255') || normalized.length !== 12) {
    throw new Error(`Failed to normalize mobile number: ${mobile} -> ${normalized}`)
  }
  return normalized
}

/**
 * POST /api/payments/mpesa
 * Design-compat endpoint implemented as a wrapper on AzamPay (provider="Mpesa").
 *
 * Requires a logged-in facility (or admin acting as facility) to preserve security.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'facility' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const { deviceId, amount, phoneNumber } = requestSchema.parse(await request.json())

    // STEP 1: create transaction
    const transaction = await createTransaction({
      facilityId,
      serviceName: 'microgrid',
      amount,
      currency: 'TZS',
      paymentType: 'mobile',
      paymentMethod: 'mpesa',
      mobileNumber: phoneNumber,
      mobileProvider: 'Mpesa',
      requestPayload: { deviceId, amount, phoneNumber, provider: 'Mpesa' },
    })

    // Create access payment record for status polling
    const paymentId = crypto.randomUUID()
    await db.insert(serviceAccessPayments).values({
      id: paymentId,
      facilityId,
      serviceName: 'microgrid',
      amount: String(amount),
      currency: 'TZS',
      paymentMethod: 'mpesa',
      transactionId: transaction.externalId,
      status: 'pending',
      paidAt: null,
      metadata: JSON.stringify({ deviceId, transactionId: transaction.id, externalId: transaction.externalId }),
    })

    // STEP 2: set pending
    await updateTransactionStatus({
      transactionId: transaction.id,
      status: 'pending',
      statusMessage: 'Payment request sent to Azam Pay (M-Pesa)',
      changedBy: 'system',
    })

    // STEP 3: initiate checkout via AzamPay, provider="Mpesa"
    const azamPay = createAzamPayService()
    const normalizedMobile = normalizeMobileNumber(phoneNumber)
    const checkoutResponse = await azamPay.mobileCheckout({
      amount,
      accountNumber: normalizedMobile,
      externalId: transaction.externalId,
      provider: 'Mpesa',
      currency: 'TZS',
    })

    if (!checkoutResponse.success) {
      const errorMessage = checkoutResponse.message || 'Failed to initiate payment with Azam Pay'
      await updateTransactionStatus({
        transactionId: transaction.id,
        status: 'failed',
        statusMessage: errorMessage,
        failureReason: errorMessage,
        responsePayload: checkoutResponse.data,
        changedBy: 'azam_pay',
      })

      await db
        .update(serviceAccessPayments)
        .set({ status: 'failed', updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(sql`${serviceAccessPayments.id} = ${paymentId}`)

      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    await updateTransactionStatus({
      transactionId: transaction.id,
      status: 'awaiting_confirmation',
      statusMessage: `PIN prompt sent to customer phone (${normalizedMobile}). Please enter PIN to complete payment.`,
      azamTransactionId: checkoutResponse.transactionId,
      responsePayload: checkoutResponse.data,
      changedBy: 'azam_pay',
    })

    await db
      .update(serviceAccessPayments)
      .set({
        transactionId: checkoutResponse.transactionId || transaction.externalId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(sql`${serviceAccessPayments.id} = ${paymentId}`)

    return NextResponse.json({
      success: true,
      message: 'Payment initiated. Please complete on your phone.',
      checkoutRequestId: checkoutResponse.transactionId || null,
      payment: {
        id: paymentId,
        transactionId: transaction.id,
        externalId: transaction.externalId,
        azamTransactionId: checkoutResponse.transactionId || null,
        status: 'awaiting_confirmation',
        expiresAt: transaction.expiresAt,
      },
      checkoutData: checkoutResponse.data,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error initiating M-Pesa wrapper payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

