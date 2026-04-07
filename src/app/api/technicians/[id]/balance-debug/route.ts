import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { resolveTechnicianId } from '@/lib/auth/technician'
import { getRawConnection } from '@/lib/db/index'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/technicians/[id]/balance-debug
 * Debug endpoint to see detailed balance breakdown
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

    const pool = getRawConnection()
    const connection = await pool.getConnection()

    try {
      // Get all commissions with details
      const [allCommissions] = await connection.query(
        `SELECT 
          id,
          maintenance_request_id,
          commission_percentage,
          total_payment_amount,
          commission_amount,
          commission_status,
          earned_at,
          withdrawn_at,
          withdrawal_id
         FROM technician_commissions
         WHERE technician_id = ?
         ORDER BY earned_at DESC`,
        [technicianId]
      ) as any as [Array<{
        id: string
        maintenance_request_id: string
        commission_percentage: string
        total_payment_amount: string
        commission_amount: string
        commission_status: string
        earned_at: Date
        withdrawn_at: Date | null
        withdrawal_id: string | null
      }>, any]

      // Get all withdrawals
      const [allWithdrawals] = await connection.query(
        `SELECT 
          id,
          amount,
          withdrawal_status,
          created_at,
          processed_at
         FROM technician_withdrawals
         WHERE technician_id = ?
         ORDER BY created_at DESC`,
        [technicianId]
      ) as any as [Array<{
        id: string
        amount: string
        withdrawal_status: string
        created_at: Date
        processed_at: Date | null
      }>, any]

      // Calculate breakdown
      const earnedCommissions = allCommissions.filter(c => c.commission_status === 'earned')
      const withdrawnCommissions = allCommissions.filter(c => c.commission_status === 'withdrawn')
      const pendingCommissions = allCommissions.filter(c => c.commission_status === 'pending')

      const pendingWithdrawals = allWithdrawals.filter(w => w.withdrawal_status === 'pending')
      const completedWithdrawals = allWithdrawals.filter(w => w.withdrawal_status === 'completed')

      const totalEarned = earnedCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0)
      const totalWithdrawn = withdrawnCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0)
      const pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0)
      const availableBalance = totalEarned - totalWithdrawn - pendingWithdrawalAmount

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalEarned,
            totalWithdrawn,
            pendingWithdrawalAmount,
            availableBalance: Math.max(0, availableBalance),
          },
          commissions: {
            total: allCommissions.length,
            earned: earnedCommissions.length,
            withdrawn: withdrawnCommissions.length,
            pending: pendingCommissions.length,
            details: allCommissions.map(c => ({
              id: c.id.substring(0, 8),
              requestId: c.maintenance_request_id?.substring(0, 8),
              amount: c.commission_amount,
              status: c.commission_status,
              earnedAt: c.earned_at,
              withdrawnAt: c.withdrawn_at,
              withdrawalId: c.withdrawal_id?.substring(0, 8),
            })),
          },
          withdrawals: {
            total: allWithdrawals.length,
            pending: pendingWithdrawals.length,
            completed: completedWithdrawals.length,
            details: allWithdrawals.map(w => ({
              id: w.id.substring(0, 8),
              amount: w.amount,
              status: w.withdrawal_status,
              createdAt: w.created_at,
              processedAt: w.processed_at,
            })),
          },
        },
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error in balance debug:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
