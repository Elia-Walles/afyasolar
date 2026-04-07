import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { getRawConnection } from '@/lib/db/index'
import { randomUUID } from 'crypto'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/fix-commissions
 * Backfill missing commissions for completed maintenance requests
 * This fixes cases where payments were completed but commissions weren't created
 * (e.g., because commissionPercentage was null or not set)
 * 
 * ADMIN ONLY - Use with caution
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { technicianId, commissionPercentage } = body

    if (!technicianId || !commissionPercentage) {
      return NextResponse.json(
        { error: 'technicianId and commissionPercentage are required' },
        { status: 400 }
      )
    }

    const pool = getRawConnection()
    const connection = await pool.getConnection()

    try {
      // Find completed maintenance requests for this technician that don't have commissions
      const [requestsWithoutCommissions] = await connection.query(
        `SELECT 
          mr.id,
          mr.assigned_technician_id,
          mr.commission_percentage,
          mr.total_cost,
          mr.final_payment_amount,
          mr.status,
          mr.final_payment_status,
          mr.payment_completed_at
         FROM maintenance_requests mr
         LEFT JOIN technician_commissions tc ON mr.id = tc.maintenance_request_id
         WHERE mr.assigned_technician_id = ?
           AND mr.status = 'completed'
           AND mr.final_payment_status = 'paid'
           AND mr.payment_completed_at IS NOT NULL
           AND tc.id IS NULL
         ORDER BY mr.payment_completed_at DESC`,
        [technicianId]
      ) as any as [Array<{
        id: string
        assigned_technician_id: string
        commission_percentage: string | null
        total_cost: string
        final_payment_amount: string | null
        status: string
        final_payment_status: string
        payment_completed_at: Date
      }>, any]

      const createdCommissions: Array<{
        requestId: string
        commissionAmount: number
      }> = []

      for (const req of requestsWithoutCommissions) {
        // Use provided commissionPercentage or the one from the request
        const percentage = commissionPercentage || Number(req.commission_percentage || 0)
        
        if (percentage <= 0) {
          continue // Skip if no commission percentage
        }

        const totalPaymentAmount = Number(req.final_payment_amount || req.total_cost || 0)
        const commissionAmount = (totalPaymentAmount * percentage) / 100

        if (commissionAmount > 0) {
          const commissionId = randomUUID()
          await connection.query(
            `INSERT INTO technician_commissions 
             (id, technician_id, maintenance_request_id, commission_percentage, 
              total_payment_amount, commission_amount, currency, commission_status, earned_at)
             VALUES (?, ?, ?, ?, ?, ?, 'TZS', 'earned', ?)`,
            [
              commissionId,
              technicianId,
              req.id,
              String(percentage),
              String(totalPaymentAmount),
              String(commissionAmount),
              req.payment_completed_at,
            ]
          )

          createdCommissions.push({
            requestId: req.id.substring(0, 8),
            commissionAmount,
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Created ${createdCommissions.length} missing commissions`,
        data: {
          commissionsCreated: createdCommissions.length,
          commissions: createdCommissions,
        },
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error fixing commissions:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
