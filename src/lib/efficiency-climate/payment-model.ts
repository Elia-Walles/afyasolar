import { db } from "@/lib/db"
import { afyaSolarClientServices, afyaSolarPlans } from "@/lib/db/afya-solar-schema"
import { eq, desc } from "drizzle-orm"

export type NormalizedPaymentModel = "CASH" | "INSTALLMENT" | "EAAS" | "PAAS" | "UNKNOWN"

/**
 * Maps Afya Solar plan type codes to a normalized label for efficiency / billing copy.
 */
export function normalizePlanCode(code: string | null | undefined): NormalizedPaymentModel {
  if (!code) return "UNKNOWN"
  const c = code.toUpperCase()
  if (c === "CASH") return "CASH"
  if (c === "INSTALLMENT") return "INSTALLMENT"
  if (c === "EAAS") return "EAAS"
  if (c === "PAAS" || c === "PAYG") return "PAAS"
  return "UNKNOWN"
}

export async function getFacilityPaymentModel(facilityId: string): Promise<NormalizedPaymentModel> {
  try {
    const rows = await db
      .select({ planTypeCode: afyaSolarPlans.planTypeCode })
      .from(afyaSolarClientServices)
      .innerJoin(afyaSolarPlans, eq(afyaSolarClientServices.planId, afyaSolarPlans.id))
      .where(eq(afyaSolarClientServices.facilityId, facilityId))
      .orderBy(desc(afyaSolarClientServices.id))
      .limit(1)
    return normalizePlanCode(rows[0]?.planTypeCode)
  } catch {
    return "UNKNOWN"
  }
}

export function billingContextForEfficiency(
  model: NormalizedPaymentModel,
  underperforming: boolean
): string {
  if (!underperforming) {
    return "No billing action indicated from efficiency signals alone."
  }
  switch (model) {
    case "EAAS":
      return "EaaS: output below benchmark — flag for SLA review; invoice credit or service visit per contract terms."
    case "PAAS":
      return "Pay-as-you-go: verify meter calibration and token logic; sustained underproduction may reduce effective energy delivery."
    case "INSTALLMENT":
      return "Installment: warranty / performance clause may apply; schedule technical inspection before adjusting schedule."
    case "CASH":
      return "Upfront purchase: recommend warranty performance review and optional O&M visit (not an automatic billing change)."
    default:
      return "Confirm payment plan on file; align technical findings with finance before changing invoices."
  }
}
