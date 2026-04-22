"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertCircle,
  ArrowUpDown,
  Building2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  useComprehensiveFacilities,
  useFacility,
  type ComprehensiveFacility,
} from "@/hooks/use-facilities"
import { formatAfyaSolarPlanTypeLabel } from "@/lib/dashboard/afya-solar-plan-type"
import { formatCurrency, cn } from "@/lib/utils"
import {
  useAdminPortfolioBilling,
  useAfyaSolarBillingEligibleFacilities,
  type ActiveAfyaSolarSubRow,
  type AfyaSolarBillingEligibleFacility,
} from "@/hooks/use-admin-portfolio-billing"
import { useServiceAccessPayments } from "@/hooks/use-service-access-payments"
import { useAfyaSolarSubscriber } from "@/hooks/use-afya-solar-subscribers"
import { AdminSolarBillingCharts } from "@/components/afya-solar/admin-solar-billing-charts"

type SapRow = {
  id?: string
  amount?: string | number
  status?: string
  paidAt?: string | Date | null
  createdAt?: string | Date | null
  paymentPlan?: string | null
  packageName?: string | null
  currency?: string
  transactionId?: string | null
}

type AccessSortKey = "when" | "amount" | "status"

function formatPaymentPlanLabel(plan: string | null | undefined) {
  if (!plan) return "—"
  const p = plan.toLowerCase()
  if (p === "cash") return "Cash (upfront)"
  if (p === "installment") return "Installment"
  if (p === "paas" || p === "eaas") return "PAAS / EAAS (pay as you go)"
  return plan
}

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function statusBadgeVariant(status: string | undefined): "default" | "secondary" | "destructive" | "outline" {
  const st = String(status || "").toLowerCase()
  if (st === "completed" || st === "active" || st === "approved") return "default"
  if (st === "failed" || st === "rejected" || st === "cancelled") return "destructive"
  if (st === "pending" || st === "processing") return "secondary"
  return "outline"
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (c: string) => `"${c.replace(/"/g, '""')}"`
  const body = rows.map((r) => r.map(esc).join(",")).join("\n")
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AdminPortfolioSolarBilling() {
  const queryClient = useQueryClient()
  const [facilitySearch, setFacilitySearch] = useState("")
  const [selectedFacilityId, setSelectedFacilityId] = useState("")
  const [legacyPlanTypeFilter, setLegacyPlanTypeFilter] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d")
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "invoices" | "ledger">("overview")
  const [accessSortKey, setAccessSortKey] = useState<AccessSortKey>("when")
  const [accessSortDir, setAccessSortDir] = useState<"asc" | "desc">("desc")

  const { data: eligibleFacilities = [], isLoading: eligibleLoading, isFetching: eligibleFetching, refetch: refetchEligible } =
    useAfyaSolarBillingEligibleFacilities()

  const { data: facilityRecord, isFetching: facilityFetching, refetch: refetchFacility } = useFacility(selectedFacilityId || undefined)
  const { data: servicePayments = [], isLoading: sapLoading, isFetching: sapFetching, refetch: refetchSap } =
    useServiceAccessPayments(selectedFacilityId || undefined, "afya-solar")
  const { data: subscriber, isLoading: subDetailLoading, isFetching: subDetailFetching, refetch: refetchSubscriber } =
    useAfyaSolarSubscriber(selectedFacilityId || undefined)

  const { summary: financialSummaryQuery, transactions, activeSubs, invoiceRequests: invoiceQuery } =
    useAdminPortfolioBilling(timeRange)
  const { data: summaryJson, isLoading: summaryLoading, isFetching: summaryFetching, refetch: refetchSummary } = financialSummaryQuery
  const { data: recentTx = [], isLoading: txLoading, isFetching: txFetching, refetch: refetchTx } = transactions
  const { data: activeSubsJson, isFetching: subsFetching, refetch: refetchSubs } = activeSubs
  const { data: invoiceRequests = [], isFetching: invoiceFetching, refetch: refetchInvoices } = invoiceQuery
  const {
    data: legacyFacilities = [],
    isLoading: legacyFacilitiesLoading,
    isFetching: legacyFacilitiesFetching,
    refetch: refetchLegacyFacilities,
  } = useComprehensiveFacilities(undefined, "active")

  const subsByFacility = useMemo(() => {
    const m = new Map<string, ActiveAfyaSolarSubRow>()
    for (const row of activeSubsJson?.data ?? []) m.set(row.facilityId, row)
    return m
  }, [activeSubsJson?.data])

  const filteredEligible = useMemo(() => {
    const q = facilitySearch.trim().toLowerCase()
    let list = [...eligibleFacilities]
    if (q) {
      list = list.filter((f) =>
        [f.facilityName, f.city, f.region, f.facilityId].some((v) => String(v || "").toLowerCase().includes(q))
      )
    }
    return list.sort((a, b) => a.facilityName.localeCompare(b.facilityName))
  }, [eligibleFacilities, facilitySearch])

  const completedAccessEligibleCount = useMemo(
    () => eligibleFacilities.filter((f) => f.hasCompletedSolarAccessPayment).length,
    [eligibleFacilities]
  )

  useEffect(() => {
    if (!selectedFacilityId) return
    if (!filteredEligible.some((f) => f.facilityId === selectedFacilityId)) setSelectedFacilityId("")
  }, [filteredEligible, selectedFacilityId])

  const selectedMeta = useMemo(
    () => eligibleFacilities.find((f) => f.facilityId === selectedFacilityId),
    [eligibleFacilities, selectedFacilityId]
  )

  const facilityFinancialTx = useMemo(
    () => (!selectedFacilityId ? recentTx : recentTx.filter((t) => t.facilityId === selectedFacilityId)),
    [recentTx, selectedFacilityId]
  )
  const facilityInvoices = useMemo(
    () => (!selectedFacilityId ? invoiceRequests : invoiceRequests.filter((r) => r.facilityId === selectedFacilityId)),
    [invoiceRequests, selectedFacilityId]
  )

  const sapStats = useMemo(() => {
    const rows = servicePayments as SapRow[]
    let completed = 0
    let pending = 0
    let failed = 0
    let totalPaid = 0
    let lastPaid: Date | null = null
    let lastPaidAmount = 0
    for (const p of rows) {
      const st = String(p.status || "").toLowerCase()
      if (st === "completed") {
        completed += 1
        const amt = Number(p.amount || 0)
        totalPaid += amt
        const d = new Date((p.paidAt ?? p.createdAt) as string | Date)
        if (!Number.isNaN(d.getTime()) && (!lastPaid || d > lastPaid)) {
          lastPaid = d
          lastPaidAmount = amt
        }
      } else if (st === "pending") pending += 1
      else if (st === "failed") failed += 1
    }
    return { completed, pending, failed, totalPaid, lastPaid, lastPaidAmount }
  }, [servicePayments])

  const sortedServicePayments = useMemo(() => {
    const rows = [...(servicePayments as SapRow[])]
    const dir = accessSortDir === "asc" ? 1 : -1
    rows.sort((a, b) => {
      if (accessSortKey === "amount") return (Number(a.amount || 0) - Number(b.amount || 0)) * dir
      if (accessSortKey === "status") return String(a.status || "").localeCompare(String(b.status || "")) * dir
      const ta = new Date((a.paidAt ?? a.createdAt ?? 0) as string | Date).getTime()
      const tb = new Date((b.paidAt ?? b.createdAt ?? 0) as string | Date).getTime()
      return (ta - tb) * dir
    })
    return rows
  }, [servicePayments, accessSortDir, accessSortKey])

  const pendingSapAmount = useMemo(
    () => (servicePayments as SapRow[]).filter((p) => String(p.status).toLowerCase() === "pending").reduce((s, p) => s + Number(p.amount || 0), 0),
    [servicePayments]
  )
  const latestCompletedCheckoutPlan = useMemo(() => {
    const completed = (servicePayments as SapRow[]).filter((p) => String(p.status).toLowerCase() === "completed")
    const sorted = [...completed].sort(
      (a, b) => new Date((b.paidAt ?? b.createdAt) as string | Date).getTime() - new Date((a.paidAt ?? a.createdAt) as string | Date).getTime()
    )
    return sorted[0]?.paymentPlan ?? null
  }, [servicePayments])

  const expirySoon = useMemo(() => {
    if (!subscriber?.subscriptionExpiry) return null
    const d = new Date(subscriber.subscriptionExpiry)
    if (Number.isNaN(d.getTime())) return null
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
    return { days, date: d }
  }, [subscriber?.subscriptionExpiry])

  const expiryProgress = useMemo(() => {
    if (!subscriber?.subscriptionStartDate || !subscriber?.subscriptionExpiry) return null
    const start = new Date(subscriber.subscriptionStartDate).getTime()
    const end = new Date(subscriber.subscriptionExpiry).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
    return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100))
  }, [subscriber?.subscriptionExpiry, subscriber?.subscriptionStartDate])

  const searchFilteredLegacy = useMemo(() => {
    const q = facilitySearch.trim().toLowerCase()
    let list = legacyFacilities as ComprehensiveFacility[]
    if (q) list = list.filter((f) => [f.name, f.city, f.region, f.id].some((v) => String(v || "").toLowerCase().includes(q)))
    return list
  }, [legacyFacilities, facilitySearch])

  const filteredLegacyFacilities = useMemo(() => {
    let list = searchFilteredLegacy
    if (legacyPlanTypeFilter !== "all") {
      list = list.filter((f) => {
        const sub = subsByFacility.get(f.id)
        const raw = (sub?.solarPlanType || sub?.planType || "").toUpperCase().trim()
        if (legacyPlanTypeFilter === "PAAS") return raw === "PAAS" || raw === "EAAS"
        return raw === legacyPlanTypeFilter
      })
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [searchFilteredLegacy, legacyPlanTypeFilter, subsByFacility])

  const invoicePendingByFacility = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of invoiceRequests) {
      if (r.status !== "pending") continue
      m.set(r.facilityId, (m.get(r.facilityId) || 0) + 1)
    }
    return m
  }, [invoiceRequests])

  const failedTxInLegacyView = useMemo(
    () => filteredLegacyFacilities.reduce((sum, f) => sum + Number(f.failedPayments ?? 0), 0),
    [filteredLegacyFacilities]
  )

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["afya-solar-billing-eligible-facilities"] })
    void refetchEligible()
    void refetchSummary()
    void refetchTx()
    void refetchSubs()
    void refetchInvoices()
    void refetchLegacyFacilities()
    if (selectedFacilityId) {
      void refetchSap()
      void refetchSubscriber()
      void refetchFacility()
    }
  }

  const busy =
    eligibleFetching ||
    summaryFetching ||
    txFetching ||
    subsFetching ||
    invoiceFetching ||
    legacyFacilitiesFetching ||
    (!!selectedFacilityId && (sapFetching || subDetailFetching || facilityFetching))

  const handleAccessSort = (key: AccessSortKey) => {
    if (accessSortKey === key) {
      setAccessSortDir((d) => (d === "asc" ? "desc" : "asc"))
      return
    }
    setAccessSortKey(key)
    setAccessSortDir("desc")
  }

  const onCopyFacilityId = async () => {
    if (!selectedFacilityId) return
    await navigator.clipboard?.writeText?.(selectedFacilityId)
    toast.success("Facility id copied.")
  }

  const exportAccessPaymentsCsv = () => {
    if (!selectedFacilityId || servicePayments.length === 0) return
    const rows = [
      ["id", "status", "amount", "currency", "paymentPlan", "packageName", "paidAt", "createdAt", "transactionId"],
      ...(servicePayments as SapRow[]).map((p) => [
        String(p.id ?? ""),
        String(p.status ?? ""),
        String(p.amount ?? ""),
        String(p.currency ?? ""),
        String(p.paymentPlan ?? ""),
        String(p.packageName ?? ""),
        p.paidAt ? String(p.paidAt) : "",
        p.createdAt ? String(p.createdAt) : "",
        String(p.transactionId ?? ""),
      ]),
    ]
    downloadCsv(`afya-solar-access-payments-${selectedFacilityId}.csv`, rows)
    toast.success("CSV exported for access payments.")
  }

  const activeSubRow = selectedFacilityId ? subsByFacility.get(selectedFacilityId) : undefined
  const facilityModelLabel =
    facilityRecord?.paymentModel != null && String(facilityRecord.paymentModel).trim() !== ""
      ? String(facilityRecord.paymentModel)
      : "—"

  const summary = summaryJson

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Solar billing & payments</h2>
          <p className="text-gray-600 text-sm mt-1 max-w-2xl">
            Use the facility list to enter a single billing context. Portfolio metrics stay visible for top-level monitoring.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {busy ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Updating
            </span>
          ) : null}
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={refreshAll} disabled={busy}>
            <RefreshCw className={cn("h-4 w-4 mr-1", busy && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Portfolio overview</CardTitle>
          <CardDescription>Global metrics for {timeRange}. Facility tabs appear below after a facility is selected.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Recognized revenue" subtitle={`Portfolio · ${timeRange}`} loading={summaryLoading} value={summary ? formatCurrency(summary.totalRevenue) : "—"} icon={TrendingUp} />
          <KpiCard title="Pending / at risk" subtitle="Portfolio (30d rule)" loading={summaryLoading} value={summary ? formatCurrency(summary.pendingPayments + summary.overduePayments) : "—"} icon={AlertCircle} />
          <KpiCard title="Success rate" subtitle="Portfolio window" loading={summaryLoading} value={summary ? `${summary.paymentSuccessRate.toFixed(1)}%` : "—"} icon={CreditCard} />
          <KpiCard title="Active subscriptions" subtitle="Distinct facilities" loading={summaryLoading} value={summary ? String(summary.activeSubscriptions) : "—"} icon={Building2} />
          <KpiCard title="Active subscribed facilities" subtitle={`Paid access: ${completedAccessEligibleCount}`} loading={eligibleLoading} value={String(eligibleFacilities.length)} icon={Building2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Facility selection</CardTitle>
          <CardDescription>
            Active facilities with active Afya Solar subscription are loaded from the database (paid rows appear first).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Name, city, region, or facility id…" value={facilitySearch} onChange={(e) => setFacilitySearch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Select facility (dropdown)</Label>
              <Select
                value={selectedFacilityId || "__portfolio__"}
                onValueChange={(v) => {
                  const next = v === "__portfolio__" ? "" : v
                  setSelectedFacilityId(next)
                  if (next) setActiveTab("overview")
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__portfolio__">Portfolio view</SelectItem>
                  {filteredEligible.map((f) => (
                    <SelectItem key={f.facilityId} value={f.facilityId}>
                      {f.facilityName}{f.hasCompletedSolarAccessPayment ? "" : " (payment pending)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Tip: use the dropdown for quick selection, and the facility list for richer context (location + last paid).
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Matches: {filteredEligible.length}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Facility list</Label>
            <div className="max-h-[280px] overflow-y-auto rounded-md border">
              <Button type="button" variant={!selectedFacilityId ? "secondary" : "ghost"} className="h-auto w-full justify-start rounded-none px-3 py-2 text-left" onClick={() => setSelectedFacilityId("")}>
                <div>
                  <p className="text-sm font-medium">Portfolio view</p>
                  <p className="text-xs text-muted-foreground">No facility selected</p>
                </div>
              </Button>
              {filteredEligible.map((f) => (
                <Button
                  key={f.facilityId}
                  type="button"
                  variant={selectedFacilityId === f.facilityId ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start rounded-none border-t px-3 py-2 text-left"
                  onClick={() => {
                    setSelectedFacilityId(f.facilityId)
                    setActiveTab("overview")
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{f.facilityName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[f.city, f.region].filter(Boolean).join(", ") || "No location"}
                      {f.lastCompletedPaidAt
                        ? ` · Last paid ${fmtDate(f.lastCompletedPaidAt)}`
                        : " · Payment pending"}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedFacilityId ? (
        <div className="space-y-4">
          <div className="sticky top-0 z-20 rounded-md border bg-background/95 p-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedMeta?.facilityName ?? subscriber?.name ?? "Facility"}</h3>
                <p className="text-xs text-muted-foreground font-mono">{selectedFacilityId}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant={statusBadgeVariant(subscriber?.subscriptionStatus)}>{subscriber?.subscriptionStatus ?? "unknown subscription"}</Badge>
                  <Badge variant={statusBadgeVariant(facilityRecord?.status)}>{facilityRecord?.status ?? "unknown facility status"}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onCopyFacilityId}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy id
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/admin/facility/${selectedFacilityId}?section=bills-payment`}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open bills
                  </Link>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportAccessPaymentsCsv} disabled={!servicePayments.length}>
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments & charts</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Completed access payments" subtitle="All time (facility)" loading={sapLoading} value={String(sapStats.completed)} icon={CreditCard} />
                <KpiCard title="Total paid (access)" subtitle="Completed sum" loading={sapLoading} value={formatCurrency(sapStats.totalPaid)} icon={TrendingUp} />
                <KpiCard title="Pending / failed" subtitle="Access rows" loading={sapLoading} value={`${sapStats.pending} / ${sapStats.failed}`} icon={AlertCircle} />
                <KpiCard title="Last completed payment" subtitle={sapStats.lastPaid ? sapStats.lastPaid.toLocaleString() : "—"} loading={sapLoading} value={sapStats.lastPaid ? formatCurrency(sapStats.lastPaidAmount) : "—"} icon={CreditCard} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Package &amp; plan</CardTitle>
                    <CardDescription className="text-xs">Afya Solar subscription context</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {subDetailLoading ? (
                      <div className="h-24 animate-pulse rounded bg-muted" />
                    ) : (
                      <>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Solar package</span><span className="font-medium text-right">{activeSubRow?.solarPackageName ?? selectedMeta?.solarPackageName ?? "—"}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Solar plan type</span><Badge variant="outline">{formatAfyaSolarPlanTypeLabel(activeSubRow?.solarPlanType ?? activeSubRow?.planType ?? selectedMeta?.solarPlanType)}</Badge></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Subscription amount</span><span>{subscriber?.subscriptionAmount != null ? formatCurrency(Number(subscriber.subscriptionAmount)) : "—"}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Period</span><span className="text-right text-xs">{subscriber?.subscriptionStartDate ? new Date(subscriber.subscriptionStartDate).toLocaleDateString() : "—"} → {subscriber?.subscriptionExpiry ? new Date(subscriber.subscriptionExpiry).toLocaleDateString() : "—"}</span></div>
                      </>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Payment model &amp; dues</CardTitle>
                    <CardDescription className="text-xs">Checkout plan vs facility billing model</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Solar checkout plan</span><Badge variant="outline">{formatPaymentPlanLabel(latestCompletedCheckoutPlan)}</Badge></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Facility billing model</span><Badge variant="secondary" className="font-normal">{facilityRecord?.paymentModel ? String(facilityRecord.paymentModel) : "—"}</Badge></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Pending access payments</span><span className="font-medium">{formatCurrency(pendingSapAmount)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">Pending invoice requests</span><span>{facilityInvoices.filter((i) => i.status === "pending").length} open</span></div>
                    {expiryProgress != null ? (<div className="space-y-1"><p className="text-xs text-muted-foreground">Subscription lifecycle progress</p><Progress value={expiryProgress} /></div>) : null}
                    {expirySoon && expirySoon.days <= 60 ? (
                      <div className={cn("rounded-md border px-3 py-2 text-xs", expirySoon.days <= 14 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-muted bg-muted/40")}>
                        Subscription ends in <strong>{expirySoon.days}</strong> day{expirySoon.days === 1 ? "" : "s"} ({expirySoon.date.toLocaleDateString()}).
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <AdminSolarBillingCharts payments={servicePayments} timeRange={timeRange} isLoading={sapLoading} />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Afya Solar access payments</CardTitle>
                  <CardDescription className="text-xs">Rows: {sortedServicePayments.length}</CardDescription>
                </CardHeader>
                <CardContent>
                  {sapLoading ? (
                    <div className="flex justify-center py-10"><div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : sortedServicePayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No access payment rows.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border max-h-[360px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50 z-10">
                          <TableRow>
                            <TableHead><Button variant="ghost" className="h-auto p-0" onClick={() => handleAccessSort("when")}>When <ArrowUpDown className="h-3 w-3 ml-1" /></Button></TableHead>
                            <TableHead><Button variant="ghost" className="h-auto p-0" onClick={() => handleAccessSort("status")}>Status <ArrowUpDown className="h-3 w-3 ml-1" /></Button></TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Package</TableHead>
                            <TableHead className="text-right"><Button variant="ghost" className="h-auto p-0 ml-auto" onClick={() => handleAccessSort("amount")}>Amount <ArrowUpDown className="h-3 w-3 ml-1" /></Button></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedServicePayments.map((p) => (
                            <TableRow key={String(p.id)}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate((p.paidAt ?? p.createdAt) as string | Date | null)}</TableCell>
                              <TableCell><Badge variant={statusBadgeVariant(p.status)}>{String(p.status || "—")}</Badge></TableCell>
                              <TableCell>{formatPaymentPlanLabel(p.paymentPlan)}</TableCell>
                              <TableCell className="max-w-[220px] truncate">{String(p.packageName ?? "—")}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(p.amount || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />Afya Solar invoice requests</CardTitle>
                  <CardDescription className="text-xs">Rows: {facilityInvoices.length}</CardDescription>
                </CardHeader>
                <CardContent>
                  {invoiceFetching && facilityInvoices.length === 0 ? (
                    <div className="flex justify-center py-8"><div className="h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : facilityInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No invoice requests for this facility.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead>Created</TableHead><TableHead>Package</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...facilityInvoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</TableCell>
                              <TableCell>{r.packageName}</TableCell>
                              <TableCell><Badge variant="outline">{formatAfyaSolarPlanTypeLabel(r.paymentPlan)}</Badge></TableCell>
                              <TableCell><Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge></TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(r.amount || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ledger" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Financial transactions (feed)</CardTitle>
                  <CardDescription className="text-xs">Rows: {facilityFinancialTx.length}</CardDescription>
                </CardHeader>
                <CardContent>
                  {txLoading ? (
                    <div className="flex justify-center py-10"><div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : facilityFinancialTx.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No transactions in this window.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border max-h-[320px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50"><TableRow><TableHead>When</TableHead><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {facilityFinancialTx.slice(0, 60).map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(t.createdAt)}</TableCell>
                              <TableCell>{t.type}</TableCell>
                              <TableCell><Badge variant={statusBadgeVariant(t.status)}>{t.status}</Badge></TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(t.amount || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Subscription payment history</CardTitle>
                  <CardDescription className="text-xs">Rows: {subscriber?.subscriptionPaymentHistory?.length ?? 0}</CardDescription>
                </CardHeader>
                <CardContent>
                  {subDetailLoading ? (
                    <div className="flex justify-center py-8"><div className="h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : !subscriber?.subscriptionPaymentHistory?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No subscription payment history on file.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border max-h-[320px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-gray-50"><TableRow><TableHead>When</TableHead><TableHead>Status</TableHead><TableHead>Txn status</TableHead><TableHead>Cycle</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {subscriber.subscriptionPaymentHistory.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(row.createdAt)}</TableCell>
                              <TableCell><Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge></TableCell>
                              <TableCell><Badge variant="secondary" className="font-normal">{row.transactionStatus ?? "—"}</Badge></TableCell>
                              <TableCell className="text-xs">{row.billingCycle}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(Number(row.amount || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Getting started</CardTitle>
            <CardDescription>Select a facility to unlock payment analytics, invoices, and transaction ledgers.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>- Facilities are loaded from active Afya Solar subscriptions; entries with completed access payment are prioritized.</p>
            <p>- Use the search and list to quickly jump across facilities.</p>
            <p>- Portfolio cards above remain visible for top-level monitoring.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild><Button type="button" variant="outline" size="sm">Open legacy portfolio table</Button></DialogTrigger>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>All active facilities (legacy table)</DialogTitle>
              <DialogDescription>Comprehensive facilities merged with active solar subscriptions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <Select value={legacyPlanTypeFilter} onValueChange={setLegacyPlanTypeFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Afya Solar plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plan types</SelectItem>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="INSTALLMENT">INSTALLMENT</SelectItem>
                    <SelectItem value="PAAS">PAAS / EAAS</SelectItem>
                  </SelectContent>
                </Select>
                <KpiCard title="Failed tx in legacy view" subtitle="Sum of failed transactions" loading={legacyFacilitiesLoading} value={String(failedTxInLegacyView)} icon={XCircle} />
              </div>
              {legacyFacilitiesLoading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : filteredLegacyFacilities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No facilities for this filter.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border max-h-[420px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-50">
                      <TableRow>
                        <TableHead>Facility</TableHead><TableHead>Location</TableHead><TableHead>Solar package</TableHead><TableHead>Solar plan</TableHead><TableHead>Facility model</TableHead><TableHead className="text-right">Inv. pending</TableHead><TableHead className="text-right">Completed</TableHead><TableHead className="text-right">Pending</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Paid amount</TableHead><TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLegacyFacilities.map((f) => {
                        const sub = subsByFacility.get(f.id)
                        const solarPlan = formatAfyaSolarPlanTypeLabel(sub?.solarPlanType || sub?.planType)
                        const pendingInv = invoicePendingByFacility.get(f.id) ?? 0
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium"><div className="flex flex-col gap-1"><span>{f.name}</span><Button variant="link" className="h-auto p-0 text-xs justify-start" asChild><Link href={`/dashboard/admin/facility/${f.id}?section=bills-payment`}>Bills view</Link></Button></div></TableCell>
                            <TableCell>{[f.city, f.region].filter(Boolean).join(", ") || "—"}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{sub?.solarPackageName || "—"}</TableCell>
                            <TableCell><Badge variant="outline">{solarPlan}</Badge></TableCell>
                            <TableCell><Badge variant="secondary" className="font-normal">{f.paymentModel ? String(f.paymentModel) : "—"}</Badge></TableCell>
                            <TableCell className="text-right">{pendingInv > 0 ? pendingInv : "—"}</TableCell>
                            <TableCell className="text-right">{f.completedPayments ?? 0}</TableCell>
                            <TableCell className="text-right">{f.pendingPayments ?? 0}</TableCell>
                            <TableCell className="text-right">{f.failedPayments ?? 0}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(Number(f.totalPaidAmount || 0))}</TableCell>
                            <TableCell className="text-right"><Badge variant={f.status === "active" ? "default" : "secondary"}>{f.status}</Badge></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function KpiCard({
  title,
  subtitle,
  value,
  loading,
  icon: Icon,
}: {
  title: string
  subtitle: string
  value: string
  loading: boolean
  icon: typeof TrendingUp
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            <p className="text-xl font-bold mt-2 text-gray-900">
              {loading ? <span className="inline-block h-7 w-24 animate-pulse rounded bg-gray-100" /> : value}
            </p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/40 flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}
