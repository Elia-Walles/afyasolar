import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilities } from "@/lib/db/schema"
import {
  afyaSolarMicrogridConsumers,
  afyaSolarMicrogridFacilities,
  afyaSolarSmartmeters,
} from "@/lib/db/afya-solar-schema"
import { and, desc, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/microgrid/consumers?facilityId=<uuid>
 * Admin list of microgrid consumers, optionally filtered by facility.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const facilityId = searchParams.get("facilityId") || undefined

  const where = facilityId ? eq(afyaSolarMicrogridFacilities.facilityId, facilityId) : undefined

  const rows = await db
    .select({
      id: afyaSolarMicrogridConsumers.id,
      consumerCode: afyaSolarMicrogridConsumers.consumerCode,
      name: afyaSolarMicrogridConsumers.name,
      type: afyaSolarMicrogridConsumers.type,
      phoneNumber: afyaSolarMicrogridConsumers.phoneNumber,
      address: afyaSolarMicrogridConsumers.address,
      tariffRate: afyaSolarMicrogridConsumers.tariffRate,
      creditBalance: afyaSolarMicrogridConsumers.creditBalance,
      outstandingBalance: afyaSolarMicrogridConsumers.outstandingBalance,
      status: afyaSolarMicrogridConsumers.status,
      microgridFacilityId: afyaSolarMicrogridConsumers.microgridFacilityId,
      parentFacilityId: afyaSolarMicrogridFacilities.facilityId,
      microgridName: afyaSolarMicrogridFacilities.name,
      parentFacilityName: facilities.name,
      smartmeterId: afyaSolarMicrogridConsumers.smartmeterId,
      meterSerial: afyaSolarSmartmeters.meterSerial,
      lastSeenAt: afyaSolarSmartmeters.lastSeenAt,
      createdAt: afyaSolarMicrogridConsumers.createdAt,
    })
    .from(afyaSolarMicrogridConsumers)
    .leftJoin(
      afyaSolarMicrogridFacilities,
      eq(afyaSolarMicrogridConsumers.microgridFacilityId, afyaSolarMicrogridFacilities.id),
    )
    .leftJoin(facilities, eq(afyaSolarMicrogridFacilities.facilityId, facilities.id))
    .leftJoin(
      afyaSolarSmartmeters,
      and(eq(afyaSolarMicrogridConsumers.smartmeterId, afyaSolarSmartmeters.id)),
    )
    .where(where)
    .orderBy(desc(afyaSolarMicrogridConsumers.createdAt))

  return NextResponse.json({ success: true, data: rows })
}

