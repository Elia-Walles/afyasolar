import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { admins, facilities, paymentTransactions, users } from "@/lib/db/schema"
import { deviceAlerts, deviceHealth } from "@/lib/db/schema-telemetry"
import { and, eq, gte, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

type OverviewResponse = {
  asOf: string
  kpis: {
    facilitiesTotal: number
    facilitiesActive: number
    usersTotal: number
    usersFacility: number
    usersAdmin: number
    devicesTotal: number
    devicesOnline: number
    activeAlerts: number
    criticalAlerts: number
    revenueTotalCompleted: number
    revenue30dCompleted: number
    transactions30d: {
      total: number
      completed: number
      failed: number
      pending: number
    }
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [facilitiesTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(facilities)
    const [facilitiesActiveRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilities)
      .where(eq(facilities.status, "active"))

    const [usersTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(users)
    const [adminsTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(admins)
    const [usersFacilityRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "facility"))
    const [usersAdminRow] = await db.select({ count: sql<number>`count(*)` }).from(admins)

    const [devicesTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(deviceHealth)
    const [devicesOnlineRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deviceHealth)
      .where(eq(deviceHealth.onlineStatus, true))

    const [activeAlertsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deviceAlerts)
      .where(eq(deviceAlerts.status, "active"))
    const [criticalAlertsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deviceAlerts)
      .where(and(eq(deviceAlerts.status, "active"), eq(deviceAlerts.severity, "critical")))

    const [revenueTotalRow] = await db
      .select({ amount: sql<number>`coalesce(sum(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, "completed"))
    const [revenue30dRow] = await db
      .select({ amount: sql<number>`coalesce(sum(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(and(eq(paymentTransactions.status, "completed"), gte(paymentTransactions.createdAt, from30d)))

    const txStatusAgg = await db
      .select({
        status: paymentTransactions.status,
        count: sql<number>`count(*)`,
        amount: sql<number>`coalesce(sum(${paymentTransactions.amount}), 0)`,
      })
      .from(paymentTransactions)
      .where(gte(paymentTransactions.createdAt, from30d))
      .groupBy(paymentTransactions.status)

    const statusCounts = txStatusAgg.reduce(
      (acc, row) => {
        acc.total += Number(row.count || 0)
        const s = String(row.status || "")
        const c = Number(row.count || 0)
        if (s === "completed") acc.completed += c
        else if (s === "failed") acc.failed += c
        else if (["pending", "processing", "awaiting_confirmation", "initiated"].includes(s)) acc.pending += c
        return acc
      },
      { total: 0, completed: 0, failed: 0, pending: 0 }
    )

    const response: OverviewResponse = {
      asOf: now.toISOString(),
      kpis: {
        facilitiesTotal: Number(facilitiesTotalRow?.count || 0),
        facilitiesActive: Number(facilitiesActiveRow?.count || 0),
        usersTotal: Number(usersTotalRow?.count || 0) + Number(adminsTotalRow?.count || 0),
        usersFacility: Number(usersFacilityRow?.count || 0),
        usersAdmin: Number(usersAdminRow?.count || 0),
        devicesTotal: Number(devicesTotalRow?.count || 0),
        devicesOnline: Number(devicesOnlineRow?.count || 0),
        activeAlerts: Number(activeAlertsRow?.count || 0),
        criticalAlerts: Number(criticalAlertsRow?.count || 0),
        revenueTotalCompleted: Number(revenueTotalRow?.amount || 0),
        revenue30dCompleted: Number(revenue30dRow?.amount || 0),
        transactions30d: statusCounts,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error building admin overview:", error)
    return NextResponse.json({ error: "Failed to build overview" }, { status: 500 })
  }
}

