export const dynamic = "force-dynamic"
export const revalidate = 0

import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { afyaSolarSubscribers } from "@/lib/db/afyasolar-subscribers-schema"
import { afyaSolarInvoiceRequests, facilities, serviceAccessPayments } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { randomUUID } from "crypto"
import { FacilityDashboard } from "@/components/dashboard/facility-dashboard"
import { SolarPackagesSelection } from "@/components/solar/solar-packages-selection"
import { AfyaSolarDashboardWithPendingModal } from "@/components/afya-solar/dashboard-with-pending-invoice-modal"

async function getAfyaSolarSubscriber(facilityId: string) {
  try {
    const subscribers = await db
      .select()
      .from(afyaSolarSubscribers)
      .where(eq(afyaSolarSubscribers.facilityId, facilityId))
      .orderBy(desc(afyaSolarSubscribers.createdAt))
      .limit(1)

    return subscribers[0] ?? null
  } catch (error) {
    console.error("Error fetching Afya Solar subscriber:", error)
    return null
  }
}

async function hasPaidAfyaSolarInvoice(facilityId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: afyaSolarInvoiceRequests.id })
      .from(afyaSolarInvoiceRequests)
      .where(
        and(
          eq(afyaSolarInvoiceRequests.facilityId, facilityId),
          eq(afyaSolarInvoiceRequests.status, "paid")
        )
      )
      .limit(1)

    return rows.length > 0
  } catch (error) {
    console.error("Error checking paid Afya Solar invoice:", error)
    return false
  }
}

async function hasCompletedAfyaSolarServicePayment(facilityId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: serviceAccessPayments.id })
      .from(serviceAccessPayments)
      .where(
        and(
          eq(serviceAccessPayments.facilityId, facilityId),
          eq(serviceAccessPayments.serviceName, "afya-solar"),
          eq(serviceAccessPayments.status, "completed")
        )
      )
      .limit(1)

    return rows.length > 0
  } catch (error) {
    console.error("Error checking Afya Solar service access payments:", error)
    return false
  }
}

