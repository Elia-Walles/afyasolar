import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { sql } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

const paymentSchema = z.object({
  serviceName: z.enum(['afya-solar']),
  paymentMethod: z.string().min(1),
  transactionId: z.string().optional(),
})

/**
 * POST /api/services/access-payment
 * Create a payment record for service access
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { serviceName, paymentMethod, transactionId } = paymentSchema.parse(body)

    // Service access fees (in TZS)
    const serviceFees: Record<string, number> = {
      'afya-solar': 0, // Will be set later
    }

    const amount = serviceFees[serviceName]
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid service or amount not configured' },
        { status: 400 }
      )
    }

    // Check if facility already has a completed payment for this service
    const existingPayment = await db
      .select()
      .from(serviceAccessPayments)
      .where(
        and(
          eq(serviceAccessPayments.facilityId, facilityId),
          eq(serviceAccessPayments.serviceName, serviceName),
          eq(serviceAccessPayments.status, 'completed')
        )
      )
      .limit(1)

    if (existingPayment.length > 0) {
      return NextResponse.json(
        { error: 'Payment already completed for this service' },
        { status: 400 }
      )
    }

    // Create payment record
    const paymentId = crypto.randomUUID()
    await db.insert(serviceAccessPayments).values({
      id: paymentId,
      facilityId,
      serviceName,
      amount: String(amount),
      currency: 'TZS',
      paymentMethod,
      transactionId: transactionId || null,
      status: 'completed', // Auto-complete for now (can be changed to pending if manual verification needed)
      paidAt: sql`CURRENT_TIMESTAMP`,
    })

    return NextResponse.json({
      success: true,
      message: 'Payment completed successfully',
      payment: {
        id: paymentId,
        serviceName,
        amount,
        status: 'completed',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating service access payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/services/access-payment
 * Check if facility has paid for service access
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const serviceName = searchParams.get('serviceName')

    if (!serviceName) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400 }
      )
    }

    // Check for completed payment
    const payment = await db
      .select()
      .from(serviceAccessPayments)
      .where(
        and(
          eq(serviceAccessPayments.facilityId, facilityId),
          eq(serviceAccessPayments.serviceName, serviceName),
          eq(serviceAccessPayments.status, 'completed')
        )
      )
      .limit(1)

    return NextResponse.json({
      hasPaid: payment.length > 0,
      payment: payment[0] || null,
    })
  } catch (error) {
    console.error('Error checking service access payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
