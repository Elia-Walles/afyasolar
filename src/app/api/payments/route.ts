import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { payments, facilities, facilityNotifications } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { generateId, formatCurrency } from '@/lib/utils'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/payments
 * Get payment history for a facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const method = searchParams.get('method')

    // Build query conditions
    const conditions = [eq(payments.facilityId, facilityId)]
    
    if (status) {
      conditions.push(eq(payments.status, status))
    }
    
    if (method) {
      conditions.push(eq(payments.method, method))
    }

    const paymentHistory = await db
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset)

    const totalCountRows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(payments)
      .where(and(...conditions))

    const total = Number(totalCountRows[0]?.count ?? 0)

    return NextResponse.json({
      payments: paymentHistory,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments
 * Process a new payment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { amount, method, paymentType, description } = body

    // Validate required fields
    if (!amount || !method || !paymentType) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, method, paymentType' },
        { status: 400 }
      )
    }

    // Validate amount
    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // Validate payment method
    const validMethods = ['mobile-money', 'bank-transfer', 'cash']
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      )
    }

    // Validate payment type
    const validTypes = ['full-payment', 'paas-payment', 'installment-payment']
    if (!validTypes.includes(paymentType)) {
      return NextResponse.json(
        { error: 'Invalid payment type' },
        { status: 400 }
      )
    }

    // Get facility info for validation
    const [facility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Generate transaction ID
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create payment record
    const payment = await db.insert(payments).values({
      id: generateId(),
      facilityId,
      amount: paymentAmount.toString(),
      method,
      status: 'pending',
      paymentType,
      transactionId,
      description: description || `${paymentType.replace('-', ' ')} - ${formatCurrency(paymentAmount)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Create notification for payment initiation
    await db.insert(facilityNotifications).values({
      id: generateId(),
      facilityId,
      type: 'payment_initiated',
      title: 'Payment Initiated',
      message: `Your ${paymentType.replace('-', ' ')} of ${formatCurrency(paymentAmount)} has been initiated.`,
      actionUrl: '/dashboard/billing',
      actionLabel: 'View Payment Status',
      serviceName: 'afya-solar',
      transactionId,
      showInDashboard: true,
      sendEmail: true,
      sendSms: true,
      priority: 'normal',
      createdAt: new Date()
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        transactionId,
        amount: paymentAmount,
        method,
        status: 'pending',
        message: 'Payment initiated successfully'
      }
    })

  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/payments/[id]
 * Update payment status (for webhooks, admin updates, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { status, transactionReference, receiptUrl } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['pending', 'completed', 'failed', 'refunded']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Update payment
    const [updatedPayment] = await db
      .update(payments)
      .set({
        status,
        transactionReference,
        receiptUrl,
        updatedAt: new Date()
      })
      .where(eq(payments.id, id))
      .returning()

    if (!updatedPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Send notification based on status
    if (status === 'completed') {
      await db.insert(facilityNotifications).values({
        id: generateId(),
        facilityId: updatedPayment.facilityId,
        type: 'payment_completed',
        title: 'Payment Completed',
        message: `Your payment of ${formatCurrency(Number(updatedPayment.amount))} has been completed successfully.`,
        actionUrl: '/dashboard/billing',
        actionLabel: 'View Receipt',
        serviceName: 'afya-solar',
        transactionId: updatedPayment.transactionId,
        showInDashboard: true,
        sendEmail: true,
        sendSms: true,
        priority: 'normal',
        createdAt: new Date()
      })
    } else if (status === 'failed') {
      await db.insert(facilityNotifications).values({
        id: generateId(),
        facilityId: updatedPayment.facilityId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Your payment of ${formatCurrency(Number(updatedPayment.amount))} has failed. Please try again or contact support.`,
        actionUrl: '/dashboard/billing',
        actionLabel: 'Retry Payment',
        serviceName: 'afya-solar',
        transactionId: updatedPayment.transactionId,
        showInDashboard: true,
        sendEmail: true,
        sendSms: true,
        priority: 'high',
        createdAt: new Date()
      })
    }

    return NextResponse.json({
      success: true,
      payment: updatedPayment
    })

  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

