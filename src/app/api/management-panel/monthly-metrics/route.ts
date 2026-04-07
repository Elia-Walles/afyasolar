import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { simulatedFacilityMonthlyMetrics } from '@/lib/db/schema'
import { asc, sql } from 'drizzle-orm'

const MANAGEMENT_PANEL_EMAIL = 'services@ubuntuafyalink.co.tz'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email.toLowerCase() !== MANAGEMENT_PANEL_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await db
      .select({
        yearMonth: simulatedFacilityMonthlyMetrics.yearMonth,
        totalEnergySavings: sql<number>`COALESCE(SUM(${simulatedFacilityMonthlyMetrics.energySavings}), 0)`,
        totalCostSavings: sql<number>`COALESCE(SUM(${simulatedFacilityMonthlyMetrics.costSavings}), 0)`,
      })
      .from(simulatedFacilityMonthlyMetrics)
      .groupBy(simulatedFacilityMonthlyMetrics.yearMonth)
      .orderBy(asc(simulatedFacilityMonthlyMetrics.yearMonth))

    const trend = rows.map((r) => ({
      yearMonth: r.yearMonth,
      totalEnergySavings: Number(r.totalEnergySavings),
      totalCostSavings: Number(r.totalCostSavings),
    }))

    return NextResponse.json({ trend })
  } catch (error) {
    console.error('Management panel monthly metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monthly metrics' },
      { status: 500 }
    )
  }
}
