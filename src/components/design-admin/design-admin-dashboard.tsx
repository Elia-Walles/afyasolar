"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Battery,
  Building2,
  FileBarChart,
  Gauge,
  Leaf,
  List,
  Plug,
  Settings,
  ShoppingCart,
  Ticket,
  Users,
  Wallet,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ModuleKey =
  | "dashboard"
  | "facilities"
  | "microgrid"
  | "transactions"
  | "paymentPlans"
  | "appliances"
  | "carbonSavings"
  | "tickets"
  | "agents"
  | "meters"
  | "energyEfficiency"
  | "reports"
  | "settings"

type Facility = {
  id: string
  name: string
  region: string
  systemSizeKw: number
  paymentModel: "payg" | "installment" | "full_payment"
  eeatScore: number
  hasMicrogrid: boolean
}

type MicrogridConsumer = {
  id: string
  name: string
  parentFacilityName: string
  meterSerial: string
  tariffPerKwh: number
  balance: number
  status: "active" | "disconnected" | "pending"
}

type Transaction = {
  id: string
  customerName: string
  amount: number
  method: "azampesa" | "mpesa" | "tigopesa" | "airtel" | "cash" | "bank"
  status: "confirmed" | "pending" | "failed"
  timestamp: string
  type: "payment" | "token" | "refund" | "commission" | "appliance" | "microgrid"
}

type PaymentPlan = {
  id: string
  customerName: string
  type: "upfront" | "installment" | "eas"
  systemCost: number
  upfrontPercent: number
  monthlyAmount: number
  contractMonths: number
  status: "active" | "completed" | "defaulted"
  remainingBalance: number
}

type Appliance = {
  id: string
  name: string
  category: string
  wattage: number
  price: number
  stock: number
  canFinance: boolean
}

type TicketItem = {
  id: string
  customerName: string
  category: "technical" | "billing" | "installation" | "general"
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in-progress" | "resolved" | "closed"
  subject: string
  createdAt: string
}

type Agent = {
  id: string
  name: string
  region: string
  commissionRate: number
  customersRegistered: number
  status: "active" | "inactive"
}

type Meter = {
  id: string
  serial: string
  parentFacilityName: string
  status: "in-stock" | "installed" | "faulty" | "decommissioned"
  lastSync: string
  tariffPerKwh: number
}

type LiveState = {
  facilities?: Facility[]
  transactions?: Transaction[]
  tickets?: TicketItem[]
  meters?: Meter[]
  efficiencyByFacilityId?: Record<string, number>
  appliances?: Appliance[]
  agents?: Agent[]
  paymentPlans?: PaymentPlan[]
  microgridConsumers?: MicrogridConsumer[]
}

type LoadState = {
  loading: boolean
  usingLive: boolean
  errors: string[]
}

function calculateCarbonSavings(totalSolarKwh: number) {
  const GRID_EMISSION_FACTOR = 0.7
  const KG_PER_TON = 1000
  const TREES_PER_TON_CO2 = 45
  const CAR_KM_PER_TON_CO2 = 4000
  const AVG_CAR_KM_PER_YEAR = 12000
  const HOME_KWH_PER_YEAR = 900
  const CARBON_CREDIT_PRICE = 15

  const co2AvoidedKg = totalSolarKwh * GRID_EMISSION_FACTOR
  const co2AvoidedTons = co2AvoidedKg / KG_PER_TON
  const treesEquivalent = Math.round(co2AvoidedTons * TREES_PER_TON_CO2)
  const carsOffRoad = Math.round(((co2AvoidedTons * CAR_KM_PER_TON_CO2) / AVG_CAR_KM_PER_YEAR) * 10) / 10
  const homesPowered = Math.round((totalSolarKwh / HOME_KWH_PER_YEAR) * 10) / 10
  const carbonCreditsEarned = Math.round(co2AvoidedTons * 10) / 10
  const carbonCreditValue = Math.round(co2AvoidedTons * CARBON_CREDIT_PRICE * 100) / 100

  return {
    totalSolarKwh,
    co2AvoidedKg: Math.round(co2AvoidedKg * 100) / 100,
    co2AvoidedTons: Math.round(co2AvoidedTons * 100) / 100,
    treesEquivalent,
    carsOffRoad,
    homesPowered,
    carbonCreditsEarned,
    carbonCreditValue,
  }
}

