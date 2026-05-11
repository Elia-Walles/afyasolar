import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import {
  getFacilityContracts,
  getFacilityRepaymentSchedule,
} from '@/lib/payg-financing/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/facility/payg-financing/summary
 * Returns the facility's own PAYG & Financing contracts, repayment schedule, and KPIs.
 * Strictly scoped to session.user.facilityId.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const [contracts, schedule] = await Promise.all([
      getFacilityContracts(facilityId),
      getFacilityRepaymentSchedule(facilityId),
    ])

    const now = Date.now()
    let totalOutstanding = 0
    for (const c of contracts) {
      totalOutstanding += Number(c.outstandingBalance) || 0
    }

    const pending = schedule
      .filter((e) => e.status !== 'paid')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    const next = pending[0] || null
    const overdueCount = pending.filter(
      (e) => new Date(e.dueDate).getTime() < now,
    ).length

    return NextResponse.json({
      contracts,
      schedule,
      kpis: {
        totalOutstanding: +totalOutstanding.toFixed(2),
        nextDueAmount: next ? Number(next.amount) : 0,
        nextDueDate: next ? next.dueDate : null,
        overdueCount,
        activeContracts: contracts.filter((c) => c.status === 'active').length,
      },
    })
  } catch (error) {
    console.error('[PAYG Summary] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
