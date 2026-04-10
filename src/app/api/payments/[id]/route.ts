import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { payments, facilityNotifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId, formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PATCH /api/payments/[id]
 * Update payment status (admin or same-facility).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Payment ID required' }, { status: 400 })

    const body = await request.json()
    const { status, transactionId } = body ?? {}

    if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 })

    const validStatuses = ['pending', 'completed', 'failed', 'refunded'] as const
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const [existing] = await db.select().from(payments).where(eq(payments.id, id)).limit(1)
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    // authz: admin can update any; facility user can only update own facility payment
    if (session.user.role !== 'admin') {
      const facilityId = session.user.facilityId
      if (!facilityId || existing.facilityId !== facilityId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await db
      .update(payments)
      .set({
        status,
        transactionId: transactionId ? String(transactionId) : existing.transactionId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))

    const [updated] = await db.select().from(payments).where(eq(payments.id, id)).limit(1)
    if (!updated) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    if (status === 'completed') {
      await db.insert(facilityNotifications).values({
        id: generateId(),
        facilityId: updated.facilityId,
        type: 'payment_completed',
        title: 'Payment Completed',
        message: `Your payment of ${formatCurrency(Number(updated.amount))} has been completed successfully.`,
        actionUrl: '/dashboard',
        actionLabel: 'View Receipt',
        serviceName: 'afya-solar',
        transactionId: updated.transactionId,
        showInDashboard: true,
        sendEmail: true,
        sendSms: true,
        priority: 'normal',
        createdAt: new Date(),
      })
    } else if (status === 'failed') {
      await db.insert(facilityNotifications).values({
        id: generateId(),
        facilityId: updated.facilityId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: `Your payment of ${formatCurrency(Number(updated.amount))} has failed. Please try again or contact support.`,
        actionUrl: '/dashboard',
        actionLabel: 'Retry Payment',
        serviceName: 'afya-solar',
        transactionId: updated.transactionId,
        showInDashboard: true,
        sendEmail: true,
        sendSms: true,
        priority: 'high',
        createdAt: new Date(),
      })
    }

    return NextResponse.json({ success: true, payment: updated })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

