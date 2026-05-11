"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Copy,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFacility, useFacilities } from "@/hooks/use-facilities"
import { useAfyaSolarSubscribers as useAfyaSolarSubscriberByFacility } from "@/hooks/use-afyasolar-subscribers"
import { useBills } from "@/hooks/use-bills"
import { useServiceAccessPayments } from "@/hooks/use-service-access-payments"
import {
  useAdminPortfolioBilling,
  useAfyaSolarBillingEligibleFacilities,
} from "@/hooks/use-admin-portfolio-billing"
import { formatCurrency, cn } from "@/lib/utils"
import { BillsSubscriptionView } from "@/components/dashboard/bills-subscription-view"
import { AdminPaygFinancingSection } from "@/components/payg-financing/admin-payg-financing-section"

type FacilityOption = {
  id: string
  name: string
  city?: string | null
  region?: string | null
  hasAfyaSolar?: boolean
}

export function AdminPortfolioSolarBilling() {
  const queryClient = useQueryClient()
  const [selectedFacilityId, setSelectedFacilityId] = useState("")
  const [facilitySearch, setFacilitySearch] = useState("")

  // Facility directory (all active facilities from the `facilities` table).
  const {
    data: allFacilities = [],
    isLoading: allFacilitiesLoading,
    isFetching: allFacilitiesFetching,
    refetch: refetchAllFacilities,
  } = useFacilities()

  // Admin solar billing eligibility (used purely to flag Afya Solar subscribers).
  const {
    data: eligibleFacilities = [],
    isLoading: eligibleLoading,
    isFetching: eligibleFetching,
    refetch: refetchEligible,
  } = useAfyaSolarBillingEligibleFacilities()

  // Admin portfolio billing — used for the summary metrics and per-facility invoice list.
  const { summary, invoiceRequests } = useAdminPortfolioBilling("30d")
  const {
    data: summaryJson,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = summary
  const {
    data: invoiceRows = [],
    isFetching: invoicesFetching,
    refetch: refetchInvoices,
  } = invoiceRequests

  // Per-facility data (only fetched when a facility is selected).
  const { data: facilityRecord, isFetching: facilityFetching, refetch: refetchFacility } =
    useFacility(selectedFacilityId || undefined)
  const { data: bills, isFetching: billsFetching, refetch: refetchBills } =
    useBills(selectedFacilityId || undefined)
  const {
    data: servicePayments = [],
    isFetching: sapFetching,
    refetch: refetchSap,
  } = useServiceAccessPayments(
    selectedFacilityId || undefined,
    "afya-solar",
  )
  const {
    data: afyaSolarSubscriber,
    isFetching: subscriberFetching,
    refetch: refetchSubscriber,
  } = useAfyaSolarSubscriberByFacility(selectedFacilityId || undefined)

  const eligibleSet = useMemo(
    () => new Set(eligibleFacilities.map((f) => f.facilityId)),
    [eligibleFacilities],
  )

  const facilityOptions: FacilityOption[] = useMemo(() => {
    return (allFacilities ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      city: f.city ?? null,
      region: f.region ?? null,
      hasAfyaSolar: eligibleSet.has(f.id),
    }))
  }, [allFacilities, eligibleSet])

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.trim().toLowerCase()
    let list = [...facilityOptions]
    if (q) {
      list = list.filter((f) =>
        [f.name, f.city, f.region, f.id].some((v) =>
          String(v || "").toLowerCase().includes(q),
        ),
      )
    }
    // Surface Afya Solar subscribers first, then sort by name.
    return list.sort((a, b) => {
      if (a.hasAfyaSolar !== b.hasAfyaSolar) return a.hasAfyaSolar ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [facilityOptions, facilitySearch])

  useEffect(() => {
    if (!selectedFacilityId) return
    if (!facilityOptions.some((f) => f.id === selectedFacilityId)) {
      setSelectedFacilityId("")
    }
  }, [facilityOptions, selectedFacilityId])

  const selectedFacility = useMemo(
    () => facilityOptions.find((f) => f.id === selectedFacilityId) ?? null,
    [facilityOptions, selectedFacilityId],
  )

  const facilityInvoices = useMemo(
    () =>
      !selectedFacilityId
        ? invoiceRows
        : invoiceRows.filter((r) => r.facilityId === selectedFacilityId),
    [invoiceRows, selectedFacilityId],
  )

  // ------ Few admin metrics summary ------
  const pendingInvoiceTotal = useMemo(
    () =>
      invoiceRows
        .filter((r) => r.status === "pending")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [invoiceRows],
  )

  const portfolioMetrics = useMemo(() => {
    return {
      totalFacilities: facilityOptions.length,
      solarSubscribers: eligibleFacilities.length,
      activeSubscriptions: summaryJson?.activeSubscriptions ?? 0,
      recognizedRevenue: summaryJson?.totalRevenue ?? 0,
      pendingPayments:
        (summaryJson?.pendingPayments ?? 0) +
        (summaryJson?.overduePayments ?? 0),
      pendingInvoiceTotal,
    }
  }, [
    facilityOptions.length,
    eligibleFacilities.length,
    summaryJson?.activeSubscriptions,
    summaryJson?.totalRevenue,
    summaryJson?.pendingPayments,
    summaryJson?.overduePayments,
    pendingInvoiceTotal,
  ])

  const refreshAll = () => {
    void queryClient.invalidateQueries({
      queryKey: ["afya-solar-billing-eligible-facilities"],
    })
    void refetchAllFacilities()
    void refetchEligible()
    void refetchSummary()
    void refetchInvoices()
    if (selectedFacilityId) {
      void refetchFacility()
      void refetchBills()
      void refetchSap()
      void refetchSubscriber()
    }
  }

  const busy =
    allFacilitiesFetching ||
    eligibleFetching ||
    summaryFetching ||
    invoicesFetching ||
    (!!selectedFacilityId &&
      (facilityFetching ||
        billsFetching ||
        sapFetching ||
        subscriberFetching))

  const handleCopyId = async () => {
    if (!selectedFacilityId) return
    await navigator.clipboard?.writeText?.(selectedFacilityId)
    toast.success("Facility id copied.")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bills &amp; Payment</h2>
          <p className="text-gray-600 text-sm mt-1 max-w-2xl">
            Select a facility from the directory to inspect the same Bills
            &amp; Subscription and PAYG &amp; Financing view that facility users
            see.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Updating
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={busy}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", busy && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Admin metrics summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active facilities"
          subtitle={`${portfolioMetrics.solarSubscribers} on Afya Solar`}
          value={String(portfolioMetrics.totalFacilities || "—")}
          icon={Building2}
          loading={allFacilitiesLoading || eligibleLoading}
        />
        <MetricCard
          title="Recognized revenue"
          subtitle="Portfolio · last 30 days"
          value={formatCurrency(portfolioMetrics.recognizedRevenue)}
          icon={TrendingUp}
          loading={summaryLoading}
        />
        <MetricCard
          title="Pending / at risk"
          subtitle="Pending + overdue (30d)"
          value={formatCurrency(portfolioMetrics.pendingPayments)}
          icon={AlertCircle}
          loading={summaryLoading}
        />
        <MetricCard
          title="Active subscriptions"
          subtitle="Solar customers"
          value={String(portfolioMetrics.activeSubscriptions || "—")}
          icon={CheckCircle}
          loading={summaryLoading}
        />
      </div>

      {/* Facility selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Facility selection</CardTitle>
          <CardDescription>
            All active facilities from the facilities table. Afya Solar
            subscribers are listed first.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Name, city, region, or id…"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Select facility (dropdown)
              </Label>
              <Select
                value={selectedFacilityId || "__portfolio__"}
                onValueChange={(v) =>
                  setSelectedFacilityId(v === "__portfolio__" ? "" : v)
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__portfolio__">
                    No facility selected
                  </SelectItem>
                  {filteredFacilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.hasAfyaSolar ? "" : " (no Afya Solar)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Matches: {filteredFacilities.length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Facility list
            </Label>
            <div className="max-h-[280px] overflow-y-auto rounded-md border">
              <Button
                type="button"
                variant={!selectedFacilityId ? "secondary" : "ghost"}
                className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                onClick={() => setSelectedFacilityId("")}
              >
                <div>
                  <p className="text-sm font-medium">No facility selected</p>
                  <p className="text-xs text-muted-foreground">
                    Pick a facility to view its bills, subscription, and PAYG
                    details.
                  </p>
                </div>
              </Button>
              {filteredFacilities.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant={selectedFacilityId === f.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start rounded-none border-t px-3 py-2 text-left"
                  onClick={() => setSelectedFacilityId(f.id)}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[f.city, f.region].filter(Boolean).join(", ") ||
                          "No location"}
                      </p>
                    </div>
                    {f.hasAfyaSolar ? (
                      <Badge variant="default" className="shrink-0">
                        Afya Solar
                      </Badge>
                    ) : null}
                  </div>
                </Button>
              ))}
              {filteredFacilities.length === 0 && !allFacilitiesLoading ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No facilities match the search.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected facility context strip */}
      {selectedFacilityId ? (
        <div className="rounded-md border bg-background/95 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedFacility?.name ?? facilityRecord?.name ?? "Facility"}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {selectedFacilityId}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {selectedFacility?.hasAfyaSolar
                    ? "Afya Solar subscriber"
                    : "No active Afya Solar"}
                </Badge>
                {facilityRecord?.paymentModel ? (
                  <Badge variant="secondary" className="font-normal">
                    {String(facilityRecord.paymentModel)}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyId}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy id
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedFacilityId("")}
              >
                Clear selection
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Two tabs only */}
      <Tabs defaultValue="bills" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="bills">Bills &amp; Subscription</TabsTrigger>
          <TabsTrigger value="payg">PAYG &amp; Financing</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="mt-4 space-y-4">
          {selectedFacilityId ? (
            <BillsSubscriptionView
              afyaSolarSubscriber={afyaSolarSubscriber ?? null}
              bills={bills}
              serviceAccessPayments={servicePayments}
              invoiceRequests={facilityInvoices}
              facility={facilityRecord ?? null}
              canShowPayNow={false}
            />
          ) : (
            <SelectFacilityEmptyState
              icon={Wallet}
              title="Select a facility to view bills & subscription"
              description="Pick a facility from the directory above. The admin sees the same Bills & Subscription view facility users have, with their package, payment history, invoice requests, and bills."
            />
          )}
        </TabsContent>

        <TabsContent value="payg" className="mt-4 space-y-4">
          <AdminPaygFinancingSection
            facilityId={selectedFacilityId || undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({
  title,
  subtitle,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  subtitle: string
  value: string
  icon: typeof TrendingUp
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            <p className="text-xl font-bold mt-2 text-gray-900">
              {loading ? (
                <span className="inline-block h-7 w-24 animate-pulse rounded bg-gray-100" />
              ) : (
                value
              )}
            </p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/40 flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}

function SelectFacilityEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof TrendingUp
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-green-700" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