async function ensureAfyaSolarServiceAccessPayment(
  facilityId: string,
  subscriber: typeof afyaSolarSubscribers.$inferSelect
) {
  try {
    const existing = await db
      .select({ id: serviceAccessPayments.id })
      .from(serviceAccessPayments)
      .where(
        and(
          eq(serviceAccessPayments.facilityId, facilityId),
          eq(serviceAccessPayments.serviceName, "afya-solar"),
          eq(serviceAccessPayments.status, "completed")
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return
    }

    const id = randomUUID()
    const now = new Date()

    await db.insert(serviceAccessPayments).values({
      id,
      facilityId,
      serviceName: "afya-solar",
      amount: subscriber.totalPackagePrice,
      currency: "TZS",
      paymentMethod: subscriber.paymentMethod || "INVOICE",
      status: "completed",
      paidAt: now,
      packageId: subscriber.packageId,
      packageName: subscriber.packageName,
      paymentPlan: subscriber.planType?.toLowerCase() as any,
      metadata: JSON.stringify({
        source: "afya-solar-page-fallback",
        subscriberId: subscriber.id,
      }),
    })
  } catch (error) {
    console.error("Error ensuring Afya Solar service access payment:", error)
  }
}

async function ensureSubscriberFromCompletedServicePayment(facilityId: string) {
  try {
    const [payment] = await db
      .select()
      .from(serviceAccessPayments)
      .where(
        and(
          eq(serviceAccessPayments.facilityId, facilityId),
          eq(serviceAccessPayments.serviceName, "afya-solar"),
          eq(serviceAccessPayments.status, "completed")
        )
      )
      .orderBy(desc(serviceAccessPayments.createdAt))
      .limit(1)

    if (!payment) return

    const [facilityRow] = await db
      .select({
        name: facilities.name,
        email: facilities.email,
        phone: facilities.phone,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facilityRow) return

    const packageId = payment.packageId || "unknown"
    const packageName = payment.packageName || "Afya Solar Package"
    const paymentPlan = (payment.paymentPlan || "cash").toString().toLowerCase()
    const planType =
      paymentPlan === "installment" ? "INSTALLMENT" : paymentPlan === "paas" ? "PAAS" : "CASH"

    let ratedKw = 0
    try {
      const parsed = payment.metadata ? JSON.parse(payment.metadata) : null
      if (parsed && typeof parsed.ratedKw === "number") ratedKw = parsed.ratedKw
    } catch {
      // ignore
    }

    const now = new Date()

    await db.insert(afyaSolarSubscribers).values({
      facilityId,
      facilityName: facilityRow.name,
      facilityEmail: facilityRow.email ?? null,
      facilityPhone: facilityRow.phone ?? null,
      facilityRegion: "",
      facilityCity: "",

      packageId,
      packageName,
      packageCode: packageId,
      packageRatedKw: String(ratedKw),
      packageDescription: packageName,
      packageSpecs: {},

      planType,
      paymentMethod: payment.paymentMethod || "MNO",
      paymentStatus: "completed",
      isPaymentCompleted: 1,
      paymentCompletedAt: payment.paidAt ?? now,
      transactionId: payment.transactionId ?? null,

      totalPackagePrice: payment.amount,
      upfrontPaymentAmount: null,
      monthlyPaymentAmount: null,
      remainingBalance: "0",

      subscriptionStatus: "active",
      isActive: 1,
      subscriptionStartDate: payment.paidAt ?? now,
      subscriptionEndDate: null,
      nextBillingDate: new Date((payment.paidAt ?? now).getTime() + 30 * 24 * 60 * 60 * 1000),
      billingCycle: "monthly",
      gracePeriodDays: 7,

      contractDurationMonths: planType === "PAAS" ? 60 : null,
      contractStatus: "active",
      minimumTermMonths: planType === "PAAS" ? 60 : 12,
      autoRenew: 1,

      installationStatus: "pending",
      installationDate: null,
      lastMaintenanceDate: null,
      nextMaintenanceDate: null,

      systemStatus: "pending_install",
      systemHealth: "optimal",
      smartmeterSerial: null,
      lastSystemCheck: null,

      paymentHistory: [],
      bills: [],
      metadata: {
        source: "ensure-subscriber-from-service-payment",
        serviceAccessPaymentId: payment.id,
      },
      notes: "Auto-created subscriber from completed service payment",
      adminNotes: null,
    })

    const after = await getAfyaSolarSubscriber(facilityId)
  } catch (error) {
    console.error("Error ensuring subscriber from completed service payment:", error)
  }
}

export default async function AfyaSolarPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role === "admin") {
    redirect("/dashboard/admin")
  }
  if (session.user.role === "technician") {
    redirect("/dashboard/technician")
  }
  if (session.user.role !== "facility") {
    redirect("/auth/signin")
  }

  const facilityId = session.user.facilityId
  if (!facilityId) {
    redirect("/auth/signin")
  }

  const subscriber = await getAfyaSolarSubscriber(facilityId)
  const paidInvoice = await hasPaidAfyaSolarInvoice(facilityId)
  const completedServicePayment = await hasCompletedAfyaSolarServicePayment(facilityId)

  // If there is NO subscriber record but we can see any completed Afya Solar
  // payment (invoice-based or online), skip package selection and go straight
  // to the Afya Solar facility dashboard.
  if (!subscriber && (paidInvoice || completedServicePayment)) {
    // If payment exists but subscriber record is missing, create a minimal subscriber
    // so the dashboard can render package/payment information consistently.
    await ensureSubscriberFromCompletedServicePayment(facilityId)
    return <FacilityDashboard facilityId={facilityId} />
  }

  // No subscriber and no completed payment yet: let the facility pick a package
  // and start the subscription flow.
  if (!subscriber) {
    return <SolarPackagesSelection facilityId={facilityId} />
  }

  let paymentCompleted =
    subscriber.isPaymentCompleted === 1 || subscriber.paymentStatus === "completed"

  // If admin has marked an Afya Solar invoice as paid but the subscriber
  // record hasn't been updated yet, treat the payment as completed and
  // lazily update the subscriber row to keep the centralized table in sync.
  if (!paymentCompleted && paidInvoice) {
    paymentCompleted = true
    try {
      await db
        .update(afyaSolarSubscribers)
        .set({
          paymentStatus: "completed",
          isPaymentCompleted: 1,
          paymentMethod: subscriber.paymentMethod || "INVOICE",
          updatedAt: new Date(),
        })
        .where(eq(afyaSolarSubscribers.id, subscriber.id))

      // Also ensure a completed serviceAccessPayments row exists so
      // the Payment History section has a transaction to display.
      await ensureAfyaSolarServiceAccessPayment(facilityId, subscriber)
    } catch (error) {
      console.error("Error updating Afya Solar subscriber from paid invoice:", error)
    }
  }

  // If we consider the subscriber paid, ensure there's at least one completed
  // `service_access_payments` row so the Payment History panel has data.
  if (paymentCompleted) {
    await ensureAfyaSolarServiceAccessPayment(facilityId, subscriber)
  }

  // Subscriber exists but payment is still pending (e.g. awaiting invoice payment)
  if (!paymentCompleted) {
    return <AfyaSolarDashboardWithPendingModal facilityId={facilityId} />
  }

  // Active, paid subscriber -> full Afya Solar facility dashboard
  return <FacilityDashboard facilityId={facilityId} />
}

