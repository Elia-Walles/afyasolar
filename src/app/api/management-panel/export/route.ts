import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  simulatedFacilities,
  simulatedFacilityMonthlyMetrics,
  simulatedPayments,
} from '@/lib/db/schema'
import { desc, asc, sql, max } from 'drizzle-orm'

const MANAGEMENT_PANEL_EMAIL = 'services@ubuntuafyalink.co.tz'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email.toLowerCase() !== MANAGEMENT_PANEL_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilities = await db
      .select()
      .from(simulatedFacilities)
      .orderBy(desc(simulatedFacilities.installationDate))

    const [statsRow] = await db
      .select({
        totalFacilities: sql<number>`COUNT(*)`,
        totalEnergySavings: sql<number>`COALESCE(SUM(${simulatedFacilities.monthlyEnergySavings}), 0)`,
        totalCostSavings: sql<number>`COALESCE(SUM(${simulatedFacilities.monthlyCostSavings}), 0)`,
        totalCarbonReduction: sql<number>`COALESCE(SUM(${simulatedFacilities.carbonEmissionReduction}), 0)`,
        totalSolarCapacity: sql<number>`COALESCE(SUM(${simulatedFacilities.solarCapacity}), 0)`,
        lastUpdated: max(simulatedFacilities.updatedAt),
      })
      .from(simulatedFacilities)

    const trendRows = await db
      .select({
        yearMonth: simulatedFacilityMonthlyMetrics.yearMonth,
        totalEnergySavings: sql<number>`COALESCE(SUM(${simulatedFacilityMonthlyMetrics.energySavings}), 0)`,
        totalCostSavings: sql<number>`COALESCE(SUM(${simulatedFacilityMonthlyMetrics.costSavings}), 0)`,
      })
      .from(simulatedFacilityMonthlyMetrics)
      .groupBy(simulatedFacilityMonthlyMetrics.yearMonth)
      .orderBy(asc(simulatedFacilityMonthlyMetrics.yearMonth))

    const paymentRows = await db
      .select()
      .from(simulatedPayments)
      .orderBy(desc(simulatedPayments.paymentDate))

    const stats = {
      totalFacilities: Number(statsRow?.totalFacilities ?? 0),
      totalEnergySavings: Number(statsRow?.totalEnergySavings ?? 0),
      totalCostSavings: Number(statsRow?.totalCostSavings ?? 0),
      totalCarbonReduction: Number(statsRow?.totalCarbonReduction ?? 0),
      totalSolarCapacity: Number(statsRow?.totalSolarCapacity ?? 0),
      lastUpdated: statsRow?.lastUpdated ? new Date(statsRow.lastUpdated).toISOString() : null,
    }

    const trend = trendRows.map((r) => ({
      yearMonth: r.yearMonth,
      totalEnergySavings: Number(r.totalEnergySavings),
      totalCostSavings: Number(r.totalCostSavings),
    }))

    const payments = paymentRows.map((p) => ({
      id: p.id,
      facilityName: p.facilityName,
      amount: String(p.amount ?? '0'),
      paymentDate: p.paymentDate,
      periodLabel: p.periodLabel,
      paymentType: p.paymentType,
      status: p.status,
    }))

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      stats,
      facilities: facilities.map((f) => ({
        name: f.name,
        location: f.location,
        region: f.region,
        facilityType: f.facilityType,
        status: f.status,
        installationDate: f.installationDate,
        monthlyEnergySavings: f.monthlyEnergySavings,
        monthlyCostSavings: String(f.monthlyCostSavings ?? '0'),
        carbonEmissionReduction: f.carbonEmissionReduction,
        solarCapacity: f.solarCapacity,
        batteryCapacity: f.batteryCapacity,
      })),
      trend,
      payments,
    })
  } catch (error) {
    console.error('Management panel export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
