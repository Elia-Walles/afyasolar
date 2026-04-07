import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { simulatedFacilities } from '@/lib/db/schema'
import { desc, sql, max } from 'drizzle-orm'

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
        averageEnergyReduction: sql<number>`COALESCE(AVG(CASE WHEN ${simulatedFacilities.energyConsumptionBefore} > 0 THEN (${simulatedFacilities.monthlyEnergySavings} * 100.0 / ${simulatedFacilities.energyConsumptionBefore}) ELSE 0 END), 0)`,
        averageCostReduction: sql<number>`COALESCE(AVG(CASE WHEN ${simulatedFacilities.electricityCostBefore} > 0 THEN (${simulatedFacilities.monthlyCostSavings} * 100.0 / ${simulatedFacilities.electricityCostBefore}) ELSE 0 END), 0)`,
        lastUpdated: max(simulatedFacilities.updatedAt),
      })
      .from(simulatedFacilities)

    const stats = {
      totalFacilities: Number(statsRow?.totalFacilities ?? 0),
      totalEnergySavings: Number(statsRow?.totalEnergySavings ?? 0),
      totalCostSavings: Number(statsRow?.totalCostSavings ?? 0),
      totalCarbonReduction: Number(statsRow?.totalCarbonReduction ?? 0),
      totalSolarCapacity: Number(statsRow?.totalSolarCapacity ?? 0),
      averageEnergyReduction: Math.round(Number(statsRow?.averageEnergyReduction ?? 0)),
      averageCostReduction: Math.round(Number(statsRow?.averageCostReduction ?? 0)),
    }
    const lastUpdated = statsRow?.lastUpdated ? new Date(statsRow.lastUpdated).toISOString() : null

    const formattedFacilities = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      location: f.location,
      region: f.region,
      status: f.status,
      solarStatus: f.solarStatus,
      paygStatus: f.paygStatus,
      installationDate: f.installationDate,
      paygOperationalDate: f.paygOperationalDate,
      energyConsumptionBefore: f.energyConsumptionBefore,
      energyConsumptionAfter: f.energyConsumptionAfter,
      monthlyEnergySavings: f.monthlyEnergySavings,
      electricityCostBefore: String(f.electricityCostBefore ?? '0'),
      electricityCostAfter: String(f.electricityCostAfter ?? '0'),
      monthlyCostSavings: String(f.monthlyCostSavings ?? '0'),
      carbonEmissionReduction: f.carbonEmissionReduction,
      solarCapacity: f.solarCapacity,
      batteryCapacity: f.batteryCapacity,
      smartMeterSerial: f.smartMeterSerial,
      facilityType: f.facilityType,
      notes: f.notes ?? '',
    }))

    return NextResponse.json({
      facilities: formattedFacilities,
      stats,
      lastUpdated,
    })
  } catch (error) {
    console.error('Management panel facilities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch facilities data' },
      { status: 500 }
    )
  }
}
