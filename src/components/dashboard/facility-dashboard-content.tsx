"use client"

import { useState, useMemo, useEffect, Key } from "react"
import type { ReactElement, ReactNode, AwaitedReactNode, JSXElementConstructor } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Zap, 
  DollarSign, 
  TrendingUp, 
  Plug,
  Sun,
  Battery,
  BarChart3,
  Calendar,
  Clock,
  TrendingDown,
  Gauge,
  Menu,
  X,
  LayoutDashboard,
  Bell,
  FileText,
  Receipt,
  Award,
  Wrench,
  Home,
  Settings,
  Sparkles,
  Gift,
  CreditCard,
  Activity,
  Leaf,
  CheckCircle,
  XCircle,
  Download,
  CloudSun,
} from "lucide-react"
import Image from "next/image"
import { LogoutButton } from "@/components/logout-button"
import { FacilitySettings } from "@/components/facility-settings"
import { FeatureRequestDialog } from "@/components/dashboard/feature-request-dialog"
import { ReferralInviteDialog } from "@/components/dashboard/referral-invite-dialog"
import { FacilityCarbonCredits } from "@/components/dashboard/facility-carbon-credits"
import { FacilityMeterEfficiencyDashboard } from "@/components/efficiency/facility-meter-efficiency-dashboard"
import { SolarPackagesSelection } from "@/components/solar/solar-packages-selection"
import type { SizingSummary, MeuSummary } from "@/components/solar/afya-solar-sizing-tool"
import { FacilityIntelligencePlatform } from "@/components/intelligence/facility-intelligence-platform"
import { IntelligenceChartGrid } from "@/components/intelligence/energy-charts"
import { buildIntelligenceRecommendations, type SectionScores } from "@/lib/intelligence/recommendations"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDevices } from "@/hooks/use-devices"
import { useBills } from "@/hooks/use-bills"
import { useServiceAccessPayments } from "@/hooks/use-service-access-payments"
import { useAfyaSolarInvoiceRequests } from "@/hooks/use-afya-solar-invoice-requests"
import { useAfyaSolarSubscribers } from "@/hooks/use-afyasolar-subscribers"
import { useEnergyData } from "@/hooks/use-energy-data"
import { useSubscribe, useSubscriptions } from "@/hooks/use-subscriptions"
import { formatCurrency } from "@/lib/utils"
import type { Facility, LiveEnergyData } from "@/types"
import { cn } from "@/lib/utils"
import { getFacilityNavItems, getAfyaLinkAssessmentUrl, type NavSection } from "@/lib/dashboard/facility-nav"
import { mapPlanTypeToPaymentPlan } from "@/lib/dashboard/afya-solar-plan-type"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ServiceAccessPaymentDialog } from "@/components/services/service-access-payment-dialog"
import { PaygFinancingSection } from "@/components/payg-financing/payg-financing-section"
import { BillsSubscriptionView } from "@/components/dashboard/bills-subscription-view"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

interface FacilityDashboardContentProps {
  facility?: Facility | null
  liveData?: LiveEnergyData | null
  adminMode?: boolean
  activeSection?: NavSection
  onSectionChange?: (section: NavSection) => void
}

interface FacilityNotification {
  id: string
  type: string
  title: string
  message: string
  serviceName?: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  isRead: boolean
  isDismissed: boolean
  actionUrl?: string | null
  actionLabel?: string | null
  createdAt: string
}

