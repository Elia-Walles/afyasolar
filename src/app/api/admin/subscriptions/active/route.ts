import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilities, serviceSubscriptions } from "@/lib/db/schema"
import { afyaSolarSubscribers } from "@/lib/db/afyasolar-subscribers-schema"
import { and, eq, gte, isNull, or, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get("service") || "afya-solar"

    const now = new Date()

    const rows = await db
      .select({
        facilityId: serviceSubscriptions.facilityId,
        facilityName: facilities.name,
        facilityPhone: facilities.phone,
        facilityEmail: facilities.email,
        region: facilities.region,
        city: facilities.city,
        status: facilities.status,
        subscriptionStatus: serviceSubscriptions.status,
        expiryDate: serviceSubscriptions.expiryDate,
        billingCycle: serviceSubscriptions.billingCycle,
        planType: serviceSubscriptions.planType,
        createdAt: serviceSubscriptions.createdAt,
        solarPackageName: afyaSolarSubscribers.packageName,
        solarPlanType: afyaSolarSubscribers.planType,
      })
      .from(serviceSubscriptions)
      .innerJoin(facilities, eq(serviceSubscriptions.facilityId, facilities.id))
      .leftJoin(afyaSolarSubscribers, eq(afyaSolarSubscribers.facilityId, facilities.id))
      .where(
        and(
          eq(serviceSubscriptions.serviceName, service),
          eq(serviceSubscriptions.status, "active"),
          or(isNull(serviceSubscriptions.expiryDate), gte(serviceSubscriptions.expiryDate, now))
        )
      )
      .orderBy(sql`coalesce(${serviceSubscriptions.expiryDate}, '9999-12-31') asc`)

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error fetching active subscriptions:", error)
    return NextResponse.json({ error: "Failed to fetch active subscriptions" }, { status: 500 })
  }
}

