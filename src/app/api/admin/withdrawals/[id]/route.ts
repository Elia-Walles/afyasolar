import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { technicianWithdrawals, technicianCommissions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { getRawConnection } from '@/lib/db/index'

export const dynamic = "force-dynamic"
export const revalidate = 0

const updateWithdrawalSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'rejected', 'cancelled']),
  adminNotes: z.string().optional(),
})

/**
 * PATCH /api/admin/withdrawals/[id]
 * Update withdrawal status (admin only)
 * 
 * RECOMMENDATIONS:
 * 1. Use database transactions for atomicity
 * 2. Validate withdrawal amount matches available balance
 * 3. Handle partial commission withdrawals correctly
 * 4. Add rollback on errors
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pool = getRawConnection()
  const connection = await pool.getConnection()

  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      connection.release()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      connection.release()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const withdrawalId = params.id
    const body = await request.json()
    const { status, adminNotes } = updateWithdrawalSchema.parse(body)

    // Start transaction
    await connection.query('START TRANSACTION')

    try {
      // Get current withdrawal
      const [withdrawals] = await connection.query(
        `SELECT id, technician_id, amount, withdrawal_status, admin_notes, processed_at
         FROM technician_withdrawals
         WHERE id = ?
         FOR UPDATE`,
        [withdrawalId]
      ) as any as [Array<{
        id: string
        technician_id: string
        amount: string
        withdrawal_status: string
        admin_notes: string | null
        processed_at: Date | null
      }>, any]

      if (withdrawals.length === 0) {
        await connection.query('ROLLBACK')
        connection.release()
        return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
      }

      const currentWithdrawal = withdrawals[0]

      // Update withdrawal status
      await connection.query(
        `UPDATE technician_withdrawals
         SET withdrawal_status = ?,
             admin_notes = ?,
             processed_at = ?,
             processed_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          status,
          adminNotes || currentWithdrawal.admin_notes || null,
          status === 'completed' || status === 'rejected' ? new Date() : currentWithdrawal.processed_at,
          session.user.id,
          withdrawalId,
        ]
      )

      // If status is 'completed', mark related commissions as 'withdrawn'
      if (status === 'completed') {
        const technicianId = currentWithdrawal.technician_id
        const withdrawalAmount = Number(currentWithdrawal.amount)

        // Get earned commissions ordered by earned_at (oldest first) - FIFO
        const [earnedCommissions] = await connection.query(
          `SELECT id, commission_amount, commission_status
           FROM technician_commissions
           WHERE technician_id = ? AND commission_status = 'earned'
           ORDER BY earned_at ASC
           FOR UPDATE`,
          [technicianId]
        ) as any as [Array<{
          id: string
          commission_amount: string
          commission_status: string
        }>, any]

        // Mark commissions as withdrawn until we've covered the withdrawal amount
        let remainingAmount = withdrawalAmount
        const updatedCommissionIds: string[] = []

        for (const commission of earnedCommissions) {
          if (remainingAmount <= 0) break

          const commissionAmount = Number(commission.commission_amount)
          
          // Update commission status
          await connection.query(
            `UPDATE technician_commissions
             SET commission_status = 'withdrawn',
                 withdrawn_at = CURRENT_TIMESTAMP,
                 withdrawal_id = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [withdrawalId, commission.id]
          )

          updatedCommissionIds.push(commission.id)
          remainingAmount -= commissionAmount
        }

        // Validate that we covered the full withdrawal amount
        if (remainingAmount > 0.01) { // Allow small rounding differences
          console.warn('Withdrawal amount not fully covered by commissions:', {
            withdrawalId,
            withdrawalAmount,
            remainingAmount,
            updatedCommissions: updatedCommissionIds.length,
          })
          // Don't fail - log warning but allow the transaction
        }

        console.log('Commissions marked as withdrawn:', {
          withdrawalId,
          technicianId,
          withdrawalAmount,
          commissionsUpdated: updatedCommissionIds.length,
          commissionIds: updatedCommissionIds.map(id => id.substring(0, 8)),
        })
      }

      // If status is 'rejected' or 'cancelled', ensure commissions remain as 'earned'
      if (status === 'rejected' || status === 'cancelled') {
        // Check if any commissions were already marked as withdrawn for this withdrawal
        const [withdrawnCommissions] = await connection.query(
          `SELECT id FROM technician_commissions
           WHERE withdrawal_id = ? AND commission_status = 'withdrawn'`,
          [withdrawalId]
        ) as any as [Array<{ id: string }>, any]

        if (withdrawnCommissions.length > 0) {
          // Revert commissions back to 'earned' status
          await connection.query(
            `UPDATE technician_commissions
             SET commission_status = 'earned',
                 withdrawn_at = NULL,
                 withdrawal_id = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE withdrawal_id = ?`,
            [withdrawalId]
          )

          console.log('Commissions reverted to earned status:', {
            withdrawalId,
            commissionsReverted: withdrawnCommissions.length,
          })
        }
      }

      // Commit transaction
      await connection.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Withdrawal status updated successfully',
      })
    } catch (error) {
      // Rollback on error
      await connection.query('ROLLBACK')
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error updating withdrawal:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
