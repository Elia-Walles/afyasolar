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
  Download
} from "lucide-react"
import Image from "next/image"
import { LogoutButton } from "@/components/logout-button"
import { FacilitySettings } from "@/components/facility-settings"
import { FeatureRequestDialog } from "@/components/dashboard/feature-request-dialog"
import { ReferralInviteDialog } from "@/components/dashboard/referral-invite-dialog"
import { FacilityCarbonCredits } from "@/components/dashboard/facility-carbon-credits"
import { ManualTelemetryForm } from "@/components/energy/manual-telemetry-form"
import { EnergyEfficiencyAssessment } from "@/components/energy/energy-efficiency-assessment"
import { FacilityMeterEfficiencyDashboard } from "@/components/efficiency/facility-meter-efficiency-dashboard"
import type { SizingSummary, MeuSummary } from "@/components/solar/afya-solar-sizing-tool"
import { FacilityIntelligencePlatform } from "@/components/intelligence/facility-intelligence-platform"
import type { SectionScores } from "@/lib/intelligence/recommendations"
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
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ServiceAccessPaymentDialog } from "@/components/services/service-access-payment-dialog"

interface FacilityDashboardContentProps {
  facility?: Facility | null
  liveData?: LiveEnergyData | null
  adminMode?: boolean
  activeSection?: NavSection
  onSectionChange?: (section: NavSection) => void
}

type NavSection = 'overview' | 'devices' | 'energy' | 'energy-efficiency' | 'bills-payment' | 'notifications' | 'report' | 'carbon-credits' | 'subscription' | 'settings'

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