export function FacilityDashboardContent({ 
  facility, 
  liveData, 
  adminMode = false, 
  activeSection, 
  onSectionChange,
}: FacilityDashboardContentProps) {
  const facilityId = facility?.id
  const router = useRouter()
  const { data: devices } = useDevices(facilityId)
  const { data: energyData } = useEnergyData(undefined, facilityId)
  const { data: bills } = useBills(facilityId)
  const { data: serviceAccessPayments } = useServiceAccessPayments(facilityId, 'afya-solar')
  const { data: invoiceRequests } = useAfyaSolarInvoiceRequests(facilityId)
  const { data: afyaSolarSubscriber } = useAfyaSolarSubscribers(facilityId)
  const subscribeMutation = useSubscribe()

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  
  const { refetch: refetchSubscriptions } = useSubscriptions(facilityId)

  // Local state for Afya Solar EEAT planning summaries
  const [sizingSummary, setSizingSummary] = useState<SizingSummary | null>(null)
  const [meuSummary, setMeuSummary] = useState<MeuSummary | null>(null)
  const [bmiSummary, setBmiSummary] = useState<{ score: number | null; bmiPercent: number | null } | null>(null)
  const [sectionScores, setSectionScores] = useState<SectionScores | null>(null)
  
  // Avoid noisy logs in the dashboard; keep this screen production-ready.
  
  // Refetch subscription check after successful subscription
  useEffect(() => {
    if (subscribeMutation.isSuccess) {
      refetchSubscriptions()
    }
  }, [subscribeMutation.isSuccess, refetchSubscriptions])
  const searchParams = useSearchParams()
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')

  const openAfyaSolarPaymentDialog = () => {
    if (!afyaSolarSubscriber) {
      toast.error("No active Afya Solar package found for payments.")
      return
    }

    if (!afyaSolarSubscriber.packageId || !afyaSolarSubscriber.packageName) {
      toast.error("Your package details are missing. Please contact support.")
      return
    }

    setPaymentDialogOpen(true)
  }

  const canShowPayNow =
    Boolean(afyaSolarSubscriber?.packageId) &&
    Boolean(afyaSolarSubscriber?.packageName) &&
    afyaSolarSubscriber?.subscriptionStatus !== "cancelled"

  const completedServiceAccessPayments = useMemo(() => {
    return (serviceAccessPayments || []).filter((p: any) => p?.status === 'completed')
  }, [serviceAccessPayments])

  const pendingServiceAccessPayments = useMemo(() => {
    return (serviceAccessPayments || []).filter((p: any) => p?.status && p.status !== 'completed')
  }, [serviceAccessPayments])


  // Use admin-provided section or fall back to internal state
  const [internalActiveSection, setInternalActiveSection] = useState<NavSection>('overview')
  const currentActiveSection = adminMode ? (activeSection || internalActiveSection) : internalActiveSection
  const setCurrentSection = adminMode && onSectionChange ? onSectionChange : setInternalActiveSection
  
  const [sidebarOpen, setSidebarOpen] = useState(false) // Start closed, will be set in useEffect
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Facility notifications (for Afya Solar and related services)
  const [facilityNotifications, setFacilityNotifications] = useState<FacilityNotification[]>([])
  const [facilityNotificationsLoading, setFacilityNotificationsLoading] = useState(false)
  const [facilityUnreadCount, setFacilityUnreadCount] = useState(0)

  // Set sidebar initial state based on screen size
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1024 // lg breakpoint
    setSidebarOpen(isDesktop)
  }, [])

  // Check URL parameter for deep links (facility users); admins use parent-controlled section
  useEffect(() => {
    if (adminMode) return
    const section = searchParams?.get('section')
    if (section === 'subscription') {
      setInternalActiveSection('subscription')
    }
  }, [searchParams, adminMode])

  // Admin impersonation must not land on assessment workflows (URL deep links)
  useEffect(() => {
    if (!adminMode || !onSectionChange) return
    const section = activeSection ?? internalActiveSection
    if (section === "energy-efficiency" || section === "climate-resilience") {
      onSectionChange("overview")
    }
  }, [adminMode, activeSection, internalActiveSection, onSectionChange])

  // Load facility notifications once on mount (facility users only)
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setFacilityNotificationsLoading(true)
        const response = await fetch('/api/notifications?limit=50')
        if (!response.ok) {
          throw new Error('Failed to fetch notifications')
        }
        const data = await response.json()
        const rawList: FacilityNotification[] = Array.isArray(data.notifications) ? data.notifications : []
        // Focus on Afya Solar and generic/system notifications
        const filtered = rawList.filter((n) => !n.serviceName || n.serviceName === 'afya-solar')
        setFacilityNotifications(filtered)
        setFacilityUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
      } catch (error) {
        console.error('Error fetching facility notifications:', error)
      } finally {
        setFacilityNotificationsLoading(false)
      }
    }

    if (!adminMode) {
      fetchNotifications()
    }
  }, [adminMode])
  const sectionTitleClass = "text-base font-semibold text-gray-900"
  const metricTitleClass = "text-xs font-medium text-gray-700"
  const metaTextClass = "text-xs text-gray-500"
  const panelCardClass = "shadow-sm border border-gray-100 bg-white"
  const subtleBadgeClass = "bg-gray-50 text-gray-700 border-gray-200"

  // Prefer live subscriber remaining balance when available, otherwise fall back to facility.creditBalance
  const subscriberCredit =
    afyaSolarSubscriber && afyaSolarSubscriber.remainingBalance !== undefined
      ? Number(afyaSolarSubscriber.remainingBalance)
      : null

  const creditBalance =
    subscriberCredit !== null
      ? subscriberCredit
      : facility?.creditBalance
      ? Number(facility.creditBalance)
      : 0
  const currentUsage = liveData?.currentUsage || 0
  const batteryLevel = liveData?.batteryLevel

  // Calculate metrics from energy data
  const metrics = useMemo(() => {
    if (!energyData || energyData.length === 0) {
      return {
        totalConsumption: 0,
        avgPower: 0,
        maxPower: 0,
        totalSolarGeneration: 0,
        avgBatteryLevel: 0,
        gridConsumption: 0,
        solarPercentage: 0,
        costSavings: 0,
        efficiency: 0,
      }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    let filteredData = energyData
    if (timeRange === 'today') {
      filteredData = energyData.filter((d: { timestamp: string | number | Date }) => new Date(d.timestamp) >= today)
    } else if (timeRange === 'week') {
      filteredData = energyData.filter((d: { timestamp: string | number | Date }) => new Date(d.timestamp) >= weekAgo)
    } else if (timeRange === 'month') {
      filteredData = energyData.filter((d: { timestamp: string | number | Date }) => new Date(d.timestamp) >= monthAgo)
    }

    const totalConsumption = filteredData.reduce((sum: number, d: { energy: any }) => sum + Number(d.energy), 0)
    const avgPower = filteredData.length > 0 
      ? filteredData.reduce((sum: number, d: { power: any }) => sum + Number(d.power), 0) / filteredData.length 
      : 0
    const maxPower = Math.max(...filteredData.map((d: { power: any }) => Number(d.power)), 0)
    const totalSolarGeneration = filteredData.reduce((sum: number, d: { solarGeneration: any }) => sum + (Number(d.solarGeneration) || 0), 0)
    const batteryLevels = filteredData.filter((d: { batteryLevel: any }) => d.batteryLevel).map((d: { batteryLevel: any }) => Number(d.batteryLevel))
    const avgBatteryLevel = batteryLevels.length > 0
      ? batteryLevels.reduce((sum: any, b: any) => sum + b, 0) / batteryLevels.length
      : 0

    const gridConsumption = totalConsumption - totalSolarGeneration
    const solarPercentage = totalConsumption > 0 ? (totalSolarGeneration / totalConsumption) * 100 : 0
    
    // Cost calculations (TSh per kWh)
    const ratePerKwh = 357.14285
    // Baseline: all energy from grid
    const baselineGridCost = totalConsumption * ratePerKwh
    // Actual: only non-solar energy from grid
    const actualGridCost = Math.max(0, gridConsumption) * ratePerKwh
    const costSavings = Math.max(0, baselineGridCost - actualGridCost)
    
    // Efficiency: solar generation / total consumption
    const efficiency = totalConsumption > 0 ? (totalSolarGeneration / totalConsumption) * 100 : 0

    return {
      totalConsumption,
      avgPower,
      maxPower,
      totalSolarGeneration,
      avgBatteryLevel,
      gridConsumption,
      solarPercentage,
      costSavings,
      efficiency,
    }
  }, [energyData, timeRange])

  const subscribedServices = useMemo(() => [] as { label: string; href: string; icon: typeof CreditCard }[], [])

  const sidebarNavItems = useMemo(() => getFacilityNavItems({ adminMode }), [adminMode])

  const { data: overviewCarbonCredits = [] } = useQuery({
    queryKey: ["overview-carbon-credits", facilityId],
    queryFn: async () => {
      if (!facilityId) return []
      const params = new URLSearchParams({ facilityId, limit: "12" })
      const res = await fetch(`/api/facility/carbon-credits/calculate?${params.toString()}`)
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json?.data) ? json.data : []
    },
    // Overview Carbon Credit card must work in BOTH facility and admin mode.
    // Backend is DB-driven from assessment snapshots, and admins are authorized to access any facility.
    enabled: !!facilityId,
    initialData: [],
    refetchInterval: 60000,
  })

  const {
    data: assessmentOverviewSnapshot,
    isLoading: isAssessmentSnapshotLoading,
    isFetching: isAssessmentSnapshotFetching,
  } = useQuery({
    queryKey: ["overview-assessment-snapshot", facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      if (!facilityId) return null
      const res = await fetch(`/api/facility/${facilityId}/assessment-reports`, { cache: "no-store" })
      if (!res.ok) return null
      const json = await res.json()
      if (!json?.success) return null
      return {
        energy: json.latestEnergy?.payload ?? null,
        climate: json.latestClimate?.payload ?? null,
      }
    },
    refetchInterval: 60000,
  })

  const persistedSizingSummary =
    (assessmentOverviewSnapshot?.energy as any)?.sizingSummary ??
    (assessmentOverviewSnapshot?.energy as any)?.sizingData?.sizingSummary ??
    null
  const persistedOperations =
    (assessmentOverviewSnapshot?.energy as any)?.operationsData ??
    (assessmentOverviewSnapshot?.energy as any)?.operations ??
    null
  const persistedMeuSummary =
    (assessmentOverviewSnapshot?.energy as any)?.meuSummary ??
    (assessmentOverviewSnapshot?.energy as any)?.meu ??
    (assessmentOverviewSnapshot?.energy as any)?.sizingData?.meuSummary ??
    null
  const persistedFacilityExtras =
    (assessmentOverviewSnapshot?.energy as any)?.facilityData ??
    (assessmentOverviewSnapshot?.energy as any)?.facilityContext ??
    (assessmentOverviewSnapshot?.energy as any)?.sizingData?.facilityData ??
    null
  const persistedQuoteData =
    (assessmentOverviewSnapshot?.energy as any)?.quoteData ??
    (assessmentOverviewSnapshot?.energy as any)?.quote ??
    null
  const persistedBmiTrendJson =
    (assessmentOverviewSnapshot?.energy as any)?.bmiTrendJson ??
    (assessmentOverviewSnapshot?.energy as any)?.bmiTrend ??
    null
  const persistedAssessmentScore =
    typeof persistedOperations?.assessmentScore === "number" ? Number(persistedOperations.assessmentScore) : null
  const persistedBmiPercent = persistedAssessmentScore !== null ? Math.round((persistedAssessmentScore / 40) * 100) : null
  const persistedClimateRcsRaw =
    (assessmentOverviewSnapshot?.climate as any)?.score?.rcs ??
    (assessmentOverviewSnapshot?.climate as any)?.climateScore?.rcs
  const persistedClimateRcs =
    persistedClimateRcsRaw !== undefined && persistedClimateRcsRaw !== null ? Number(persistedClimateRcsRaw) : null
  const assessedPowerKw =
    typeof persistedSizingSummary?.solarArraySize === "number" ? Number(persistedSizingSummary.solarArraySize) : null
  const assessedDailyLoadKwh =
    typeof persistedSizingSummary?.totalDailyLoad === "number" ? Number(persistedSizingSummary.totalDailyLoad) : null
  const assessmentSnapshotBusy = isAssessmentSnapshotLoading || isAssessmentSnapshotFetching
  const hasAssessmentSnapshot = Boolean(assessmentOverviewSnapshot?.energy || assessmentOverviewSnapshot?.climate)

  const persistedSectionScores: SectionScores | null =
    persistedOperations?.sectionScores && typeof persistedOperations.sectionScores === "object"
      ? (persistedOperations.sectionScores as SectionScores)
      : null

  const persistedBmiForRecommendations =
    persistedAssessmentScore !== null ? { score: persistedAssessmentScore, bmiPercent: persistedBmiPercent } : null

  const recommendations = buildIntelligenceRecommendations(
    persistedSizingSummary as SizingSummary | null,
    persistedMeuSummary as MeuSummary | null,
    persistedBmiForRecommendations,
    persistedSectionScores
  )

  const bmiTrend =
    Array.isArray(persistedBmiTrendJson) && persistedBmiTrendJson.length > 0
      ? (persistedBmiTrendJson as { date: string; value: number }[])
      : undefined

  const monthlyBaselineCostTzs =
    typeof persistedQuoteData?.current_energy_cost?.total_baseline_cost_monthly_tzs === "number"
      ? Number(persistedQuoteData.current_energy_cost.total_baseline_cost_monthly_tzs)
      : null
  const monthlyAfterSolarCostTzs =
    typeof persistedQuoteData?.after_solar_cost?.total_cost_after_solar_monthly_tzs === "number"
      ? Number(persistedQuoteData.after_solar_cost.total_cost_after_solar_monthly_tzs)
      : null
  const monthlySavingsGrossTzs =
    typeof persistedQuoteData?.monthly_savings?.gross_monthly_savings_tzs === "number"
      ? Number(persistedQuoteData.monthly_savings.gross_monthly_savings_tzs)
      : null
  const cashPaybackMonths =
    typeof persistedQuoteData?.financing_comparison?.cash_payback_months === "number"
      ? Number(persistedQuoteData.financing_comparison.cash_payback_months)
      : null

  const monthlySavingsNetTzs =
    monthlyBaselineCostTzs !== null && monthlyAfterSolarCostTzs !== null
      ? Math.max(0, monthlyBaselineCostTzs - monthlyAfterSolarCostTzs)
      : monthlySavingsGrossTzs

  // Prefer persisted assessment-cycle values so overview survives refresh without live telemetry.
  const sessionBmiPercent = bmiSummary?.score ? Math.round((bmiSummary.score / 40) * 100) : null
  // Overview must be driven by saved assessments (no telemetry fallback for these metrics).
  const energyEfficiencyScore = sessionBmiPercent ?? persistedBmiPercent
  const sessionClimateScore = sectionScores
    ? Math.round((sectionScores.reliability + sectionScores.wastage + sectionScores.thermal + sectionScores.behavior) / 4)
    : null
  const climateResilienceScore = sessionClimateScore ?? persistedClimateRcs
  const displayTotalConsumption = assessedDailyLoadKwh

  const billingSummary = useMemo(() => {
    const list = Array.isArray(bills) ? bills : []
    const unpaid = list.filter((b: any) => b.status !== "paid")
    const overdue = list.filter((b: any) => b.status === "overdue" || new Date(b.dueDate) < new Date())
    const nextDue = unpaid
      .map((b: any) => new Date(b.dueDate))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    return {
      totalBills: list.length,
      unpaidCount: unpaid.length,
      overdueCount: overdue.length,
      nextDueDate: nextDue ? nextDue.toLocaleDateString() : null,
      latestBillAmount: list[0]?.totalCost ? Number(list[0].totalCost) : null,
    }
  }, [bills])

  const billsTrend = useMemo(() => {
    const list = Array.isArray(bills) ? bills : []
    // take latest 8 bills (oldest -> newest) for a simple trend
    const rows = list
      .slice()
      .reverse()
      .slice(0, 8)
      .map((b: any) => ({
        label: new Date(b.periodEnd || b.createdAt || Date.now()).toLocaleDateString(undefined, {
          month: "short",
          day: "2-digit",
        }),
        amount: Number(b.totalCost || 0),
      }))
    return rows
  }, [bills])

  const paymentSummary = useMemo(() => {
    const list = Array.isArray(serviceAccessPayments) ? serviceAccessPayments : []
    const completed = list.filter((p: any) => p.status === "completed")
    const pending = list.filter((p: any) => p.status !== "completed")
    const totalPaid = completed.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    return {
      completedCount: completed.length,
      pendingCount: pending.length,
      totalPaid,
    }
  }, [serviceAccessPayments])

  const paymentsTrend = useMemo(() => {
    const list = Array.isArray(serviceAccessPayments) ? serviceAccessPayments : []
    const completed = list.filter((p: any) => p.status === "completed")

    const byDay = new Map<string, number>()
    for (const p of completed) {
      const d = new Date(p.paidAt || p.createdAt || Date.now())
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) || 0) + Number(p.amount || 0))
    }

    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-14)
      .map(([key, total]) => ({
        label: new Date(key).toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
        amount: total,
      }))
  }, [serviceAccessPayments])

  const creditsSummary = useMemo(() => {
    const list = Array.isArray(overviewCarbonCredits) ? overviewCarbonCredits : []
    const totalCredits = list.reduce((sum: number, c: any) => sum + Number(c.creditsEarnedTons || c.creditsEarned || 0), 0)
    const totalValue = list.reduce((sum: number, c: any) => sum + Number(c.totalValueUsd || c.totalValue || 0), 0)
    const chart = list
      .slice()
      .reverse()
      .map((c: any) => ({
        label: String(c.period || "").slice(0, 10) || new Date(c.startDate || c.createdAt || Date.now()).toLocaleDateString(),
        credits: Number(c.creditsEarnedTons || c.creditsEarned || 0),
        co2: Number(c.co2SavedKg || c.co2Saved || 0),
      }))
    return { totalCredits, totalValue, chart }
  }, [overviewCarbonCredits])

  // Wire carbon credit card to actual assessment data
  const carbonCreditEarnedCalc =
    creditsSummary.totalCredits !== null && creditsSummary.totalCredits !== undefined ? creditsSummary.totalCredits.toFixed(3) : "N/A"

  const afyaLinkUrl = getAfyaLinkAssessmentUrl()

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <aside
        className={cn(
          "bg-white border-r shadow-sm transition-all duration-300 fixed lg:static inset-y-0 left-0 z-50 flex flex-col",
          sidebarOpen ? "w-60" : "w-16",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              {facility?.logoUrl ? (
                <div className="relative w-9 h-9 flex-shrink-0 rounded-full overflow-hidden border border-green-100">
                  <Image 
                    key={facility.logoUrl} 
                    src={facility.logoUrl} 
                    alt={facility.name} 
                    fill 
                    className="object-cover rounded" 
                    priority={false} 
                    unoptimized 
                  />
                </div>
              ) : (
                <div className="relative w-9 h-9 flex-shrink-0 rounded-full overflow-hidden border border-green-100 bg-gray-100 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-gray-400" />
                </div>
              )}
              {sidebarOpen && (
                <span className="text-base font-semibold text-gray-900 truncate">{facility?.name || "Facility"}</span>
              )}
            </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 p-0 hidden lg:flex"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen(false)}
            className="h-8 w-8 p-0 lg:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarNavItems
            .filter((item) => item.id !== 'devices' && item.id !== 'energy')
            .map((item) => {
            const Icon = item.icon
            const isActive = currentActiveSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentSection(item.id)
                  setMobileMenuOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors",
                  isActive ? "bg-green-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          })}
          {subscribedServices.length > 0 && (
            <div className="pt-4 border-t mt-4 space-y-1">
              {sidebarOpen && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Subscribed Services
                </p>
              )}
              {subscribedServices.map((service) => {
                const Icon = service.icon
                return (
                  <button
                    key={service.label}
                    onClick={() => {
                      router.push(service.href)
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors",
                      "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span>{service.label}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </nav>

          <div className="p-3 border-t mt-auto space-y-1">
            {!adminMode && (
              <>
                <FeatureRequestDialog
                  serviceName="afya-solar"
                  serviceDisplayName="Afya Solar"
                  trigger={
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-center text-xs", sidebarOpen && "justify-start")}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {sidebarOpen && <span>Request Feature</span>}
                    </Button>
                  }
                />
                <ReferralInviteDialog
                  trigger={
                    <Button
                      variant="ghost"
                      className={cn("w-full justify-center text-xs", sidebarOpen && "justify-start")}
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      {sidebarOpen && <span>Referral Program</span>}
                    </Button>
                  }
                />
              </>
            )}
            <Button
              variant="ghost"
              className={cn("w-full justify-center text-xs", sidebarOpen && "justify-start")}
              onClick={() => {
                setCurrentSection('settings')
                setMobileMenuOpen(false)
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              {sidebarOpen && <span>Settings</span>}
            </Button>
            {!adminMode && (
              <LogoutButton
                variant="ghost"
                className={cn("w-full justify-center text-xs", sidebarOpen && "justify-start")}
                showIcon={false}
                showTextOnMobile={true}
              />
            )}
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-gradient-to-br from-emerald-900/30 via-slate-900/35 to-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b shadow-sm sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSidebarOpen(true)
                    setMobileMenuOpen(true)
                  }}
                  className="lg:hidden"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide sr-only">
                    Energy Dashboard
                  </p>
                  <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
                    {facility?.name || "Facility Overview"}
                  </h1>
                  {facility && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {facility.city}, {facility.region}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  className="text-green-700 border-green-200"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    window.location.href = "/services/afya-solar"
                  }}
                  aria-label="Go to services home"
                >
                  <Home className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:px-6 lg:px-8 text-sm text-gray-900">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Section Content */}
            {currentActiveSection === 'overview' && (
              <>
                {/* Unified Metrics Grid */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Primary Performance Cards - Row 1 */}
                  <Card className="relative overflow-hidden border border-green-100 bg-gradient-to-b from-emerald-50/60 via-white to-white hover:border-green-500/60 transition-all duration-300 hover:shadow-lg group rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CardHeader className="flex flex-col items-center pb-2 relative z-10">
                      <div className="rounded-xl bg-green-500/10 p-1.5 group-hover:bg-green-500/20 transition-colors">
                        <Gauge className="h-4 w-4 text-green-600" />
                      </div>
                      <CardTitle className="text-[11px] font-semibold text-emerald-900 text-center mt-2 tracking-wide uppercase">
                        Energy Efficiency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-3 pb-3 pt-0 text-center space-y-2">
                      <div className="text-2xl font-extrabold text-emerald-700">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-7 w-16 animate-pulse rounded bg-emerald-100" />
                        ) : (
                          energyEfficiencyScore !== null && energyEfficiencyScore !== undefined ? `${energyEfficiencyScore}%` : "N/A"
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-700">
                        <TrendingUp className="h-3 w-3" />
                        <span>Assessment score</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                        <div
                          className={`h-full bg-emerald-500 transition-all ${assessmentSnapshotBusy ? "animate-pulse" : ""}`}
                          style={{ width: `${Math.min(energyEfficiencyScore ?? 0, 100)}%` }}
                        />
                      </div>
                      {assessmentSnapshotBusy && <p className="text-[10px] text-emerald-600">Loading from database...</p>}
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden border border-blue-100 bg-gradient-to-b from-blue-50/60 via-white to-white hover:border-blue-500/60 transition-all duration-300 hover:shadow-lg group rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CardHeader className="flex flex-col items-center pb-2 relative z-10">
                      <div className="rounded-xl bg-blue-500/10 p-1.5 group-hover:bg-blue-500/20 transition-colors">
                        <Award className="h-4 w-4 text-blue-600" />
                      </div>
                      <CardTitle className="text-[11px] font-semibold text-blue-900 text-center mt-2 tracking-wide uppercase">
                        Carbon Credit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-3 pb-3 pt-0 text-center space-y-2">
                      <div className="text-2xl font-extrabold text-blue-700">
                      {assessmentSnapshotBusy ? (
                        <span className="inline-block h-7 w-16 animate-pulse rounded bg-blue-100" />
                      ) : (
                        carbonCreditEarnedCalc
                      )}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-blue-700">
                        <TrendingUp className="h-3 w-3" />
                        <span>Credits earned</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden border border-purple-100 bg-gradient-to-b from-purple-50/60 via-white to-white hover:border-purple-500/60 transition-all duration-300 hover:shadow-lg group rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CardHeader className="flex flex-col items-center pb-2 relative z-10">
                      <div className="rounded-xl bg-purple-500/10 p-1.5 group-hover:bg-purple-500/20 transition-colors">
                        <CloudSun className="h-4 w-4 text-purple-600" />
                      </div>
                      <CardTitle className="text-[11px] font-semibold text-purple-900 text-center mt-2 tracking-wide uppercase">
                        Climate Resilience
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-3 pb-3 pt-0 text-center space-y-2">
                      <div className="text-2xl font-extrabold text-purple-700">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-7 w-16 animate-pulse rounded bg-purple-100" />
                        ) : (
                          climateResilienceScore !== null && climateResilienceScore !== undefined ? `${climateResilienceScore}%` : "N/A"
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-purple-700">
                        <TrendingUp className="h-3 w-3" />
                        <span>Resilience score</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-purple-100 overflow-hidden">
                        <div
                          className={`h-full bg-purple-500 transition-all ${assessmentSnapshotBusy ? "animate-pulse" : ""}`}
                          style={{ width: `${Math.min(climateResilienceScore ?? 0, 100)}%` }}
                        />
                      </div>
                      {assessmentSnapshotBusy && <p className="text-[10px] text-purple-600">Loading from database...</p>}
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <BarChart3 className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Total Consumption
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-24 animate-pulse rounded bg-gray-100" />
                        ) : displayTotalConsumption !== null ? (
                          `${displayTotalConsumption.toFixed(1)} kWh/d`
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {assessmentSnapshotBusy ? "Loading from database..." : "From your latest sizing assessment"}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Energy assessment / cost calculation snapshot */}
                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        BMI Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-20 animate-pulse rounded bg-gray-100" />
                        ) : persistedAssessmentScore !== null ? (
                          `${persistedAssessmentScore}/40`
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Operational efficiency (BMI)</p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <Sun className="h-4 w-4 text-orange-500" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Solar Array Size
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-24 animate-pulse rounded bg-gray-100" />
                        ) : persistedSizingSummary?.solarArraySize !== null && persistedSizingSummary?.solarArraySize !== undefined ? (
                          `${persistedSizingSummary.solarArraySize.toFixed(1)} kW`
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">From energy sizing</p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Annual Savings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-28 animate-pulse rounded bg-gray-100" />
                        ) : persistedSizingSummary?.annualSavings !== null && persistedSizingSummary?.annualSavings !== undefined ? (
                          formatCurrency(persistedSizingSummary.annualSavings)
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Cost savings (modelled)</p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <TrendingDown className="h-4 w-4 text-blue-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Cost Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-24 animate-pulse rounded bg-gray-100" />
                        ) : monthlySavingsNetTzs !== null && monthlySavingsNetTzs !== undefined ? (
                          formatCurrency(monthlySavingsNetTzs)
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Estimated monthly savings</p>
                    </CardContent>
                  </Card>

                  {/* Assessment-backed overview metrics (no live telemetry dependency) */}
                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <Zap className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Assessed Power Need
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-20 animate-pulse rounded bg-gray-100" />
                        ) : assessedPowerKw !== null ? (
                          `${assessedPowerKw.toFixed(1)} kW`
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {assessmentSnapshotBusy ? "Loading from database..." : "From sizing assessment"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <Activity className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Assessment Cycle
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-20 animate-pulse rounded bg-gray-100" />
                        ) : hasAssessmentSnapshot ? (
                          "Saved"
                        ) : (
                          "No data"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {assessmentSnapshotBusy
                          ? "Loading from database..."
                          : hasAssessmentSnapshot
                            ? "Auto-loaded from database"
                            : "Complete assessment to populate"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <BarChart3 className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Assessment Load
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {assessmentSnapshotBusy ? (
                          <span className="inline-block h-6 w-24 animate-pulse rounded bg-gray-100" />
                        ) : assessedDailyLoadKwh !== null ? (
                          `${assessedDailyLoadKwh.toFixed(1)} kWh/d`
                        ) : (
                          "N/A"
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {assessmentSnapshotBusy ? "Loading from database..." : "From devices &amp; loads assessment"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Energy & Cost Insights (assessment snapshot) */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Energy &amp; Cost Insights</h3>
                      <p className="text-xs text-gray-500">
                        Load breakdown, energy mix, critical load view, cost composition, and a savings bridge—powered by your saved assessment snapshots.
                      </p>
                    </div>
                    {assessmentSnapshotBusy ? (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        Loading from database...
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        DB snapshot loaded
                      </span>
                    )}
                  </div>

                  {assessmentSnapshotBusy ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-64 rounded-xl border border-gray-100 bg-gray-50 animate-pulse ${i === 4 || i === 6 ? "lg:col-span-2" : ""}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <IntelligenceChartGrid
                      meu={persistedMeuSummary as MeuSummary | null}
                      sizing={persistedSizingSummary as SizingSummary | null}
                      facilityExtras={persistedFacilityExtras ?? undefined}
                      resilienceScore={climateResilienceScore}
                      recommendations={recommendations}
                      bmiTrend={bmiTrend}
                      variant="overview"
                    />
                  )}
                </div>

                {/* Billing & Payments card removed from Overview */}
              {/* Facility self-service widgets intentionally hidden for now */}
            </>)}

            {currentActiveSection === 'package-selection' && (
              <div className="space-y-6">
                {facilityId && <SolarPackagesSelection facilityId={facilityId} />}
              </div>
            )}

            {currentActiveSection === 'devices' && (
              <Card className={panelCardClass}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                    <Plug className="w-5 h-5 text-green-600" />
                    Devices
                  </CardTitle>
                  <CardDescription className={metaTextClass}>Manage your smart meters and energy monitors</CardDescription>
                </CardHeader>
                <CardContent>
                  {devices && devices.length > 0 ? (
                    <div className="space-y-3">
                      {devices.map((device) => (
                        <div
                          key={device.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-gray-900 truncate">{device.serialNumber}</h3>
                              <Badge variant="outline" className={`${subtleBadgeClass} capitalize flex-shrink-0`}>
                                {device.type}
                              </Badge>
                              <Badge variant={device.status === 'active' ? 'default' : 'secondary'} className={`flex-shrink-0 ${device.status === 'active' ? 'bg-green-600 text-white' : ''}`}>
                                {device.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 break-words">
                              {device.sensorSize}A sensor â€¢ {device.ports} ports â€¢ {device.mode}
                            </p>
                            {device.lastUpdate && (
                              <p className="text-xs text-gray-400 mt-1">
                                Last update: {new Date(device.lastUpdate).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Plug className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">No devices available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentActiveSection === 'energy' && (
              <div className="space-y-6">
                {/* Energy Overview Cards */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={metricTitleClass}>Grid Consumption</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-semibold text-gray-900">{metrics.gridConsumption.toFixed(2)} kWh</div>
                      <p className={metaTextClass}>
                        From utility grid
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={metricTitleClass}>Average Power</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-semibold text-gray-900">{metrics.avgPower.toFixed(2)} W</div>
                      <p className={metaTextClass}>
                        Average consumption
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={metricTitleClass}>Peak Power</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-semibold text-gray-900">{metrics.maxPower.toFixed(2)} W</div>
                      <p className={metaTextClass}>
                        Maximum demand
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Energy Mix Visualization */}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={sectionTitleClass}>Energy Source Breakdown</CardTitle>
                    <CardDescription>Solar vs Grid consumption</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={metaTextClass}>Solar Energy</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {metrics.totalSolarGeneration.toFixed(2)} kWh ({metrics.solarPercentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-green-100 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all"
                            style={{ width: `${metrics.solarPercentage}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={metaTextClass}>Grid Energy</span>
                          <span className="text-sm font-semibold text-orange-600">
                            {metrics.gridConsumption.toFixed(2)} kWh ({(100 - metrics.solarPercentage).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-green-100 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-orange-500 to-red-600 h-3 rounded-full transition-all"
                            style={{ width: `${100 - metrics.solarPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detailed Energy History */}
                <Card className={panelCardClass}>
              <CardHeader>
                    <CardTitle className={sectionTitleClass}>Energy Consumption History</CardTitle>
                <CardDescription>View detailed energy consumption data</CardDescription>
              </CardHeader>
              <CardContent>
                {energyData && energyData.length > 0 ? (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {energyData.map((data: { id: Key | null | undefined; power: any; voltage: any; current: any; solarGeneration: any; batteryLevel: any; timestamp: string | number | Date; energy: any; creditBalance: any; gridStatus: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | Promise<AwaitedReactNode> | null | undefined }) => (
                      <div
                        key={data.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <p className="font-medium text-gray-900">{Number(data.power).toFixed(2)} W</p>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                              {Number(data.voltage).toFixed(1)}V / {Number(data.current).toFixed(2)}A
                            </Badge>
                            {data.solarGeneration && Number(data.solarGeneration) > 0 && (
                              <Badge className="bg-green-600 flex-shrink-0">
                                <Sun className="w-3 h-3 mr-1" />
                                Solar
                              </Badge>
                            )}
                            {data.batteryLevel && (
                              <Badge variant={Number(data.batteryLevel) > 50 ? "default" : "destructive"} className={`flex-shrink-0 ${Number(data.batteryLevel) > 50 ? "bg-green-600" : ""}`}>
                                <Battery className="w-3 h-3 mr-1" />
                                {Number(data.batteryLevel).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-green-600">
                            {new Date(data.timestamp).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-green-500 flex-wrap">
                            <span>Energy: {Number(data.energy).toFixed(2)} kWh</span>
                            <span>Credit: {formatCurrency(Number(data.creditBalance))}</span>
                            {data.solarGeneration && (
                              <span className="text-green-600">Solar: {Number(data.solarGeneration).toFixed(2)} kWh</span>
                            )}
                            {data.gridStatus && (
                              <span className={data.gridStatus === 'connected' ? 'text-green-600' : 'text-red-600'}>
                                Grid: {data.gridStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                      <div className="text-center py-8">
                        <BarChart3 className="w-12 h-12 text-green-300 mx-auto mb-4" />
                        <p className="text-green-600 mb-2">No energy data available yet</p>
                        <p className="text-sm text-green-500">Connect a device to start tracking your solar energy usage</p>
                      </div>
                )}
              </CardContent>
            </Card>
              </div>
            )}

            {currentActiveSection === 'energy-efficiency' && (
              <div className="space-y-6">
                {adminMode ? (
                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={sectionTitleClass}>Energy efficiency assessments</CardTitle>
                      <CardDescription className={metaTextClass}>
                        Guided energy assessments are managed in AfyaLink. Use the Afya Solar admin hub for read-only
                        portfolio snapshots across facilities.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {afyaLinkUrl ? (
                        <Button asChild className="bg-green-600 hover:bg-green-700">
                          <a href={afyaLinkUrl} target="_blank" rel="noopener noreferrer">
                            Open AfyaLink assessments
                          </a>
                        </Button>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Configure <code className="text-xs bg-gray-100 px-1 rounded">NEXT_PUBLIC_AFYALINK_ASSESSMENT_URL</code>{" "}
                          for a direct link to your AfyaLink workspace.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {facilityId && (
                      <FacilityMeterEfficiencyDashboard facilityId={facilityId} preferMock={false} />
                    )}
                    <Card className={panelCardClass}>
                      <CardHeader>
                        <CardTitle className={sectionTitleClass}>
                          AfyaSolar Intelligence Platform
                        </CardTitle>
                        <CardDescription className={metaTextClass}>
                          Overview, guided assessment, analysis charts, action plan, and reports in one workflow (v2.0).
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-2 sm:p-4">
                        <FacilityIntelligencePlatform
                          facilityId={facility?.id}
                          facilityName={facility?.name ?? undefined}
                          platformScope="energy"
                          sizingSummary={sizingSummary}
                          meuSummary={meuSummary}
                          bmiSummary={bmiSummary}
                          sectionScores={sectionScores}
                          onSizingSummaryChange={setSizingSummary}
                          onMeuSummaryChange={setMeuSummary}
                          onBmiSummaryChange={setBmiSummary}
                          onSectionScoresChange={setSectionScores}
                        />
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {currentActiveSection === 'climate-resilience' && (
              <div className="space-y-6">
                {adminMode ? (
                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                        <CloudSun className="w-5 h-5 text-green-600" />
                        Climate resilience assessments
                      </CardTitle>
                      <CardDescription className={metaTextClass}>
                        Guided climate assessments are managed in AfyaLink. Use the Afya Solar admin hub for read-only
                        portfolio snapshots across facilities.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {afyaLinkUrl ? (
                        <Button asChild className="bg-green-600 hover:bg-green-700">
                          <a href={afyaLinkUrl} target="_blank" rel="noopener noreferrer">
                            Open AfyaLink assessments
                          </a>
                        </Button>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Configure <code className="text-xs bg-gray-100 px-1 rounded">NEXT_PUBLIC_AFYALINK_ASSESSMENT_URL</code>{" "}
                          for a direct link to your AfyaLink workspace.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                        <CloudSun className="w-5 h-5 text-green-600" />
                        Climate resilience
                      </CardTitle>
                      <CardDescription className={metaTextClass}>
                        Guided climate readiness, hazard context, adaptation tracking, and saved risk drivers (same assessment
                        cycle as Energy Efficiency).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4">
                      <FacilityIntelligencePlatform
                        facilityId={facility?.id}
                        facilityName={facility?.name ?? undefined}
                        platformScope="climate"
                        sizingSummary={sizingSummary}
                        meuSummary={meuSummary}
                        bmiSummary={bmiSummary}
                        sectionScores={sectionScores}
                        onSizingSummaryChange={setSizingSummary}
                        onMeuSummaryChange={setMeuSummary}
                        onBmiSummaryChange={setBmiSummary}
                        onSectionScoresChange={setSectionScores}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {currentActiveSection === 'bills-payment' && (
              <div className="space-y-6">
                <ServiceAccessPaymentDialog
                  open={paymentDialogOpen}
                  onOpenChange={setPaymentDialogOpen}
                  serviceName="afya-solar"
                  serviceDisplayName="Afya Solar"
                  // This is the displayed amount; the server computes/validates Afya Solar pricing.
                  amount={Number(afyaSolarSubscriber?.monthlyPaymentAmount ?? afyaSolarSubscriber?.totalPackagePrice ?? 1)}
                  packageId={String(afyaSolarSubscriber?.packageId ?? '')}
                  packageName={String(afyaSolarSubscriber?.packageName ?? '')}
                  paymentPlan={mapPlanTypeToPaymentPlan(afyaSolarSubscriber?.planType)}
                  packageMetadata={(afyaSolarSubscriber as any)?.metadata ?? {}}
                />

                <Tabs defaultValue="bills" className="w-full">
                  <TabsList className="grid grid-cols-2 w-full max-w-md">
                    <TabsTrigger value="bills">Bills &amp; Subscription</TabsTrigger>
                    <TabsTrigger value="payg">PAYG &amp; Financing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="bills" className="space-y-6 mt-4">
                    <BillsSubscriptionView
                      afyaSolarSubscriber={afyaSolarSubscriber}
                      bills={bills}
                      serviceAccessPayments={serviceAccessPayments}
                      invoiceRequests={invoiceRequests}
                      facility={facility}
                      canShowPayNow={canShowPayNow}
                      onPayClick={openAfyaSolarPaymentDialog}
                      onReload={() => window.location.reload()}
                      onNavigateToAfyaSolar={() => router.push("/services/afya-solar")}
                      panelCardClass={panelCardClass}
                      sectionTitleClass={sectionTitleClass}
                      metaTextClass={metaTextClass}
                    />
                  </TabsContent>

                  <TabsContent value="payg" className="mt-4">
                    <PaygFinancingSection facilityId={facilityId} />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {currentActiveSection === 'notifications' && (
              <Card className={panelCardClass}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                    <Bell className="w-5 h-5 text-green-600" />
                    Notifications
                    {facilityUnreadCount > 0 && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-100">
                        {facilityUnreadCount} new
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className={metaTextClass}>
                    Stay updated with Afya Solar service activity, payments, and important alerts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {facilityNotificationsLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                      Loading notifications...
                    </div>
                  ) : facilityNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-gray-500">
                      <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
                      <p>No recent Afya Solar notifications.</p>
                      <p className="text-xs mt-1">
                        Payment updates and service alerts will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Showing {facilityNotifications.length} recent notification
                          {facilityNotifications.length > 1 ? 's' : ''}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/notifications', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ markAllRead: true }),
                              })
                              if (response.ok) {
                                setFacilityNotifications((prev) =>
                                  prev.map((n) => ({ ...n, isRead: true })),
                                )
                                setFacilityUnreadCount(0)
                                toast.success('Notifications cleared', {
                                  description:
                                    'All notifications have been marked as read.',
                                  duration: 2500,
                                })
                              }
                            } catch (error) {
                              console.error('Error marking notifications as read:', error)
                              toast.error('Failed to mark notifications as read.')
                            }
                          }}
                        >
                          Mark all as read
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {facilityNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              'p-3 rounded-lg border border-gray-100 bg-white flex items-start gap-3',
                              !notification.isRead && 'border-green-200 bg-green-50/40',
                            )}
                          >
                            <div className="mt-0.5">
                              <Bell className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm text-gray-900 truncate">
                                    {notification.title}
                                  </p>
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                                      notification.priority === 'urgent' &&
                                        'bg-red-50 text-red-700 border-red-200',
                                      notification.priority === 'high' &&
                                        'bg-orange-50 text-orange-700 border-orange-200',
                                      notification.priority === 'normal' &&
                                        'bg-blue-50 text-blue-700 border-blue-200',
                                      notification.priority === 'low' &&
                                        'bg-gray-50 text-gray-700 border-gray-200',
                                    )}
                                  >
                                    {notification.priority.toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                  {new Date(notification.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700 mt-1">
                                {notification.message}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                {notification.actionUrl ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      window.open(notification.actionUrl || '/services/afya-solar', '_blank')
                                    }}
                                  >
                                    {notification.actionLabel || 'Open'}
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-gray-400">
                                    Type: {notification.type.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {!notification.isRead && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[11px] text-gray-500"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch('/api/notifications', {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            notificationId: notification.id,
                                            action: 'read',
                                          }),
                                        })
                                        if (response.ok) {
                                          setFacilityNotifications((prev) =>
                                            prev.map((n) =>
                                              n.id === notification.id ? { ...n, isRead: true } : n,
                                            ),
                                          )
                                          setFacilityUnreadCount((prev) =>
                                            prev > 0 ? prev - 1 : 0,
                                          )
                                        }
                                      } catch (error) {
                                        console.error('Error marking notification as read:', error)
                                      }
                                    }}
                                  >
                                    Mark as read
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Report page intentionally removed */}

            {currentActiveSection === 'settings' && (
              <FacilitySettings facilityId={facilityId} onBack={() => setCurrentSection('overview')} />
            )}

            {currentActiveSection === 'subscription' && (
              <div className="space-y-6">
                {/* Subscription Services Header */}
                <div className="mb-6">
                  <h2 className={sectionTitleClass}>Available Services</h2>
                  <p className={metaTextClass}>Subscribe to additional services to enhance your facility management</p>
                </div>

                {/* Services Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                </div>

                {/* Additional Info */}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={sectionTitleClass}>About Subscriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm text-gray-700">
                      <p>
                        Subscribe to additional services to enhance your facility's operations. Each service can be subscribed to independently and can be cancelled at any time.
                      </p>
                      <div className="grid md:grid-cols-2 gap-4 pt-4">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="font-medium text-gray-900 mb-1">Flexible Plans</p>
                          <p className="text-xs text-gray-600">Choose monthly or annual billing cycles</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="font-medium text-gray-900 mb-1">Easy Management</p>
                          <p className="text-xs text-gray-600">Manage all subscriptions from one place</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentActiveSection === 'carbon-credits' && (
              <FacilityCarbonCredits facilityId={facilityId || ''} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

