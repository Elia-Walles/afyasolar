import { and, desc, eq, gte } from "drizzle-orm"
import { db } from "@/lib/db"
import { facilityNotifications } from "@/lib/db/schema"
import { notifyFacilityUsers } from "@/lib/notifications/notification-service"
import type { NormalizedPaymentModel } from "@/lib/efficiency-climate/payment-model"
import { generateId } from "@/lib/utils"

/**
 * Deduped dashboard notification + optional push when efficiency drops materially.
 */
export async function maybeNotifyEnergyUnderperformance(
  facilityId: string,
  ctx: {
    date: string
    produced: number
    expected: number
    paymentModel: NormalizedPaymentModel
  }
): Promise<void> {
  const since = new Date()
  since.setHours(since.getHours() - 20)

  const recent = await db
    .select({ id: facilityNotifications.id })
    .from(facilityNotifications)
    .where(
      and(
        eq(facilityNotifications.facilityId, facilityId),
        eq(facilityNotifications.type, "energy_efficiency_underperformance"),
        gte(facilityNotifications.createdAt, since)
      )
    )
    .orderBy(desc(facilityNotifications.createdAt))
    .limit(1)

  if (recent.length > 0) return

  const title = "Solar output below expected"
  const message = `On ${ctx.date}, production was ${ctx.produced} kWh vs ${ctx.expected} kWh expected. Plan: ${ctx.paymentModel}. Review billing / SLA if applicable.`

  await db.insert(facilityNotifications).values({
    id: generateId(),
    facilityId,
    type: "energy_efficiency_underperformance",
    title,
    message,
    actionUrl: "/services/afya-solar?section=energy-efficiency",
    actionLabel: "View efficiency",
    serviceName: "afya-solar",
    showInDashboard: true,
    sendEmail: false,
    sendSms: false,
    priority: "high",
    createdAt: new Date(),
  })

  await notifyFacilityUsers(facilityId, "energy_efficiency_alert", {
    facilityId,
    date: ctx.date,
    produced: ctx.produced,
    expected: ctx.expected,
    paymentModel: ctx.paymentModel,
  })
}
