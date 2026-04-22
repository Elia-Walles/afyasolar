/** Afya Solar subscription / payment plan vocabulary (keep in sync with facility billing UI). */

export function mapPlanTypeToPaymentPlan(
  planType?: string | null
): "cash" | "installment" | "paas" | undefined {
  const v = (planType || "").toUpperCase().trim()
  if (v === "CASH") return "cash"
  if (v === "INSTALLMENT") return "installment"
  if (v === "PAAS" || v === "EAAS") return "paas"
  return undefined
}

export function formatAfyaSolarPlanTypeLabel(planType?: string | null): string {
  const v = (planType || "").toUpperCase().trim()
  if (!v) return "—"
  if (v === "CASH") return "CASH"
  if (v === "INSTALLMENT") return "INSTALLMENT"
  if (v === "PAAS" || v === "EAAS") return "PAAS / EAAS"
  return planType || "—"
}
