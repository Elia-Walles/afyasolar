import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { technicianWithdrawals, technicianCommissions } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { resolveTechnicianId } from '@/lib/auth/technician'
import { sql } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

const createWithdrawalSchema = z.object({
  amount: z.number().min(10000, 'Minimum withdrawal amount is 10,000 TZS'),
  currency: z.string().default('TZS'),
  withdrawalMethod: z.string().optional(),
  accountDetails: z.record(z.any()).optional(),
})

/**
 * GET /api/technicians/[id]/withdrawals
 * Get technician's withdrawal history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const technicianId = params.id

    // Technicians can only view their own withdrawals, admins can view any
    if (session.user.role === 'technician') {
      const resolvedId = await resolveTechnicianId(session.user)
      if (resolvedId !== technicianId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const withdrawals = await db
      .select()
      .from(technicianWithdrawals)
      .where(eq(technicianWithdrawals.technicianId, technicianId))
      .orderBy(desc(technicianWithdrawals.createdAt))

    return NextResponse.json({
      success: true,
      data: withdrawals,
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/technicians/[id]/withdrawals
 * Create a withdrawal request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const technicianId = params.id

    // Only technicians can create withdrawals for themselves
    if (session.user.role === 'technician') {
      const resolvedId = await resolveTechnicianId(session.user)
      if (resolvedId !== technicianId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Only technicians can create withdrawal requests' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, currency, withdrawalMethod, accountDetails } = createWithdrawalSchema.parse(body)

    // Check available balance
    const earnedCommissions = await db
      .select({
        total: sql<number>`COALESCE(SUM(${technicianCommissions.commissionAmount}), 0)`,
      })
      .from(technicianCommissions)
      .where(
        and(
          eq(technicianCommissions.technicianId, technicianId),
          eq(technicianCommissions.status, 'earned')
        )
      )

    const withdrawnCommissions = await db
      .select({
        total: sql<number>`COALESCE(SUM(${technicianCommissions.commissionAmount}), 0)`,
      })
      .from(technicianCommissions)
      .where(
        and(
          eq(technicianCommissions.technicianId, technicianId),
          eq(technicianCommissions.status, 'withdrawn')
        )
      )

    const pendingWithdrawals = await db
      .select({
        total: sql<number>`COALESCE(SUM(${technicianWithdrawals.amount}), 0)`,
      })
      .from(technicianWithdrawals)
      .where(
        and(
          eq(technicianWithdrawals.technicianId, technicianId),
          eq(technicianWithdrawals.status, 'pending')
        )
      )

    const totalEarned = Number(earnedCommissions[0]?.total || 0)
    const totalWithdrawn = Number(withdrawnCommissions[0]?.total || 0)
    const pendingWithdrawalAmount = Number(pendingWithdrawals[0]?.total || 0)
    const availableBalance = totalEarned - totalWithdrawn - pendingWithdrawalAmount

    // Check minimum withdrawal amount
    if (amount < 10000) {
      return NextResponse.json(
        { error: 'Minimum withdrawal amount is 10,000 TZS' },
        { status: 400 }
      )
    }

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: 'Insufficient balance. Available: ' + availableBalance.toFixed(2) },
        { status: 400 }
      )
    }

    // Create withdrawal request
    const withdrawalId = randomUUID()
    await db.insert(technicianWithdrawals).values({
      id: withdrawalId,
      technicianId,
      amount: String(amount),
      currency: currency || 'TZS',
      withdrawalMethod: withdrawalMethod || null,
      accountDetails: accountDetails ? JSON.stringify(accountDetails) : null,
      status: 'pending',
    })

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request created successfully',
      data: { id: withdrawalId },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating withdrawal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
