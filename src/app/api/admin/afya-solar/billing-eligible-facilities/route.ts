import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilities, serviceSubscriptions, serviceAccessPayments } from "@/lib/db/schema"
import { afyaSolarSubscribers } from "@/lib/db/afyasolar-subscribers-schema"
import { and, eq, gte, isNull, or, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Facilities eligible for Afya Solar admin billing: active facility, active non-expired
 * Afya Solar subscription, and at least one completed service_access_payment for afya-solar.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const service = "afya-solar"

    const rows = await db
      .select({
        facilityId: serviceSubscriptions.facilityId,
        facilityName: facilities.name,
        city: facilities.city,
        region: facilities.region,
        solarPackageName: afyaSolarSubscribers.packageName,
        solarPlanType: afyaSolarSubscribers.planType,
        hasCompletedSolarAccessPayment: sql<boolean>`EXISTS (
          SELECT 1
          FROM ${serviceAccessPayments}
          WHERE ${serviceAccessPayments.facilityId} = ${facilities.id}
            AND ${serviceAccessPayments.serviceName} = 'afya-solar'
            AND ${serviceAccessPayments.status} = 'completed'
        )`,
        lastCompletedPaidAt: sql<Date | null>`(
          SELECT MAX(${serviceAccessPayments.paidAt})
          FROM ${serviceAccessPayments}
          WHERE ${serviceAccessPayments.facilityId} = ${facilities.id}
            AND ${serviceAccessPayments.serviceName} = 'afya-solar'
            AND ${serviceAccessPayments.status} = 'completed'
        )`,
      })
      .from(serviceSubscriptions)
      .innerJoin(facilities, eq(serviceSubscriptions.facilityId, facilities.id))
      .leftJoin(afyaSolarSubscribers, eq(afyaSolarSubscribers.facilityId, facilities.id))
      .where(
        and(
          eq(facilities.status, "active"),
          eq(serviceSubscriptions.serviceName, service),
          eq(serviceSubscriptions.status, "active"),
          or(isNull(serviceSubscriptions.expiryDate), gte(serviceSubscriptions.expiryDate, now))
        )
      )
      .orderBy(
        sql`EXISTS (
          SELECT 1
          FROM ${serviceAccessPayments}
          WHERE ${serviceAccessPayments.facilityId} = ${facilities.id}
            AND ${serviceAccessPayments.serviceName} = 'afya-solar'
            AND ${serviceAccessPayments.status} = 'completed'
        ) DESC`,
        facilities.name
      )

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error fetching billing-eligible facilities:", error)
    return NextResponse.json({ error: "Failed to fetch billing-eligible facilities" }, { status: 500 })
  }
}
