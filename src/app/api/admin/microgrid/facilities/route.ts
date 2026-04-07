import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilities } from "@/lib/db/schema"
import {
  afyaSolarMicrogridFacilities,
  afyaSolarMicrogridConsumers,
  afyaSolarFacilityTariffs,
} from "@/lib/db/afya-solar-schema"
import { and, desc, eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/microgrid/facilities
 * Admin overview of microgrid-enabled facilities + consumer counts.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db
    .select({
      id: afyaSolarMicrogridFacilities.id,
      facilityId: afyaSolarMicrogridFacilities.facilityId,
      microgridName: afyaSolarMicrogridFacilities.name,
      status: afyaSolarMicrogridFacilities.status,
      exportCapacityKw: afyaSolarMicrogridFacilities.exportCapacityKw,
      facilityName: facilities.name,
      facilityRegion: facilities.region,
      tariffId: afyaSolarMicrogridFacilities.tariffId,
      tariffCurrency: afyaSolarFacilityTariffs.currency,
      pricePerKwh: afyaSolarFacilityTariffs.pricePerKwh,
      peakPricePerKwh: afyaSolarFacilityTariffs.peakPricePerKwh,
      offPeakPricePerKwh: afyaSolarFacilityTariffs.offPeakPricePerKwh,
      minimumTopUp: afyaSolarFacilityTariffs.minimumTopUp,
      connectionFee: afyaSolarFacilityTariffs.connectionFee,
      consumersCount: sql<number>`COUNT(${afyaSolarMicrogridConsumers.id})`.as("consumersCount"),
      createdAt: afyaSolarMicrogridFacilities.createdAt,
    })
    .from(afyaSolarMicrogridFacilities)
    .leftJoin(facilities, eq(afyaSolarMicrogridFacilities.facilityId, facilities.id))
    .leftJoin(
      afyaSolarFacilityTariffs,
      and(
        eq(afyaSolarFacilityTariffs.facilityId, afyaSolarMicrogridFacilities.facilityId),
        eq(afyaSolarFacilityTariffs.isActive, 1),
      ),
    )
    .leftJoin(
      afyaSolarMicrogridConsumers,
      eq(afyaSolarMicrogridConsumers.microgridFacilityId, afyaSolarMicrogridFacilities.id),
    )
    .groupBy(
      afyaSolarMicrogridFacilities.id,
      facilities.name,
      facilities.region,
      afyaSolarFacilityTariffs.currency,
      afyaSolarFacilityTariffs.pricePerKwh,
      afyaSolarFacilityTariffs.peakPricePerKwh,
      afyaSolarFacilityTariffs.offPeakPricePerKwh,
      afyaSolarFacilityTariffs.minimumTopUp,
      afyaSolarFacilityTariffs.connectionFee,
    )
    .orderBy(desc(afyaSolarMicrogridFacilities.createdAt))

  return NextResponse.json({ success: true, data: rows })
}

