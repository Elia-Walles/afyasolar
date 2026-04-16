import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarDesignReports } from '@/lib/db/afya-solar-schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId')

    if (!facilityId) {
      return NextResponse.json({ error: 'facilityId is required' }, { status: 400 })
    }

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch the latest design report for the facility
    const reports = await db
      .select({
        id: afyaSolarDesignReports.id,
        facilityId: afyaSolarDesignReports.facilityId,
        facilityName: afyaSolarDesignReports.facilityName,
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
      .where(eq(afyaSolarDesignReports.facilityId, facilityId))
      .orderBy(desc(afyaSolarDesignReports.createdAt))
      .limit(1)

    if (reports.length === 0) {
      return NextResponse.json({ success: true, data: null })
    }

    const report = reports[0]

    return NextResponse.json({
      success: true,
      data: {
        id: report.id,
        facilityId: report.facilityId,
        facilityName: report.facilityName,
        pvSizeKw: report.pvSizeKw,
        batteryKwh: report.batteryKwh,
        grossMonthlySavings: report.grossMonthlySavings,
        totalDailyEnergyKwh: report.totalDailyEnergyKwh,
        criticalEnergyKwh: report.criticalEnergyKwh,
        adjustedDailyEnergyKwh: report.adjustedDailyEnergyKwh,
        numPanels: report.numPanels,
        batteryAh: report.batteryAh,
        inverterKw: report.inverterKw,
        mpptCurrentA: report.mpptCurrentA,
        baselineGridMonthly: report.baselineGridMonthly,
        baselineDieselMonthly: report.baselineDieselMonthly,
        baselineTotalMonthly: report.baselineTotalMonthly,
        afterGridMonthly: report.afterGridMonthly,
        afterDieselMonthly: report.afterDieselMonthly,
        afterTotalMonthly: report.afterTotalMonthly,
        cashPriceTzs: report.cashPriceTzs,
        cashPaybackMonths: report.cashPaybackMonths,
        installmentUpfrontTzs: report.installmentUpfrontTzs,
        installmentMonthlyTzs: report.installmentMonthlyTzs,
        installmentTermMonths: report.installmentTermMonths,
        installmentNetSavingsTzs: report.installmentNetSavingsTzs,
        installmentBreakevenMonths: report.installmentBreakevenMonths,
        eaasMonthlyTzs: report.eaasMonthlyTzs,
        eaasTermMonths: report.eaasTermMonths,
        eaasNetSavingsTzs: report.eaasNetSavingsTzs,
        meuTotalDailyLoadKwh: report.meuTotalDailyLoadKwh,
        payloadJson: report.payloadJson,
        createdAt: report.createdAt,
      },
    })
  } catch (error) {
    console.error('Error fetching latest Afya Solar design report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
