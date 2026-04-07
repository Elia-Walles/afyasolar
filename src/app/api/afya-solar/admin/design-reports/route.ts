import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarDesignReports } from '@/lib/db/afya-solar-schema'
import { facilities } from '@/lib/db/schema'
import { desc, eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const facilityId = searchParams.get('facilityId')
    const offset = (page - 1) * limit

    const conditions = []
    if (facilityId) {
      conditions.push(eq(afyaSolarDesignReports.facilityId, facilityId))
    }
    const where = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select({
        id: afyaSolarDesignReports.id,
        facilityId: afyaSolarDesignReports.facilityId,
        // Prefer the live facility name when available; fall back to the stored name.
        facilityName: facilities.name,
        storedFacilityName: afyaSolarDesignReports.facilityName,
        pvSizeKw: afyaSolarDesignReports.pvSizeKw,
        batteryKwh: afyaSolarDesignReports.batteryKwh,
        grossMonthlySavings: afyaSolarDesignReports.grossMonthlySavings,
        totalDailyEnergyKwh: afyaSolarDesignReports.totalDailyEnergyKwh,
        criticalEnergyKwh: afyaSolarDesignReports.criticalEnergyKwh,
        adjustedDailyEnergyKwh: afyaSolarDesignReports.adjustedDailyEnergyKwh,
        numPanels: afyaSolarDesignReports.numPanels,
        batteryAh: afyaSolarDesignReports.batteryAh,
        inverterKw: afyaSolarDesignReports.inverterKw,
        mpptCurrentA: afyaSolarDesignReports.mpptCurrentA,
        baselineGridMonthly: afyaSolarDesignReports.baselineGridMonthly,
        baselineDieselMonthly: afyaSolarDesignReports.baselineDieselMonthly,
        baselineTotalMonthly: afyaSolarDesignReports.baselineTotalMonthly,
        afterGridMonthly: afyaSolarDesignReports.afterGridMonthly,
        afterDieselMonthly: afyaSolarDesignReports.afterDieselMonthly,
        afterTotalMonthly: afyaSolarDesignReports.afterTotalMonthly,
        cashPriceTzs: afyaSolarDesignReports.cashPriceTzs,
        cashPaybackMonths: afyaSolarDesignReports.cashPaybackMonths,
        installmentUpfrontTzs: afyaSolarDesignReports.installmentUpfrontTzs,
        installmentMonthlyTzs: afyaSolarDesignReports.installmentMonthlyTzs,
        installmentTermMonths: afyaSolarDesignReports.installmentTermMonths,
        installmentNetSavingsTzs: afyaSolarDesignReports.installmentNetSavingsTzs,
        installmentBreakevenMonths: afyaSolarDesignReports.installmentBreakevenMonths,
        eaasMonthlyTzs: afyaSolarDesignReports.eaasMonthlyTzs,
        eaasTermMonths: afyaSolarDesignReports.eaasTermMonths,
        eaasNetSavingsTzs: afyaSolarDesignReports.eaasNetSavingsTzs,
        meuTotalDailyLoadKwh: afyaSolarDesignReports.meuTotalDailyLoadKwh,
        payloadJson: afyaSolarDesignReports.payloadJson,
        createdAt: afyaSolarDesignReports.createdAt,
      })
      .from(afyaSolarDesignReports)
      .leftJoin(facilities, eq(afyaSolarDesignReports.facilityId, facilities.id))
      .where(where)
      .orderBy(desc(afyaSolarDesignReports.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        facilityId: row.facilityId,
        facilityName: row.facilityName || row.storedFacilityName || null,
        pvSizeKw: row.pvSizeKw,
        batteryKwh: row.batteryKwh,
        grossMonthlySavings: row.grossMonthlySavings,
        totalDailyEnergyKwh: row.totalDailyEnergyKwh,
        criticalEnergyKwh: row.criticalEnergyKwh,
        adjustedDailyEnergyKwh: row.adjustedDailyEnergyKwh,
        numPanels: row.numPanels,
        batteryAh: row.batteryAh,
        inverterKw: row.inverterKw,
        mpptCurrentA: row.mpptCurrentA,
        baselineGridMonthly: row.baselineGridMonthly,
        baselineDieselMonthly: row.baselineDieselMonthly,
        baselineTotalMonthly: row.baselineTotalMonthly,
        afterGridMonthly: row.afterGridMonthly,
        afterDieselMonthly: row.afterDieselMonthly,
        afterTotalMonthly: row.afterTotalMonthly,
        cashPriceTzs: row.cashPriceTzs,
        cashPaybackMonths: row.cashPaybackMonths,
        installmentUpfrontTzs: row.installmentUpfrontTzs,
        installmentMonthlyTzs: row.installmentMonthlyTzs,
        installmentTermMonths: row.installmentTermMonths,
        installmentNetSavingsTzs: row.installmentNetSavingsTzs,
        installmentBreakevenMonths: row.installmentBreakevenMonths,
        eaasMonthlyTzs: row.eaasMonthlyTzs,
        eaasTermMonths: row.eaasTermMonths,
        eaasNetSavingsTzs: row.eaasNetSavingsTzs,
        meuTotalDailyLoadKwh: row.meuTotalDailyLoadKwh,
        payloadJson: row.payloadJson,
        createdAt: row.createdAt,
      })),
      page,
      limit,
    })
  } catch (error) {
    console.error('Error fetching Afya Solar design reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

