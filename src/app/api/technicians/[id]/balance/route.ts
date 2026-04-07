import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { technicianCommissions, technicianWithdrawals } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { resolveTechnicianId } from '@/lib/auth/technician'
import { getRawConnection } from '@/lib/db/index'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/technicians/[id]/balance
 * Get technician's commission balance
 * 
 * RECOMMENDATIONS:
 * 1. Use raw SQL for more reliable DECIMAL handling
 * 2. Add transaction safety
 * 3. Handle edge cases (null values, zero amounts)
 * 4. Provide detailed breakdown for debugging
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

    // Technicians can only view their own balance, admins can view any
    if (session.user.role === 'technician') {
      const resolvedId = await resolveTechnicianId(session.user)
      if (resolvedId !== technicianId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use raw SQL for more reliable DECIMAL handling
    const pool = getRawConnection()
    const connection = await pool.getConnection()

    try {
      // Calculate total earned commissions (include withdrawn to avoid missing historical statuses)
      const [earnedResult] = await connection.query(
        `SELECT COALESCE(SUM(CAST(commission_amount AS DECIMAL(12,2))), 0) as total
         FROM technician_commissions
         WHERE technician_id = ? AND commission_status IN ('earned','withdrawn')`,
        [technicianId]
      ) as any as [Array<{ total: string | number }>, any]

      // Calculate total withdrawn (use withdrawals table - completed only)
      const [withdrawnResult] = await connection.query(
        `SELECT COALESCE(SUM(CAST(amount AS DECIMAL(12,2))), 0) as total
         FROM technician_withdrawals
         WHERE technician_id = ? AND withdrawal_status = 'completed'`,
        [technicianId]
      ) as any as [Array<{ total: string | number }>, any]

      // Calculate pending withdrawals
      const [pendingResult] = await connection.query(
        `SELECT COALESCE(SUM(CAST(amount AS DECIMAL(12,2))), 0) as total
         FROM technician_withdrawals
         WHERE technician_id = ? AND withdrawal_status IN ('pending','processing')`,
        [technicianId]
      ) as any as [Array<{ total: string | number }>, any]

      // Get detailed breakdown for debugging
      const [commissionDetails] = await connection.query(
        `SELECT id, commission_amount, commission_status, maintenance_request_id, earned_at
         FROM technician_commissions
         WHERE technician_id = ?
         ORDER BY earned_at DESC
         LIMIT 10`,
        [technicianId]
      ) as any as [Array<{
        id: string
        commission_amount: string
        commission_status: string
        maintenance_request_id: string
        earned_at: Date
      }>, any]

      const [withdrawalDetails] = await connection.query(
        `SELECT id, amount, withdrawal_status, created_at
         FROM technician_withdrawals
         WHERE technician_id = ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [technicianId]
      ) as any as [Array<{
        id: string
        amount: string
        withdrawal_status: string
        created_at: Date
      }>, any]

      const totalEarned = Number(earnedResult[0]?.total || 0)
      const totalWithdrawn = Number(withdrawnResult[0]?.total || 0)
      const pendingWithdrawalAmount = Number(pendingResult[0]?.total || 0)
      
      // Calculate available balance
      // If totalWithdrawn > totalEarned, there's a data integrity issue
      // In this case, we should still show the correct available balance
      // by only counting withdrawals that are covered by actual commissions
      let availableBalance = totalEarned - totalWithdrawn - pendingWithdrawalAmount
      
      // Data integrity check: if withdrawn exceeds earned, there's a problem
      // This can happen if commissions weren't created when payments were completed
      const hasDataIntegrityIssue = totalWithdrawn > totalEarned
      
      if (hasDataIntegrityIssue) {
        console.warn('Data integrity issue detected:', {
          technicianId,
          totalEarned,
          totalWithdrawn,
          difference: totalWithdrawn - totalEarned,
          message: 'Total withdrawn exceeds total earned. This may indicate missing commission records.',
        })
        // In this case, available balance should be based on what's actually earned
        // minus what's pending, since we can't withdraw more than we've earned
        availableBalance = totalEarned - pendingWithdrawalAmount
      }

      // Debug logging with detailed information
      console.log('Balance calculation for technician:', technicianId, {
        totalEarned,
        totalWithdrawn,
        pendingWithdrawalAmount,
        availableBalance,
        hasDataIntegrityIssue,
        commissionCount: commissionDetails.length,
        withdrawalCount: withdrawalDetails.length,
        recentCommissions: commissionDetails.map(c => ({
          id: c.id.substring(0, 8),
          amount: c.commission_amount,
          status: c.commission_status,
        })),
        recentWithdrawals: withdrawalDetails.map(w => ({
          id: w.id.substring(0, 8),
          amount: w.amount,
          status: w.withdrawal_status,
        })),
      })

      // Validate calculations
      if (isNaN(totalEarned) || isNaN(totalWithdrawn) || isNaN(pendingWithdrawalAmount)) {
        console.error('Invalid balance calculation - NaN detected:', {
          totalEarned,
          totalWithdrawn,
          pendingWithdrawalAmount,
        })
        return NextResponse.json(
          { error: 'Balance calculation error', details: 'Invalid numeric values detected' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          totalEarned: Math.max(0, totalEarned),
          totalWithdrawn: Math.max(0, totalWithdrawn),
          pendingWithdrawalAmount: Math.max(0, pendingWithdrawalAmount),
          availableBalance: Math.max(0, availableBalance), // Ensure non-negative
          currency: 'TZS',
          // Include warning if data integrity issue detected
          warning: hasDataIntegrityIssue ? 'Some commissions may be missing. Please contact admin.' : undefined,
          // Include breakdown for debugging (can be removed in production)
          _debug: process.env.NODE_ENV === 'development' ? {
            commissionCount: commissionDetails.length,
            withdrawalCount: withdrawalDetails.length,
            hasDataIntegrityIssue,
          } : undefined,
        },
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error fetching technician balance:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
