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
    const { amount, method } = body ?? {}

    // Validate required fields
    if (!amount || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, method' },
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
    const validMethods = [
      'mobile-money',
      'bank-transfer',
      'cash',
      // common stored values in schema/comments
      'mpesa',
      'airtel',
      'mixx',
      'bank',
      'card',
      'wallet',
    ]
    if (!validMethods.includes(String(method))) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
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

    const paymentId = generateId()
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    // Create payment record
    await db.insert(payments).values({
      id: paymentId,
      facilityId,
      amount: paymentAmount.toString(),
      method: String(method),
      status: 'pending',
      transactionId,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // Create notification for payment initiation
    await db.insert(facilityNotifications).values({
      id: generateId(),
      facilityId,
      type: 'payment_initiated',
      title: 'Payment Initiated',
      message: `Your payment of ${formatCurrency(paymentAmount)} has been initiated.`,
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
        id: paymentId,
        transactionId,
        amount: paymentAmount,
        method: String(method),
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