const navItems: { id: NavSection; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: Plug },
  { id: 'energy', label: 'Energy', icon: Zap },
  { id: 'energy-efficiency', label: 'Energy Efficiency', icon: Gauge },
  { id: 'bills-payment', label: 'Bills & Payment', icon: Receipt },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'carbon-credits', label: 'Carbon Credits', icon: Leaf },
]

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

  const mapPlanTypeToPaymentPlan = (
    planType?: string | null
  ): "cash" | "installment" | "paas" | undefined => {
    const v = (planType || '').toUpperCase().trim()
    if (v === 'CASH') return 'cash'
    if (v === 'INSTALLMENT') return 'installment'
    if (v === 'PAAS' || v === 'EAAS') return 'paas'
    return undefined
  }

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

  // Check URL parameter for deep links (only when not in admin mode)
  useEffect(() => {
    if (!adminMode) {
      const section = searchParams?.get('section')
      if (section === 'subscription') {
        setInternalActiveSection('subscription')
      }
      if (section === 'report') {
        setInternalActiveSection('report')
      }
    }
  }, [searchParams, adminMode])

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

  const energyEfficiencyScore = Math.round(metrics.efficiency || 0)
  const carbonCreditEarned = Math.floor((metrics.totalSolarGeneration || 0) / 1000)

  const subscribedServices = useMemo(() => [] as { label: string; href: string; icon: typeof CreditCard }[], [])

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Only show when not in admin mode */}
      {!adminMode && (
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
          {navItems
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
            <LogoutButton
              variant="ghost"
              className={cn("w-full justify-center text-xs", sidebarOpen && "justify-start")}
              showIcon={false}
              showTextOnMobile={true}
            />
          </div>
        </div>
      </aside>
      )}

      {/* Mobile Menu Overlay - Only show when not in admin mode */}
      {!adminMode && mobileMenuOpen && (
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
                {/* Mobile menu button - Only show when not in admin mode */}
                {!adminMode && (
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
                )}
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
                        {energyEfficiencyScore}%
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-700">
                        <TrendingUp className="h-3 w-3" />
                        <span>Assessment score</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(energyEfficiencyScore, 100)}%` }}
                        />
                      </div>
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
                        {carbonCreditEarned}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-blue-700">
                        <TrendingUp className="h-3 w-3" />
                        <span>Credits earned</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden border border-amber-100 bg-gradient-to-b from-amber-50/60 via-white to-white hover:border-amber-500/60 transition-all duration-300 hover:shadow-lg group rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CardHeader className="flex flex-col items-center pb-2 relative z-10">
                      <div className="rounded-xl bg-amber-500/10 p-1.5 group-hover:bg-amber-500/20 transition-colors">
                        <DollarSign className="h-4 w-4 text-amber-600" />
                      </div>
                      <CardTitle className="text-[11px] font-semibold text-amber-900 text-center mt-2 tracking-wide uppercase">
                        Credit Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 px-3 pb-3 pt-0 text-center space-y-2">
                      <div className="text-lg font-extrabold text-amber-700">
                        {formatCurrency(creditBalance)}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-amber-700">
                        <TrendingUp className="h-3 w-3" />
                        <span>Available balance</span>
                      </div>
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
                        {metrics.totalConsumption.toFixed(1)} kWh
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This week' : 'This month'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Energy Metrics - Row 2 */}
                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <Zap className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Peak Power
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {metrics.maxPower.toFixed(1)} W
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Maximum demand</p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Cost Savings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {formatCurrency(metrics.costSavings)}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Solar contribution</p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        System Efficiency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {metrics.efficiency.toFixed(1)}%
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Overall efficiency</p>
                    </CardContent>
                  </Card>

                  <Card className={`${panelCardClass} rounded-2xl bg-white/80`}>
                    <CardHeader className="flex flex-col items-center pb-1">
                      <Sun className="h-4 w-4 text-green-600" />
                      <CardTitle className="text-[11px] font-semibold text-gray-700 text-center mt-2 tracking-wide uppercase">
                        Solar Generation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {metrics.totalSolarGeneration.toFixed(1)} kWh
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This week' : 'This month'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
              {/* Facility self-service widgets intentionally hidden for now */}
            </>)}

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
                {facilityId && (
                  <FacilityMeterEfficiencyDashboard facilityId={facilityId} preferMock={false} />
                )}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                      <Gauge className="w-5 h-5 text-green-600" />
                      Energy Efficiency
                    </CardTitle>
                    <CardDescription className={metaTextClass}>
                      Overview of your facility&apos;s solar performance, efficiency, and savings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!facilityId || !energyData || energyData.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-500">
                        {!facilityId
                          ? "Energy efficiency metrics will appear here once your facility is fully registered."
                          : "Energy efficiency insights will appear here once enough energy data is available."}
                      </div>
                    ) : (
                      <div className="grid gap-6 lg:grid-cols-3">
                        {/* Score card */}
                        <div className="lg:col-span-1">
                          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-5 h-full flex flex-col justify-between">
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                                Efficiency Score
                              </p>
                              <p className="text-5xl font-bold text-emerald-700">
                                {energyEfficiencyScore}
                              </p>
                              <p className="text-xs text-gray-500">
                                Combined score based on solar contribution, battery performance, and overall efficiency.
                              </p>
                            </div>
                            <div className="mt-4 space-y-1 text-xs text-gray-600">
                              <p>
                                • Solar contribution:{" "}
                                <span className="font-semibold">
                                  {metrics.solarPercentage.toFixed(1)}%
                                </span>
                              </p>
                              <p>
                                • Average battery level:{" "}
                                <span className="font-semibold">
                                  {metrics.avgBatteryLevel.toFixed(1)}%
                                </span>
                              </p>
                              <p>
                                • Estimated monthly savings:{" "}
                                <span className="font-semibold">
                                  {formatCurrency(metrics.costSavings)}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Key metrics */}
                        <div className="lg:col-span-2 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Card className="border border-gray-100">
                              <CardHeader className="pb-1">
                                <CardDescription className={metricTitleClass}>
                                  Total Consumption (last {timeRange === "today" ? "day" : timeRange === "week" ? "7 days" : "30 days"})
                                </CardDescription>
                                <CardTitle className="text-2xl">
                                  {metrics.totalConsumption.toFixed(1)} kWh
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-1">
                                <p className={metaTextClass}>
                                  Based on {energyData.length} data point{energyData.length !== 1 && "s"} from your devices.
                                </p>
                              </CardContent>
                            </Card>

                            <Card className="border border-gray-100">
                              <CardHeader className="pb-1">
                                <CardDescription className={metricTitleClass}>Solar Contribution</CardDescription>
                                <CardTitle className="text-2xl">
                                  {metrics.solarPercentage.toFixed(1)}%
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-1">
                                <p className={metaTextClass}>
                                  {metrics.totalSolarGeneration.toFixed(1)} kWh generated from solar in this period.
                                </p>
                              </CardContent>
                            </Card>

                            <Card className="border border-gray-100">
                              <CardHeader className="pb-1">
                                <CardDescription className={metricTitleClass}>Estimated Carbon Credits</CardDescription>
                                <CardTitle className="text-2xl">
                                  {carbonCreditEarned}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-1">
                                <p className={metaTextClass}>
                                  Approximate credits based on solar generation over the selected period.
                                </p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                            <p className="font-semibold text-gray-700 mb-1">How to improve your score:</p>
                            <p>• Increase the share of solar in your total consumption by shifting critical loads to daytime.</p>
                            <p>• Keep batteries within a healthy charge range to maximize lifespan and availability.</p>
                            <p>• Track and reduce unnecessary overnight loads and standby consumption.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

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

                {adminMode && facilityId && (
                  <Card className={panelCardClass}>
                    <CardHeader>
                      <CardTitle className={sectionTitleClass}>Add Manual Telemetry Sample</CardTitle>
                      <CardDescription className={metaTextClass}>
                        Admin-only tool to record a sample energy reading for this facility. Useful for testing dashboards before smart meter integration.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ManualTelemetryForm facilityId={facilityId} />
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

                {/* Bills Section */}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                      <Receipt className="w-5 h-5 text-green-600" />
                      Bills
                    </CardTitle>
                    <CardDescription className={metaTextClass}>View your bills and manage payments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Current Package Information */}
                    {afyaSolarSubscriber ? (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-green-900 mb-2">Your Solar Package</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-green-700">Package</p>
                                <p className="font-medium text-green-900">{afyaSolarSubscriber.packageName}</p>
                              </div>
                              <div>
                                <p className="text-green-700">System Size</p>
                                <p className="font-medium text-green-900">{afyaSolarSubscriber.packageRatedKw} kW</p>
                              </div>
                              <div>
                                <p className="text-green-700">Plan Type</p>
                                <p className="font-medium text-green-900">
                                  {afyaSolarSubscriber.planType === 'CASH' ? 'One-Time Payment' :
                                   afyaSolarSubscriber.planType === 'INSTALLMENT' ? 'Installment Plan' :
                                   afyaSolarSubscriber.planType === 'PAAS' ? 'Pay-As-You-Go' : 'Unknown'}
                                </p>
                              </div>
                              <div>
                                <p className="text-green-700">Status</p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  afyaSolarSubscriber.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                                  afyaSolarSubscriber.subscriptionStatus === 'expired' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {afyaSolarSubscriber.subscriptionStatus?.charAt(0).toUpperCase() + afyaSolarSubscriber.subscriptionStatus?.slice(1)}
                                </span>
                              </div>
                              <div>
                                <p className="text-green-700">Package Health</p>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${
                                    afyaSolarSubscriber.systemStatus === 'active' ? 'bg-green-500' : 'bg-gray-400'
                                  }`} />
                                  <span className="text-xs font-medium text-green-700">
                                    {afyaSolarSubscriber.systemHealth === 'optimal' ? 'Optimal' : 
                                     afyaSolarSubscriber.systemHealth === 'warning' ? 'Warning' : 'Critical'}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {afyaSolarSubscriber.systemHealth === 'optimal' ? 'System performing well' : 
                                   afyaSolarSubscriber.systemHealth === 'warning' ? 'System needs attention' : 'System requires immediate attention'}
                                </div>
                              </div>
                              <div>
                                <p className="text-green-700">Installation Date</p>
                                <p className="font-medium text-green-900">
                                  {afyaSolarSubscriber.installationDate ? new Date(afyaSolarSubscriber.installationDate).toLocaleDateString() : 'Not installed'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-right">
                              <p className="text-xs text-green-600 mb-1">Next Service Due</p>
                              <p className="text-sm font-medium text-green-900">
                                {afyaSolarSubscriber.nextBillingDate 
                                  ? new Date(afyaSolarSubscriber.nextBillingDate).toLocaleDateString()
                                  : 'Calculate based on plan'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-yellow-400 text-xl">⚠️</span>
                          </div>
                          <h4 className="text-lg font-semibold text-yellow-900 mb-2">No Solar Package Found</h4>
                          <p className="text-sm text-yellow-700 mb-3">
                            Your subscription details are not available yet. If you recently paid, wait a moment and refresh.
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                              Refresh
                            </Button>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push("/services/afya-solar")}>
                              Go to Afya Solar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Next Month's Payment */}
                    {afyaSolarSubscriber && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-3">Next Payment Information</h4>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-2xl font-bold text-blue-900">
                              {afyaSolarSubscriber.planType === 'CASH' && afyaSolarSubscriber.totalPackagePrice 
                                ? formatCurrency(afyaSolarSubscriber.totalPackagePrice)
                                : afyaSolarSubscriber.planType === 'INSTALLMENT' && afyaSolarSubscriber.monthlyPaymentAmount
                                ? formatCurrency(afyaSolarSubscriber.monthlyPaymentAmount)
                                : afyaSolarSubscriber.planType === 'PAAS' && afyaSolarSubscriber.monthlyPaymentAmount
                                ? formatCurrency(afyaSolarSubscriber.monthlyPaymentAmount)
                                : 'N/A'
                              }
                            </p>
                            <p className="text-sm text-blue-600">
                              {afyaSolarSubscriber.planType === 'CASH' ? 'One-time payment' :
                               afyaSolarSubscriber.planType === 'INSTALLMENT' ? 'Monthly installment' :
                               afyaSolarSubscriber.planType === 'PAAS' ? 'Monthly service fee' : 'Payment amount'}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-right">
                              <p className="text-xs text-blue-600 mb-1">Payment Method</p>
                              <p className="text-sm font-medium text-blue-900">
                                {afyaSolarSubscriber.paymentMethod || 'Not set'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Countdown Timer */}
                        {afyaSolarSubscriber.nextBillingDate && (
                          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-blue-600 mb-1">Days Until Payment</p>
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const now = new Date()
                                    const nextBilling = new Date(afyaSolarSubscriber.nextBillingDate)
                                    const daysUntil = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                    
                                    return (
                                      <>
                                        <span className={`text-2xl font-bold ${
                                          daysUntil > 7 ? 'text-green-600' :
                                          daysUntil > 0 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {daysUntil > 0 ? daysUntil : 0}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                          {daysUntil === 1 ? 'day' : 'days'}
                                        </span>
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  (() => {
                                    const now = new Date()
                                    const nextBilling = new Date(afyaSolarSubscriber.nextBillingDate)
                                    const daysUntil = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                    
                                    if (daysUntil <= 0) return 'bg-red-100 text-red-800'
                                    if (daysUntil <= 7) return 'bg-yellow-100 text-yellow-800'
                                    return 'bg-green-100 text-green-800'
                                  })()
                                }`}>
                                  {(() => {
                                    const now = new Date()
                                    const nextBilling = new Date(afyaSolarSubscriber.nextBillingDate)
                                    const daysUntil = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                                    
                                    if (daysUntil <= 0) return 'Payment overdue'
                                    if (daysUntil <= 7) return 'Payment due soon'
                                    return 'Payment on schedule'
                                  })()}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Due date: {new Date(afyaSolarSubscriber.nextBillingDate).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Billing Summary */}
                    {afyaSolarSubscriber && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Billing Summary</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-700">Credit Balance</p>
                            <p className="font-medium text-gray-900">
                              {afyaSolarSubscriber.remainingBalance !== undefined 
                                ? formatCurrency(afyaSolarSubscriber.remainingBalance)
                                : formatCurrency(0)
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-700">Monthly Consumption</p>
                            <p className="font-medium text-gray-900">
                              {facility?.monthlyConsumption ? formatCurrency(Number(facility.monthlyConsumption)) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-700">Payment Model</p>
                            <p className="font-medium text-gray-900">
                              {afyaSolarSubscriber.planType || 'Not Set'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Installment Schedule (for installment plans) */}
                    {afyaSolarSubscriber && afyaSolarSubscriber.planType === 'INSTALLMENT' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-amber-900 mb-3">Installment Schedule</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-amber-700">Total Contract</p>
                            <p className="font-medium text-amber-900">
                              {afyaSolarSubscriber.totalPackagePrice ? formatCurrency(afyaSolarSubscriber.totalPackagePrice) : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-amber-700">Remaining Balance</p>
                            <p className="font-medium text-amber-900">
                              {afyaSolarSubscriber.remainingBalance !== undefined 
                                ? formatCurrency(afyaSolarSubscriber.remainingBalance)
                                : 'N/A'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-amber-700">Progress</p>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: afyaSolarSubscriber.totalPackagePrice && afyaSolarSubscriber.remainingBalance !== undefined
                                    ? `${((afyaSolarSubscriber.totalPackagePrice - afyaSolarSubscriber.remainingBalance) / afyaSolarSubscriber.totalPackagePrice) * 100}%`
                                    : '0%'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAAS Service Details (for PAAS plans) */}
                    {afyaSolarSubscriber && afyaSolarSubscriber.planType === 'PAAS' && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-purple-900 mb-3">Service Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-purple-700">Contract Status</p>
                            <p className="font-medium text-purple-900">
                              {afyaSolarSubscriber.contractStatus || 'Active'}
                            </p>
                          </div>
                          <div>
                            <p className="text-purple-700">Billing Model</p>
                            <p className="font-medium text-purple-900">
                              {afyaSolarSubscriber.billingModel || 'Fixed Monthly'}
                            </p>
                          </div>
                          <div>
                            <p className="text-purple-700">Minimum Term</p>
                            <p className="font-medium text-purple-900">
                              {afyaSolarSubscriber.minimumTermMonths || 12} months
                            </p>
                          </div>
                          <div>
                            <p className="text-purple-700">Auto-renew</p>
                            <p className="font-medium text-purple-900">
                              {afyaSolarSubscriber.autoRenew ? 'Yes' : 'No'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Billing Summary */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Billing Summary</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-700">Credit Balance</p>
                          <p className="font-medium text-gray-900">
                            {facility?.creditBalance ? formatCurrency(facility.creditBalance) : 'TZS 0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-700">Monthly Consumption</p>
                          <p className="font-medium text-gray-900">
                            {facility?.monthlyConsumption ? `${facility.monthlyConsumption} kWh` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-700">Payment Model</p>
                          <p className="font-medium text-gray-900">
                            {facility?.paymentModel || 'Not Set'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {bills && bills.length > 0 && (
                      <div className="space-y-4">
                        {bills.slice(0, 5).map((bill: any) => (
                          <div key={bill.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {new Date(bill.periodStart).toLocaleDateString()} - {new Date(bill.periodEnd).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Period: {Math.ceil((new Date(bill.periodEnd).getTime() - new Date(bill.periodStart).getTime()) / (1000 * 60 * 60 * 24))} days
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{formatCurrency(bill.totalCost)}</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  bill.status === 'paid' 
                                    ? 'bg-green-100 text-green-800'
                                    : bill.status === 'overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Consumption</p>
                                <p className="font-medium">{bill.totalConsumption} kWh</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Rate</p>
                                <p className="font-medium">
                                  {formatCurrency(Number(bill.totalCost) / Number(bill.totalConsumption))}/kWh
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Due Date</p>
                                <p className={`font-medium ${
                                  new Date(bill.dueDate) < new Date() ? 'text-red-600' : 'text-gray-900'
                                }`}>
                                  {new Date(bill.dueDate).toLocaleDateString()}
                                  {new Date(bill.dueDate) < new Date() && ' (Overdue)'}
                                </p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline">
                                  <FileText className="w-4 h-4 mr-2" />
                                  View Details
                                </Button>
                                {bill.status !== 'paid' && (
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={openAfyaSolarPaymentDialog}
                                  >
                                    <DollarSign className="w-4 h-4 mr-2" />
                                    Pay Subscription
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" disabled>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </Button>
                              </div>
                              <div className="text-xs text-gray-400">
                                Bill ID: {bill.id}
                              </div>
                            </div>
                          </div>
                        ))}
                        {bills.length > 5 && (
                          <div className="text-center">
                            <Button variant="outline" size="sm">
                              View All Bills ({bills.length - 5} more)
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payment History */}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={sectionTitleClass}>Payment History</CardTitle>
                    <CardDescription className={metaTextClass}>Afya Solar subscription payments and invoice requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(serviceAccessPayments && serviceAccessPayments.length > 0) || (invoiceRequests && invoiceRequests.length > 0) ? (
                      <div className="space-y-6">
                        {/* Service Access Payments */}
                        {completedServiceAccessPayments.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-base font-semibold text-gray-700 flex items-center">
                                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                                Completed Payments
                              </h4>
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {completedServiceAccessPayments.length} transaction{completedServiceAccessPayments.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {completedServiceAccessPayments.slice(0, 5).map((payment: any) => (
                                <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded-full ${
                                        payment.status === 'completed' 
                                          ? 'bg-green-500'
                                          : payment.status === 'failed'
                                          ? 'bg-red-500'
                                          : 'bg-yellow-500'
                                      }`} />
                                      <div>
                                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                                        <p className="text-sm text-gray-600">
                                          {payment.paymentMethod ? payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1) : 'Unknown'} • 
                                          {new Date(payment.createdAt).toLocaleDateString()}
                                          {payment.paidAt && ` • Paid: ${new Date(payment.paidAt).toLocaleDateString()}`}
                                        </p>
                                        {payment.packageName && (
                                          <p className="text-sm text-gray-500">
                                            Package: {payment.packageName} {payment.paymentPlan && `(${payment.paymentPlan})`}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        payment.status === 'completed' 
                                          ? 'bg-green-100 text-green-800'
                                          : payment.status === 'failed'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="text-xs text-gray-500">
                                      Transaction ID: {payment.transactionId || 'N/A'}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" disabled>
                                        <Receipt className="w-4 h-4 mr-2" />
                                        Receipt
                                      </Button>
                                      <Button size="sm" variant="outline" disabled>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {pendingServiceAccessPayments.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-base font-semibold text-gray-700 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-yellow-600" />
                                Pending / Failed
                              </h4>
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {pendingServiceAccessPayments.length} transaction{pendingServiceAccessPayments.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {pendingServiceAccessPayments.slice(0, 5).map((payment: any) => (
                                <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded-full ${
                                        payment.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                                      }`} />
                                      <div>
                                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                                        <p className="text-sm text-gray-600">
                                          {payment.paymentMethod ? payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1) : 'Unknown'} • 
                                          {new Date(payment.createdAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        payment.status === 'failed'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {String(payment.status || 'pending').charAt(0).toUpperCase() + String(payment.status || 'pending').slice(1)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="text-xs text-gray-500">
                                      Transaction ID: {payment.transactionId || 'N/A'}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={openAfyaSolarPaymentDialog}
                                      >
                                        <DollarSign className="w-4 h-4 mr-2" />
                                        Retry Payment
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Invoice Requests */}
                        {invoiceRequests && invoiceRequests.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-base font-semibold text-gray-700 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                                Invoice Requests
                              </h4>
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {invoiceRequests.length} request{invoiceRequests.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {invoiceRequests.slice(0, 5).map((invoice: any) => (
                                <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded-full ${
                                        invoice.status === 'approved' 
                                          ? 'bg-green-500'
                                          : invoice.status === 'rejected'
                                          ? 'bg-red-500'
                                          : 'bg-yellow-500'
                                      }`} />
                                      <div>
                                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(invoice.amount)}</p>
                                        <p className="text-sm text-gray-600">
                                          Invoice • {new Date(invoice.createdAt).toLocaleDateString()}
                                        </p>
                                        {invoice.packageName && (
                                          <p className="text-sm text-gray-500">
                                            Package: {invoice.packageName} {invoice.paymentPlan && `(${invoice.paymentPlan})`}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        invoice.status === 'approved' 
                                          ? 'bg-green-100 text-green-800'
                                          : invoice.status === 'rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="text-xs text-gray-500">
                                      Request ID: {invoice.id}
                                    </div>
                                    <div className="flex gap-2">
                                      {invoice.status === 'pending' && (
                                        <Button size="sm" variant="outline" disabled>
                                          Awaiting invoice processing
                                        </Button>
                                      )}
                                      <Button size="sm" variant="outline">
                                        <FileText className="w-4 h-4 mr-2" />
                                        View Details
                                      </Button>
                                      <Button size="sm" variant="outline">
                                        <Download className="w-4 h-4 mr-2" />
                                        Download
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* View All Link */}
                        {((serviceAccessPayments && serviceAccessPayments.length > 5) || (invoiceRequests && invoiceRequests.length > 5)) && (
                          <div className="text-center pt-4">
                            <Button variant="outline" size="sm">
                              View All Transactions 
                              {((serviceAccessPayments?.length || 0) + (invoiceRequests?.length || 0)) > 5 
                                ? `${(serviceAccessPayments?.length || 0) + (invoiceRequests?.length || 0) - 5} more`
                                : ''
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-gray-400 text-2xl">💳</span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Payment History Found</h3>
                        <p className="text-gray-500 mb-4">Your Afya Solar subscription payments and invoice requests will appear here</p>
                        
                        <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                          <h4 className="text-sm font-semibold text-blue-900 mb-3">Payment Information:</h4>
                          <div className="text-xs text-blue-700 space-y-2 text-left">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span><strong>Mobile Money:</strong> M-Pesa, Airtel, Mixx</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span><strong>Bank Transfer:</strong> Direct bank deposits</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span><strong>Invoice:</strong> Pay by invoice (admin approval)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span><strong>Installments:</strong> Pay in installments for packages</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-3 bg-yellow-50 rounded text-xs text-yellow-700">
                          <p className="font-semibold">Current Status:</p>
                          <p>• Service Access Payments: {serviceAccessPayments?.length || 0}</p>
                          <p>• Invoice Requests: {invoiceRequests?.length || 0}</p>
                          <p>• Afya Solar Subscriber: {afyaSolarSubscriber ? 'Found' : 'Not found'}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
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

            {currentActiveSection === 'report' && (
              <div className="space-y-6">
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
                      <FileText className="w-5 h-5 text-green-600" />
                      Energy Reports
                    </CardTitle>
                    <CardDescription className={metaTextClass}>Generate and download detailed energy consumption reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Button className="h-auto p-4 flex flex-col items-start bg-green-600 hover:bg-green-700">
                          <FileText className="w-5 h-5 mb-2" />
                          <span className="font-semibold">Daily Report</span>
                          <span className="text-xs opacity-90">Today's energy usage</span>
                        </Button>
                        <Button className="h-auto p-4 flex flex-col items-start bg-green-600 hover:bg-green-700">
                          <FileText className="w-5 h-5 mb-2" />
                          <span className="font-semibold">Weekly Report</span>
                          <span className="text-xs opacity-90">Last 7 days summary</span>
                        </Button>
                        <Button className="h-auto p-4 flex flex-col items-start bg-green-600 hover:bg-green-700">
                          <FileText className="w-5 h-5 mb-2" />
                          <span className="font-semibold">Monthly Report</span>
                          <span className="text-xs opacity-90">Full month analysis</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Reports */}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={sectionTitleClass}>Recent Reports</CardTitle>
                    <CardDescription className={metaTextClass}>Download previously generated reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { id: 1, name: 'Monthly Report - February 2024', type: 'monthly', date: '2024-03-01', size: '2.4 MB' },
                        { id: 2, name: 'Weekly Report - Week 8', type: 'weekly', date: '2024-02-25', size: '1.8 MB' },
                        { id: 3, name: 'Daily Report - March 10, 2024', type: 'daily', date: '2024-03-10', size: '0.5 MB' },
                      ].map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <FileText className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{report.name}</h4>
                              <p className={metaTextClass}>{report.date} â€¢ {report.size}</p>
                            </div>
                          </div>
                          <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50">
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Report Statistics */}
                <Card className={panelCardClass}>
                  <CardHeader>
                    <CardTitle className={sectionTitleClass}>Report Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <p className={metaTextClass}>Total Reports</p>
                        <p className="text-xl font-semibold text-gray-900">24</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <p className={metaTextClass}>This Month</p>
                        <p className="text-xl font-semibold text-gray-900">3</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <p className={metaTextClass}>Last Generated</p>
                        <p className="text-base font-medium text-gray-900">Mar 10, 2024</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

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