const modules: Array<{ key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "facilities", label: "Facilities", icon: Building2 },
  { key: "microgrid", label: "Microgrid", icon: Plug },
  { key: "transactions", label: "Transactions", icon: Wallet },
  { key: "paymentPlans", label: "Payment Plans", icon: List },
  { key: "appliances", label: "Appliances", icon: ShoppingCart },
  { key: "carbonSavings", label: "Carbon Savings", icon: Leaf },
  { key: "tickets", label: "Tickets", icon: Ticket },
  { key: "agents", label: "Agents", icon: Users },
  { key: "meters", label: "Meters", icon: Gauge },
  { key: "energyEfficiency", label: "Energy Efficiency", icon: Zap },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "settings", label: "Settings", icon: Settings },
]

export function DesignAdminDashboard() {
  const [active, setActive] = useState<ModuleKey>("dashboard")
  const [query, setQuery] = useState("")
  const [live, setLive] = useState<LiveState>({})
  const [loadState, setLoadState] = useState<LoadState>({ loading: true, usingLive: false, errors: [] })

  useEffect(() => {
    let cancelled = false

    const fetchJson = async (url: string, init?: RequestInit) => {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          "content-type": "application/json",
        },
        cache: "no-store",
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`${url} -> ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`)
      }
      return (await res.json()) as any
    }

    const asMoneyNumber = (value: unknown) => {
      if (typeof value === "number") return value
      if (typeof value === "string") {
        const n = Number(value)
        return Number.isFinite(n) ? n : 0
      }
      return 0
    }

    const run = async () => {
      const errors: string[] = []
      const nextLive: LiveState = {}

      // Facilities (public or authed)
      try {
        const facilitiesRes = await fetchJson("/api/facilities")
        const rows: any[] = Array.isArray(facilitiesRes?.data) ? facilitiesRes.data : []
        nextLive.facilities = rows.map((f) => ({
          id: String(f.id ?? ""),
          name: String(f.name ?? "Unknown"),
          region: String(f.region ?? f.city ?? "—"),
          systemSizeKw: 0,
          paymentModel:
            f.paymentModel === "installment" || f.paymentModel === "full_payment" ? f.paymentModel : "payg",
          eeatScore: 0,
          hasMicrogrid: false,
        }))
      } catch (e: any) {
        errors.push(e?.message || "Failed to load facilities")
      }

      // Transactions (admin)
      try {
        const txRes = await fetchJson("/api/admin/transactions?limit=20&page=1")
        const rows: any[] = Array.isArray(txRes?.data) ? txRes.data : Array.isArray(txRes?.transactions) ? txRes.transactions : []
        nextLive.transactions = rows.map((t) => {
          const amount = asMoneyNumber(t.amount ?? t?.transaction?.amount)
          const statusRaw = String(t.status ?? t?.transaction?.status ?? "").toLowerCase()
          const status: Transaction["status"] =
            statusRaw === "completed" || statusRaw === "confirmed"
              ? "confirmed"
              : statusRaw === "failed"
                ? "failed"
                : "pending"
          const methodRaw = String(t.paymentMethod ?? t.method ?? t?.transaction?.provider ?? t?.transaction?.paymentMethod ?? "").toLowerCase()
          const method: Transaction["method"] =
            methodRaw.includes("mpesa") ? "mpesa" : methodRaw.includes("tigo") ? "tigopesa" : methodRaw.includes("airtel") ? "airtel" : methodRaw.includes("bank") ? "bank" : methodRaw.includes("cash") ? "cash" : "azampesa"

          return {
            id: String(t.id ?? t?.transaction?.id ?? ""),
            customerName: String(t.facilityName ?? t.customerName ?? "Unknown"),
            amount,
            method,
            status,
            timestamp: String(t.createdAt ?? t.timestamp ?? t?.transaction?.createdAt ?? "—"),
            type: "payment",
          }
        })
      } catch (e: any) {
        // Fallback to Afya Solar admin financial transactions endpoint (also admin)
        try {
          const txRes = await fetchJson("/api/afya-solar/admin/financial/transactions?timeRange=30d&status=all&type=all")
          const rows: any[] = Array.isArray(txRes?.data) ? txRes.data : []
          nextLive.transactions = rows.map((t) => {
            const amount = asMoneyNumber(t.amount)
            const statusRaw = String(t.status ?? "").toLowerCase()
            const status: Transaction["status"] =
              statusRaw === "completed" || statusRaw === "confirmed"
                ? "confirmed"
                : statusRaw === "failed"
                  ? "failed"
                  : "pending"
            const methodRaw = String(t.paymentMethod ?? "").toLowerCase()
            const method: Transaction["method"] =
              methodRaw.includes("mpesa") ? "mpesa" : methodRaw.includes("tigo") ? "tigopesa" : methodRaw.includes("airtel") ? "airtel" : methodRaw.includes("bank") ? "bank" : methodRaw.includes("cash") ? "cash" : "azampesa"

            return {
              id: String(t.id ?? ""),
              customerName: String(t.facilityName ?? "Unknown"),
              amount,
              method,
              status,
              timestamp: String(t.createdAt ?? "—"),
              type: "payment",
            }
          })
        } catch (e2: any) {
          errors.push(e?.message || "Failed to load transactions")
          errors.push(e2?.message || "Failed to load transactions (fallback)")
        }
      }

      // Tickets (admin)
      try {
        const tRes = await fetchJson("/api/afya-solar/admin/support/tickets")
        const rows: any[] = Array.isArray(tRes?.data) ? tRes.data : []
        nextLive.tickets = rows.map((t) => ({
          id: String(t.id ?? ""),
          customerName: String(t.facilityName ?? t.customerName ?? "Unknown"),
          category:
            t.category === "billing" || t.category === "installation" || t.category === "general" ? t.category : "technical",
          priority:
            t.priority === "low" || t.priority === "medium" || t.priority === "high" || t.priority === "critical"
              ? t.priority
              : "medium",
          status:
            t.status === "open" || t.status === "resolved" || t.status === "closed" || t.status === "in-progress"
              ? t.status
              : t.status === "in_progress"
                ? "in-progress"
                : "open",
          subject: String(t.subject ?? "—"),
          createdAt: String(t.createdAt ?? "—"),
        }))
      } catch (e: any) {
        errors.push(e?.message || "Failed to load tickets")
      }

      // Meters (authed; admin for mutations but GET requires session)
      try {
        const mRes = await fetchJson("/api/afya-solar/smartmeters")
        const rows: any[] = Array.isArray(mRes?.data) ? mRes.data : []
        nextLive.meters = rows.map((m) => ({
          id: String(m.id ?? ""),
          serial: String(m.meterSerial ?? m.serial ?? ""),
          parentFacilityName: String(m?.service?.siteName ?? "—"),
          status: "installed",
          lastSync: String(m.lastSeenAt ?? m.updatedAt ?? m.createdAt ?? "—"),
          tariffPerKwh: 0,
        }))
      } catch (e: any) {
        errors.push(e?.message || "Failed to load meters")
      }

      // Appliances (admin equipment listings)
      try {
        const aRes = await fetchJson("/api/admin/equipment")
        const rows: any[] = Array.isArray(aRes?.data) ? aRes.data : []
        nextLive.appliances = rows.map((a) => ({
          id: String(a.id ?? ""),
          name: String(a.equipmentName ?? a.name ?? "—"),
          category: String(a.category ?? "general"),
          wattage: 0,
          price: asMoneyNumber(a.price),
          stock: Number(a.quantity ?? 0) || 0,
          canFinance: false,
        }))
      } catch (e: any) {
        errors.push(e?.message || "Failed to load appliances")
      }

      // Agents (mapped to technicians list for now)
      try {
        const agRes = await fetchJson("/api/technicians")
        const rows: any[] = Array.isArray(agRes?.data) ? agRes.data : []
        nextLive.agents = rows.map((t) => ({
          id: String(t.id ?? ""),
          name: `${String(t.firstName ?? "").trim()} ${String(t.lastName ?? "").trim()}`.trim() || String(t.email ?? "—"),
          region: String(t.regionId ?? "—"),
          commissionRate: 0,
          customersRegistered: 0,
          status: t.status === "inactive" ? "inactive" : "active",
        }))
      } catch (e: any) {
        errors.push(e?.message || "Failed to load agents")
      }

      // Payment plans (derive from Afya Solar client services + packages/plans)
      try {
        const sRes = await fetchJson("/api/afya-solar/client-services?limit=50&page=1")
        const services: any[] = Array.isArray(sRes?.data?.services) ? sRes.data.services : []
        nextLive.paymentPlans = services.map((s) => {
          const planType = String(s?.plan?.planTypeCode ?? "").toUpperCase()
          const pricing = s?.plan?.pricing || {}
          const systemCost =
            planType === "CASH"
              ? asMoneyNumber(pricing.cashPrice)
              : planType === "INSTALLMENT"
                ? asMoneyNumber(pricing.cashPrice)
                : 0
          const upfrontPercent = asMoneyNumber(pricing.defaultUpfrontPercent)
          const contractMonths = Number(pricing.installmentDurationMonths ?? 0) || 0
          const monthlyAmount = asMoneyNumber(pricing.defaultMonthlyAmount ?? pricing.eaasMonthlyFee)

          return {
            id: String(s.id ?? ""),
            customerName: String(s?.facility?.name ?? "Unknown"),
            type: planType === "INSTALLMENT" ? "installment" : planType === "EAAS" ? "eas" : "upfront",
            systemCost,
            upfrontPercent,
            monthlyAmount,
            contractMonths,
            status: s.status === "COMPLETED" ? "completed" : s.status === "CANCELLED" ? "defaulted" : "active",
            remainingBalance: 0,
          }
        })
      } catch (e: any) {
        errors.push(e?.message || "Failed to load payment plans")
      }

      // Microgrid (admin endpoints backed by microgrid tables)
      try {
        const mgRes = await fetchJson("/api/admin/microgrid/consumers")
        const rows: any[] = Array.isArray(mgRes?.data) ? mgRes.data : []
        nextLive.microgridConsumers = rows.map((c) => ({
          id: String(c.consumerCode ?? c.id ?? ""),
          name: String(c.name ?? "—"),
          parentFacilityName: String(c.parentFacilityName ?? "—"),
          meterSerial: String(c.meterSerial ?? "—"),
          tariffPerKwh: asMoneyNumber(c.tariffRate),
          balance: asMoneyNumber(c.creditBalance),
          status:
            String(c.status ?? "").toUpperCase() === "DISCONNECTED"
              ? "disconnected"
              : String(c.status ?? "").toUpperCase() === "PENDING"
                ? "pending"
                : "active",
        }))
      } catch (e: any) {
        errors.push(e?.message || "Failed to load microgrid consumers")
      }

      // Efficiency scores (admin)
      try {
        const effRes = await fetchJson("/api/admin/analytics/efficiency/score?period=monthly&limit=12")
        const rows: any[] = Array.isArray(effRes?.data) ? effRes.data : []
        const byFacilityId: Record<string, number> = {}
        for (const r of rows) {
          const fid = String(r.facilityId ?? "")
          const score = Number(r.overallScore ?? r.eeatScore ?? r.score ?? 0)
          if (!fid) continue
          if (!Number.isFinite(score)) continue
          byFacilityId[fid] = score
        }
        nextLive.efficiencyByFacilityId = byFacilityId
      } catch (e: any) {
        // optional — don’t block live mode
      }

      if (cancelled) return

      const usingLive = Boolean(
        (nextLive.facilities && nextLive.facilities.length) ||
          (nextLive.transactions && nextLive.transactions.length) ||
          (nextLive.tickets && nextLive.tickets.length) ||
          (nextLive.meters && nextLive.meters.length) ||
          (nextLive.paymentPlans && nextLive.paymentPlans.length) ||
          (nextLive.appliances && nextLive.appliances.length) ||
          (nextLive.agents && nextLive.agents.length) ||
          (nextLive.microgridConsumers && nextLive.microgridConsumers.length),
      )

      setLive(nextLive)
      setLoadState({ loading: false, usingLive, errors })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  // Design repo uses rich mock data. We keep the same idea here so all views exist immediately.
  const mockFacilities: Facility[] = useMemo(
    () => [
      { id: "FAC001", name: "St. Therese of Allesson Dispensary", region: "Pwani", systemSizeKw: 2, paymentModel: "payg", eeatScore: 68, hasMicrogrid: false },
      { id: "FAC002", name: "Arafa Majumba Sita Health Center", region: "Dar es Salaam", systemSizeKw: 10, paymentModel: "installment", eeatScore: 74, hasMicrogrid: true },
      { id: "FAC003", name: "MICO Salasala Health Center", region: "Dar es Salaam", systemSizeKw: 8, paymentModel: "installment", eeatScore: 72, hasMicrogrid: true },
    ],
    [],
  )

  const microgridConsumers: MicrogridConsumer[] = useMemo(
    () => [
      { id: "MGC001", name: "Dr. Mwamba Staff House", parentFacilityName: "Arafa Majumba Sita Health Center", meterSerial: "MG-STF-001", tariffPerKwh: 450, balance: 12500, status: "active" },
      { id: "MGC002", name: "Mama Salama Pharmacy", parentFacilityName: "Arafa Majumba Sita Health Center", meterSerial: "MG-BUS-001", tariffPerKwh: 500, balance: 35000, status: "active" },
      { id: "MGC003", name: "Salasala Staff House", parentFacilityName: "MICO Salasala Health Center", meterSerial: "MG-STF-004", tariffPerKwh: 420, balance: 8400, status: "pending" },
    ],
    [],
  )

  const mockTransactions: Transaction[] = useMemo(
    () => [
      { id: "TRX001", customerName: "St. Therese of Allesson Dispensary", amount: 32500, method: "mpesa", status: "confirmed", timestamp: "2026-03-18 12:02", type: "payment" },
      { id: "TRX002", customerName: "Arafa Majumba Sita Health Center", amount: 185000, method: "azampesa", status: "pending", timestamp: "2026-03-20 09:44", type: "payment" },
      { id: "TRX003", customerName: "Mama Salama Pharmacy", amount: 50400, method: "azampesa", status: "confirmed", timestamp: "2026-03-21 10:00", type: "microgrid" },
    ],
    [],
  )

  const mockPlans: PaymentPlan[] = useMemo(
    () => [
      { id: "PP001", customerName: "St. Therese of Allesson Dispensary", type: "upfront", systemCost: 2800000, upfrontPercent: 100, monthlyAmount: 0, contractMonths: 0, status: "completed", remainingBalance: 0 },
      { id: "PP002", customerName: "Arafa Majumba Sita Health Center", type: "installment", systemCost: 12500000, upfrontPercent: 30, monthlyAmount: 320000, contractMonths: 48, status: "active", remainingBalance: 8750000 },
      { id: "PP003", customerName: "MICO Salasala Health Center", type: "eas", systemCost: 0, upfrontPercent: 0, monthlyAmount: 290000, contractMonths: 84, status: "active", remainingBalance: 0 },
    ],
    [],
  )

  const mockAppliances: Appliance[] = useMemo(
    () => [
      { id: "AP001", name: "Solar Vaccine Fridge", category: "refrigeration", wattage: 120, price: 3500000, stock: 3, canFinance: true },
      { id: "AP002", name: "LED Lighting Kit", category: "lighting", wattage: 60, price: 180000, stock: 24, canFinance: false },
      { id: "AP003", name: "Ceiling Fan", category: "hvac", wattage: 75, price: 95000, stock: 0, canFinance: false },
    ],
    [],
  )

  const mockTickets: TicketItem[] = useMemo(
    () => [
      { id: "TCK001", customerName: "St. Therese of Allesson Dispensary", category: "technical", priority: "high", status: "open", subject: "Battery not charging fully", createdAt: "2026-03-25" },
      { id: "TCK002", customerName: "Arafa Majumba Sita Health Center", category: "billing", priority: "medium", status: "in-progress", subject: "Installment payment reconciliation", createdAt: "2026-03-22" },
    ],
    [],
  )

  const mockAgents: Agent[] = useMemo(
    () => [
      { id: "AG001", name: "Amina Saleh", region: "Dar es Salaam", commissionRate: 7.5, customersRegistered: 14, status: "active" },
      { id: "AG002", name: "Juma Hassan", region: "Pwani", commissionRate: 6.0, customersRegistered: 8, status: "active" },
    ],
    [],
  )

  const mockMeters: Meter[] = useMemo(
    () => [
      { id: "MTR001", serial: "MG-STF-001", parentFacilityName: "Arafa Majumba Sita Health Center", status: "installed", lastSync: "2026-04-06 14:10", tariffPerKwh: 450 },
      { id: "MTR002", serial: "MG-BUS-001", parentFacilityName: "Arafa Majumba Sita Health Center", status: "installed", lastSync: "2026-04-06 14:12", tariffPerKwh: 500 },
      { id: "MTR003", serial: "MG-SPARE-001", parentFacilityName: "-", status: "in-stock", lastSync: "-", tariffPerKwh: 350 },
    ],
    [],
  )

  const facilities = live.facilities?.length ? live.facilities : mockFacilities
  const transactions = live.transactions?.length ? live.transactions : mockTransactions
  const tickets = live.tickets?.length ? live.tickets : mockTickets
  const meters = live.meters?.length ? live.meters : mockMeters
  const plans = live.paymentPlans?.length ? live.paymentPlans : mockPlans
  const appliances = live.appliances?.length ? live.appliances : mockAppliances
  const agents = live.agents?.length ? live.agents : mockAgents
  const microgridConsumersView = live.microgridConsumers?.length ? live.microgridConsumers : microgridConsumers

  const facilitiesWithEfficiency = useMemo(() => {
    const byFid = live.efficiencyByFacilityId || {}
    return facilities.map((f) => {
      const eff = byFid[f.id]
      return {
        ...f,
        eeatScore: Number.isFinite(eff) ? Math.round(eff) : f.eeatScore,
      }
    })
  }, [facilities, live.efficiencyByFacilityId])

  const totals = useMemo(() => {
    const totalSolarKwh = facilities.reduce((sum, f) => sum + (f.systemSizeKw || 0) * 30 * 4.2, 0) // mock if size unknown
    return {
      facilities: facilities.length,
      microgridConsumers: microgridConsumers.length,
      transactions: transactions.length,
      carbon: calculateCarbonSavings(totalSolarKwh),
    }
  }, [facilities, microgridConsumers, transactions])

  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return facilitiesWithEfficiency
    return facilitiesWithEfficiency.filter((f) => f.name.toLowerCase().includes(q) || f.region.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
  }, [facilitiesWithEfficiency, query])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Battery className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold leading-tight">AfyaSolar Admin (Design Dashboard)</div>
              <div className="text-xs text-muted-foreground leading-tight">
                Ported from design repo as an additional admin area
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Non-destructive</Badge>
            {loadState.loading ? (
              <Badge variant="secondary">Loading data…</Badge>
            ) : loadState.usingLive ? (
              <Badge>Live API</Badge>
            ) : (
              <Badge variant="secondary">Mock fallback</Badge>
            )}
          </div>
        </div>
        {!loadState.loading && loadState.errors.length > 0 && (
          <div className="px-4 pb-3 text-xs text-muted-foreground">
            Some modules are using fallback data due to API/auth issues.
          </div>
        )}
      </header>

      <div className="flex">
        <aside className="w-64 border-r bg-card hidden md:block h-[calc(100vh-57px)] overflow-y-auto">
          <div className="p-3 space-y-1">
            {modules.map((m) => (
              <Button
                key={m.key}
                variant={active === m.key ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActive(m.key)}
              >
                <m.icon className="w-4 h-4 mr-2" />
                {m.label}
              </Button>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {active === "dashboard" && (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Dashboard</h2>
                    <p className="text-muted-foreground">Key KPIs across facilities and microgrid.</p>
                  </div>
                  <Button variant="outline" onClick={() => setActive("facilities")}>
                    View Facilities
                  </Button>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Facilities</CardDescription>
                      <CardTitle className="text-3xl">{totals.facilities}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Microgrid Consumers</CardDescription>
                      <CardTitle className="text-3xl">{totals.microgridConsumers}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Transactions</CardDescription>
                      <CardTitle className="text-3xl">{totals.transactions}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>CO2 Avoided</CardDescription>
                      <CardTitle className="text-3xl">{totals.carbon.co2AvoidedTons} t</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Carbon Savings Snapshot</CardTitle>
                    <CardDescription>Methodology aligned to design docs.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Solar kWh</div>
                      <div className="text-xl font-semibold">{Math.round(totals.carbon.totalSolarKwh).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">CO2 Avoided (kg)</div>
                      <div className="text-xl font-semibold">{totals.carbon.co2AvoidedKg.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Trees Equivalent</div>
                      <div className="text-xl font-semibold">{totals.carbon.treesEquivalent.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cars Off Road</div>
                      <div className="text-xl font-semibold">{totals.carbon.carsOffRoad}</div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {active === "facilities" && (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Facilities</h2>
                    <p className="text-muted-foreground">Manage facility customers and configurations.</p>
                  </div>
                  <div className="w-full md:w-80">
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search facilities..." />
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Facility List</CardTitle>
                    <CardDescription>Design dashboard view (ported).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left border-b">
                          <tr>
                            <th className="py-2 pr-4">ID</th>
                            <th className="py-2 pr-4">Name</th>
                            <th className="py-2 pr-4">Region</th>
                            <th className="py-2 pr-4">kW</th>
                            <th className="py-2 pr-4">Payment</th>
                            <th className="py-2 pr-4">EEAT</th>
                            <th className="py-2 pr-4">Microgrid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFacilities.map((f) => (
                            <tr key={f.id} className="border-b">
                              <td className="py-2 pr-4 font-mono">{f.id}</td>
                              <td className="py-2 pr-4">{f.name}</td>
                              <td className="py-2 pr-4">{f.region}</td>
                              <td className="py-2 pr-4">{f.systemSizeKw}</td>
                              <td className="py-2 pr-4">
                                <Badge variant="outline">{f.paymentModel}</Badge>
                              </td>
                              <td className="py-2 pr-4">
                                <Badge className={f.eeatScore >= 70 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}>
                                  {f.eeatScore}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4">{f.hasMicrogrid ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {active === "microgrid" && (
              <Card>
                <CardHeader>
                  <CardTitle>Microgrid</CardTitle>
                  <CardDescription>Consumers, tariffs, balances, and connection status.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">Consumer</th>
                          <th className="py-2 pr-4">Parent Facility</th>
                          <th className="py-2 pr-4">Meter</th>
                          <th className="py-2 pr-4">Tariff</th>
                          <th className="py-2 pr-4">Balance</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {microgridConsumersView.map((c) => (
                          <tr key={c.id} className="border-b">
                            <td className="py-2 pr-4">{c.name}</td>
                            <td className="py-2 pr-4">{c.parentFacilityName}</td>
                            <td className="py-2 pr-4 font-mono">{c.meterSerial}</td>
                            <td className="py-2 pr-4">TSh {c.tariffPerKwh}/kWh</td>
                            <td className="py-2 pr-4">TSh {c.balance.toLocaleString()}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={c.status === "active" ? "default" : c.status === "pending" ? "secondary" : "destructive"}>{c.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "transactions" && (
              <Card>
                <CardHeader>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>Payments and microgrid top-ups (design view).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">ID</th>
                          <th className="py-2 pr-4">Customer</th>
                          <th className="py-2 pr-4">Amount</th>
                          <th className="py-2 pr-4">Method</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id} className="border-b">
                            <td className="py-2 pr-4 font-mono">{t.id}</td>
                            <td className="py-2 pr-4">{t.customerName}</td>
                            <td className="py-2 pr-4">TSh {t.amount.toLocaleString()}</td>
                            <td className="py-2 pr-4">{t.method}</td>
                            <td className="py-2 pr-4">{t.type}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={t.status === "confirmed" ? "default" : t.status === "pending" ? "secondary" : "destructive"}>{t.status}</Badge>
                            </td>
                            <td className="py-2 pr-4">{t.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "paymentPlans" && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Plans</CardTitle>
                  <CardDescription>Upfront / Installment / EaS.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">Customer</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">System Cost</th>
                          <th className="py-2 pr-4">Upfront %</th>
                          <th className="py-2 pr-4">Monthly</th>
                          <th className="py-2 pr-4">Term</th>
                          <th className="py-2 pr-4">Remaining</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map((p) => (
                          <tr key={p.id} className="border-b">
                            <td className="py-2 pr-4">{p.customerName}</td>
                            <td className="py-2 pr-4">{p.type}</td>
                            <td className="py-2 pr-4">TSh {p.systemCost.toLocaleString()}</td>
                            <td className="py-2 pr-4">{p.upfrontPercent}%</td>
                            <td className="py-2 pr-4">TSh {p.monthlyAmount.toLocaleString()}</td>
                            <td className="py-2 pr-4">{p.contractMonths} mo</td>
                            <td className="py-2 pr-4">TSh {p.remainingBalance.toLocaleString()}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={p.status === "active" ? "default" : p.status === "completed" ? "secondary" : "destructive"}>{p.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "appliances" && (
              <Card>
                <CardHeader>
                  <CardTitle>Appliances</CardTitle>
                  <CardDescription>Inventory + financing flags (design view).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Category</th>
                          <th className="py-2 pr-4">Wattage</th>
                          <th className="py-2 pr-4">Price</th>
                          <th className="py-2 pr-4">Stock</th>
                          <th className="py-2 pr-4">Finance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appliances.map((a) => (
                          <tr key={a.id} className="border-b">
                            <td className="py-2 pr-4">{a.name}</td>
                            <td className="py-2 pr-4">{a.category}</td>
                            <td className="py-2 pr-4">{a.wattage}W</td>
                            <td className="py-2 pr-4">TSh {a.price.toLocaleString()}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={a.stock > 0 ? "default" : "destructive"}>{a.stock}</Badge>
                            </td>
                            <td className="py-2 pr-4">{a.canFinance ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "carbonSavings" && (
              <Card>
                <CardHeader>
                  <CardTitle>Carbon Savings</CardTitle>
                  <CardDescription>Summary metrics, aligned to docs.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">CO2 Avoided</div>
                    <div className="text-2xl font-semibold">{totals.carbon.co2AvoidedTons} tons</div>
                    <div className="text-xs text-muted-foreground">{totals.carbon.co2AvoidedKg.toLocaleString()} kg</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Trees Equivalent</div>
                    <div className="text-2xl font-semibold">{totals.carbon.treesEquivalent}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Carbon Credits (est.)</div>
                    <div className="text-2xl font-semibold">{totals.carbon.carbonCreditsEarned}</div>
                    <div className="text-xs text-muted-foreground">${totals.carbon.carbonCreditValue} USD</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "tickets" && (
              <Card>
                <CardHeader>
                  <CardTitle>Tickets</CardTitle>
                  <CardDescription>Support workflow (design view).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">ID</th>
                          <th className="py-2 pr-4">Customer</th>
                          <th className="py-2 pr-4">Category</th>
                          <th className="py-2 pr-4">Priority</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Subject</th>
                          <th className="py-2 pr-4">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((t) => (
                          <tr key={t.id} className="border-b">
                            <td className="py-2 pr-4 font-mono">{t.id}</td>
                            <td className="py-2 pr-4">{t.customerName}</td>
                            <td className="py-2 pr-4">{t.category}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={t.priority === "critical" ? "destructive" : t.priority === "high" ? "default" : "secondary"}>{t.priority}</Badge>
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant={t.status === "open" ? "default" : t.status === "resolved" ? "secondary" : "outline"}>{t.status}</Badge>
                            </td>
                            <td className="py-2 pr-4">{t.subject}</td>
                            <td className="py-2 pr-4">{t.createdAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "agents" && (
              <Card>
                <CardHeader>
                  <CardTitle>Agents</CardTitle>
                  <CardDescription>Sales agent management + commissions (design view).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Region</th>
                          <th className="py-2 pr-4">Commission</th>
                          <th className="py-2 pr-4">Customers</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((a) => (
                          <tr key={a.id} className="border-b">
                            <td className="py-2 pr-4">{a.name}</td>
                            <td className="py-2 pr-4">{a.region}</td>
                            <td className="py-2 pr-4">{a.commissionRate}%</td>
                            <td className="py-2 pr-4">{a.customersRegistered}</td>
                            <td className="py-2 pr-4">
                              <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "meters" && (
              <Card>
                <CardHeader>
                  <CardTitle>Meters</CardTitle>
                  <CardDescription>Applies to microgrid consumers (design view).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b">
                        <tr>
                          <th className="py-2 pr-4">Serial</th>
                          <th className="py-2 pr-4">Parent Facility</th>
                          <th className="py-2 pr-4">Tariff</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Last Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meters.map((m) => (
                          <tr key={m.id} className="border-b">
                            <td className="py-2 pr-4 font-mono">{m.serial}</td>
                            <td className="py-2 pr-4">{m.parentFacilityName}</td>
                            <td className="py-2 pr-4">TSh {m.tariffPerKwh}/kWh</td>
                            <td className="py-2 pr-4">
                              <Badge variant={m.status === "installed" ? "default" : m.status === "in-stock" ? "secondary" : "destructive"}>{m.status}</Badge>
                            </td>
                            <td className="py-2 pr-4">{m.lastSync}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {active === "energyEfficiency" && (
              <Card>
                <CardHeader>
                  <CardTitle>Energy Efficiency</CardTitle>
                  <CardDescription>EEAT scores overview (design view).</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="scores">
                    <TabsList>
                      <TabsTrigger value="scores">Scores</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="scores" className="pt-4">
                      <div className="grid md:grid-cols-3 gap-3">
                        {facilities.map((f) => (
                          <Card key={f.id} className="py-4">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{f.name}</CardTitle>
                              <CardDescription>{f.region}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">EEAT</span>
                                <Badge className={f.eeatScore >= 70 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}>
                                  {f.eeatScore}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="notes" className="pt-4">
                      <div className="text-sm text-muted-foreground">
                        This section is a UI port from the design repo. Data wiring to live efficiency endpoints will be added next.
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {active === "reports" && (
              <Card>
                <CardHeader>
                  <CardTitle>Reports</CardTitle>
                  <CardDescription>High-level reporting placeholders (design view).</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-3">
                  <Card className="py-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Carbon Report</CardTitle>
                      <CardDescription>Monthly</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Uses carbon methodology in `docs/CARBON_CALCULATOR_METHODOLOGY.md`.
                    </CardContent>
                  </Card>
                  <Card className="py-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Revenue Analysis</CardTitle>
                      <CardDescription>Monthly</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Will be wired to existing financial endpoints.
                    </CardContent>
                  </Card>
                  <Card className="py-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Energy Trends</CardTitle>
                      <CardDescription>30-day</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Will be wired to device/energy telemetry.
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            )}

            {active === "settings" && (
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Admin settings view (ported).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 font-medium">
                        <Wallet className="w-4 h-4" />
                        Payments
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Wrapper endpoints added: `/api/payments/mpesa/*` via AzamPay provider `Mpesa`.
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 font-medium">
                        <Gauge className="w-4 h-4" />
                        Meters
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Design endpoints added: `/api/meters/[deviceId]/*` backed by the command queue.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mobile module switcher */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card">
              <div className="flex overflow-x-auto">
                {modules.slice(0, 6).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setActive(m.key)}
                    className={`flex-1 px-3 py-2 text-xs ${active === m.key ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <m.icon className="w-4 h-4" />
                      {m.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

