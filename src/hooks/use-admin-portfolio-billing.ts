"use client"

import { useQuery } from "@tanstack/react-query"

export type AfyaSolarFinancialSummary = {
  totalRevenue: number
  monthlyRevenue: number
  pendingPayments: number
  overduePayments: number
  totalCustomers: number
  activeSubscriptions: number
  avgRevenuePerCustomer: number
  paymentSuccessRate: number
}

export type ActiveAfyaSolarSubRow = {
  facilityId: string
  planType: string | null
  solarPlanType?: string | null
  solarPackageName?: string | null
}

export type InvoiceRequestRow = {
  id: string
  facilityId: string
  facilityName: string
  packageName: string
  paymentPlan: string
  amount: string
  status: string
  createdAt: Date | string
}

export function useAfyaSolarAdminFinancialSummary(timeRange: "7d" | "30d" | "90d" | "1y") {
  return useQuery({
    queryKey: ["afya-solar-admin-financial-summary", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/afya-solar/admin/financial/summary?timeRange=${timeRange}`)
      if (!res.ok) throw new Error("Failed to load financial summary")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid summary response")
      return json.data as AfyaSolarFinancialSummary
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function useAfyaSolarAdminFinancialTransactions(timeRange: "7d" | "30d" | "90d" | "1y") {
  return useQuery({
    queryKey: ["afya-solar-admin-financial-transactions", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/afya-solar/admin/financial/transactions?timeRange=${timeRange}`)
      if (!res.ok) throw new Error("Failed to load transactions")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid transactions response")
      return (json.data || []) as Array<{
        id: string
        facilityId: string
        facilityName: string | null
        amount: string
        currency: string
        status: string
        type: string
        createdAt: Date | string
      }>
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function useAdminActiveAfyaSolarSubscriptions() {
  return useQuery({
    queryKey: ["admin-active-subs", "afya-solar"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subscriptions/active?service=afya-solar")
      if (!res.ok) throw new Error("Failed to load active Afya Solar subscriptions")
      return res.json() as Promise<{ success: boolean; data: ActiveAfyaSolarSubRow[] }>
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function useAdminSolarInvoiceRequestsPortfolio() {
  return useQuery({
    queryKey: ["admin-solar-invoice-requests", "portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/admin/solar/invoice-requests?limit=500")
      if (!res.ok) throw new Error("Failed to load invoice requests")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid invoice response")
      return (json.data || []) as InvoiceRequestRow[]
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Bundles portfolio solar billing queries (plan naming). */
export function useAdminPortfolioBilling(timeRange: "7d" | "30d" | "90d" | "1y") {
  const summary = useAfyaSolarAdminFinancialSummary(timeRange)
  const transactions = useAfyaSolarAdminFinancialTransactions(timeRange)
  const activeSubs = useAdminActiveAfyaSolarSubscriptions()
  const invoiceRequests = useAdminSolarInvoiceRequestsPortfolio()
  return { summary, transactions, activeSubs, invoiceRequests }
}

export type AfyaSolarBillingEligibleFacility = {
  facilityId: string
  facilityName: string
  city: string | null
  region: string | null
  solarPackageName: string | null
  solarPlanType: string | null
  hasCompletedSolarAccessPayment: boolean
  lastCompletedPaidAt: string | Date | null
}

/** Active facility + active Afya Solar sub + at least one completed solar access payment. */
export function useAfyaSolarBillingEligibleFacilities() {
  return useQuery({
    queryKey: ["afya-solar-billing-eligible-facilities"],
    queryFn: async () => {
      const res = await fetch("/api/admin/afya-solar/billing-eligible-facilities")
      if (!res.ok) throw new Error("Failed to load billing-eligible facilities")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid response")
      return json.data as AfyaSolarBillingEligibleFacility[]
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}
