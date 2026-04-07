import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilityEfficiencyDaily, facilities } from "@/lib/db/schema"
import { ensureEfficiencyClimateTables } from "@/lib/db/ensure-efficiency-climate-tables"
import { simulateEfficiencySeries } from "@/lib/efficiency-climate/simulation"
import { billingContextForEfficiency, getFacilityPaymentModel } from "@/lib/efficiency-climate/payment-model"
import { eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/facilities/[facilityId]/efficiency-daily-seed
 * Writes simulated daily efficiency rows to DB for demos (admin only).
 * Body optional: { days?: number, solarCapacityKw?: number, replace?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { facilityId } = await params
    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    const [exists] = await db.select({ id: facilities.id }).from(facilities).where(eq(facilities.id, facilityId)).limit(1)
    if (!exists) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const days = Math.min(90, Math.max(7, Number(body.days) || 30))
    const solarCapacityKw = Number(body.solarCapacityKw) || 5
    const replace = body.replace !== false

    await ensureEfficiencyClimateTables()

    if (replace) {
      await db.delete(facilityEfficiencyDaily).where(eq(facilityEfficiencyDaily.facilityId, facilityId))
    }

    const paymentModel = await getFacilityPaymentModel(facilityId)
    const series = simulateEfficiencySeries(facilityId, days, solarCapacityKw)

    for (const row of series) {
      await db.insert(facilityEfficiencyDaily).values({
        id: generateId(),
        facilityId,
        snapshotDate: row.snapshotDate,
        producedKwh: String(row.producedKwh),
        consumedKwh: String(row.consumedKwh),
        expectedKwh: String(row.expectedKwh),
        avgIrradianceWm2: String(row.avgIrradianceWm2),
        performanceRatio: String(row.performanceRatio),
        degradationYearlyPct: String(row.degradationYearlyPct),
        efficiencyPct: String(row.efficiencyPct),
        underperforming: row.underperforming,
        paymentModelSnapshot: paymentModel,
        billingNote: billingContextForEfficiency(paymentModel, row.underperforming),
        dataSource: "simulated",
      })
    }

    return NextResponse.json({
      success: true,
      inserted: series.length,
      facilityId,
    })
  } catch (error) {
    console.error("[efficiency-daily-seed]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
