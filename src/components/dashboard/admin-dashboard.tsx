"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatCurrency } from "@/lib/utils"
import {
  Building2,
  Users,
  Zap,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Search,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Eye,
  Edit,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  X,
  Package,
  RefreshCcw,
  Plus,
  Wrench,
  Stethoscope,
  ClipboardCheck,
  CalendarCheck,
  Home,
  ChevronDown,
  ChevronUp,
  Sun,
  Sparkles,
  Gift,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Plug,
  UserCheck,
  AlertCircle,
  Bell,
  Battery,
  Wifi,
  WifiOff,
  Thermometer,
  Gauge,
  Leaf,
  CloudSun,
  FileText,
  Receipt,
  Monitor,
  TrendingDown,
  Settings,
  Clock as ClockIcon,
  Trash2,
} from "lucide-react"
import { useDeviceRequests, useUpdateDeviceRequest } from "@/hooks/use-device-requests"
import { LogoutButton } from "@/components/logout-button"
import { UserManagement } from "@/components/dashboard/user-management"
import { TechnicianManagement } from "@/components/dashboard/technician-management"
import { AdminNotifications } from "@/components/admin/admin-notifications"
import { NotificationPopup } from "@/components/admin/notification-popup"
import AdminSolarLiveMonitoring from "@/components/solar/admin-solar-live-monitoring"
import AdminSolarAnalytics from "@/components/solar/admin-solar-analytics"
import AdminSolarAlerts from "@/components/solar/admin-solar-alerts"
import AdminSolarMaintenance from "@/components/solar/admin-solar-maintenance"
import AdminSolarPerformance from "@/components/solar/admin-solar-performance"
import AdminSolarEnergyReports from "@/components/solar/admin-solar-energy-reports"
import AdminSolarCarbonCredits from "@/components/solar/admin-solar-carbon-credits"
import { EnergyEfficiencyAssessment } from "@/components/energy/energy-efficiency-assessment"
import { ClimateResilienceAssessment } from "@/components/climate/climate-resilience-assessment"
import { FacilityCarbonCredits } from "@/components/dashboard/facility-carbon-credits"
import { useComprehensiveFacilities, type ComprehensiveFacility } from "@/hooks/use-facilities"
import { useFacilities } from "@/hooks/use-facilities"
import type { Facility } from "@/types"
import { InviteFacilityDialog } from "@/components/dashboard/invite-facility-dialog"
import { BulkInviteFacilitiesDialog } from "@/components/dashboard/bulk-invite-facilities-dialog"
import { DeleteFacilityDialog } from "@/components/dashboard/delete-facility-dialog"
import { AdminTransactions } from "@/components/dashboard/admin-transactions"
import { useAdminWithdrawals, useUpdateWithdrawal } from "@/hooks/use-admin-withdrawals"
import { format } from "date-fns"
import { AdminFeatureRequests } from "@/components/dashboard/admin-feature-requests"
import { AdminReferrals } from "@/components/dashboard/admin-referrals"
import { AdminPaymentTransactions } from "@/components/dashboard/admin-payment-transactions"
import { AdminBulkSMS } from "@/components/dashboard/admin-bulk-sms"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import AfyaSolarAdminDashboard from '@/components/afya-solar/admin-dashboard'
import AfyaSolarPackageManagement from '@/components/afya-solar/package-management'
import AfyaSolarServiceManagement from '@/components/afya-solar/service-management'
import AfyaSolarSubscribersManagement from '@/components/afya-solar/subscribers-management'
import AfyaSolarMeterManagement from '@/components/afya-solar/meter-management'
import AfyaSolarInvoiceRequests from '@/components/afya-solar/invoice-requests'
import { ServiceVisibilityPanel } from "@/components/dashboard/ServiceVisibilityPanel"
import { useNotificationCount } from "@/hooks/use-notification-count"
import { FacilityDetailsDialog } from "@/components/dashboard/facility-details-dialog"

type AdminTransactionStats = {
  total: number
  completed: number
  failed: number
  pending: number
  totalAmount: number
}

type SectionId =
  | 'overview'
  | 'facilities'
  | 'service-visibility'
  | 'users'
  | 'technicians'
  | 'payments'
  | 'devices'
  | 'device-requests'
  | 'afya-solar-dashboard'
  | 'afya-solar-services'
  | 'afya-solar-packages'
  | 'afya-solar-subscribers'
  | 'afya-solar-invoice-requests'
  | 'afya-solar-meters'
  | 'afya-solar-reports'
  | 'solar-live-monitoring'
  | 'solar-analytics'
  | 'solar-alerts'
  | 'solar-maintenance'
  | 'solar-performance'
  | 'solar-energy-reports'
  | 'solar-carbon-credits'
  | 'energy-assessment'
  | 'climate-resilient'
  | 'transactions'
  | 'payment-transactions'
  | 'feature-requests'
  | 'referrals'
  | 'bulk-sms'
  | 'notifications'

type AdminDashboardProps = {
  initialSection?: SectionId
}

// Grouped navigation structure
type NavGroup = 'general' | 'afya-solar'

const navGroups: Record<
  NavGroup,
  {
    label: string
    icon: React.ElementType
    items: { id: SectionId; label: string; icon: React.ElementType }[]
  }
> = {
  'general': {
    label: 'General',
    icon: Home,
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'facilities', label: 'Facilities', icon: Building2 },
      { id: 'service-visibility', label: 'Service Visibility', icon: Eye },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'technicians', label: 'Technicians', icon: Wrench },
      { id: 'payment-transactions', label: 'Payment Transactions', icon: CreditCard },
      { id: 'transactions', label: 'Withdrawals', icon: DollarSign },
      { id: 'feature-requests', label: 'Feature Requests', icon: Sparkles },
      { id: 'referrals', label: 'Referrals', icon: Gift },
      { id: 'bulk-sms', label: 'Bulk SMS', icon: Phone },
      { id: 'afya-solar-invoice-requests', label: 'Invoice Requests', icon: Receipt },
      { id: 'notifications', label: 'Notification Center', icon: Bell },
    ],
  },
  'afya-solar': {
    label: 'Afya Solar',
    icon: Sun,
    items: [
      { id: 'afya-solar-dashboard', label: 'Dashboard Overview', icon: BarChart3 },
      { id: 'afya-solar-packages', label: 'Package Management', icon: Package },
      { id: 'afya-solar-subscribers', label: 'Subscribers', icon: UserCheck },
      { id: 'solar-alerts', label: 'Alerts & Notifications', icon: Bell },
      { id: 'solar-carbon-credits', label: 'Carbon Credits', icon: Leaf },
      { id: 'energy-assessment', label: 'Energy Assessment', icon: Gauge },
      { id: 'climate-resilient', label: 'Climate Resilient', icon: CloudSun },
    ],
  },
}

// Helper to determine which group a section belongs to
const getSectionGroup = (section: SectionId): NavGroup => {
  if (['afya-solar-dashboard', 'afya-solar-packages', 'afya-solar-subscribers', 'solar-alerts', 'solar-carbon-credits', 'energy-assessment', 'climate-resilient'].includes(section)) {
    return 'afya-solar'
  }
  if (['notifications'].includes(section)) {
    return 'general'
  }
  return 'general'
}

export function AdminDashboard({ initialSection = "overview" }: AdminDashboardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: facilities, isLoading } = useFacilities()
  const { data: deviceRequests } = useDeviceRequests()
  const updateDeviceRequest = useUpdateDeviceRequest()
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection)
  const [openGroups, setOpenGroups] = useState<Set<NavGroup>>(new Set(['general']))
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<string>('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedDeviceRequest, setSelectedDeviceRequest] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const [facilityToDelete, setFacilityToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteFacilityDialogOpen, setDeleteFacilityDialogOpen] = useState(false)
  const [overviewProductFilter, setOverviewProductFilter] = useState<'afya-solar'>('afya-solar')
  const [overviewFacilityFilter, setOverviewFacilityFilter] = useState<string>('all')
  const [overviewPaymentFilter, setOverviewPaymentFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [expandedFacilities, setExpandedFacilities] = useState<Set<string>>(new Set())
  const [facilityQuickViewOpen, setFacilityQuickViewOpen] = useState(false)
  const [facilityQuickView, setFacilityQuickView] = useState<ComprehensiveFacility | null>(null)
  
  // Assessment facility selection states
  const [energyAssessmentFacility, setEnergyAssessmentFacility] = useState<string>('')
  const [climateResilientFacility, setClimateResilientFacility] = useState<string>('')
  const [carbonCreditsFacility, setCarbonCreditsFacility] = useState<string>('')
  const bookingFacilities: any[] = []
  const bookingFacilitiesLoading = false
  const refetchBookingFacilities = async () => {}

  // Service visibility state
  type ServiceName = "afya-solar"
  const [selectedVisibilityFacilityId, setSelectedVisibilityFacilityId] = useState<string>("")
  const [loadingVisibility, setLoadingVisibility] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [visibleServices, setVisibleServices] = useState<ServiceName[]>([])
  const adminUpdateBooking = { mutateAsync: async () => {} } as any
  const { data: withdrawalsData } = useAdminWithdrawals('pending')
  const pendingWithdrawalsCount = withdrawalsData?.counts?.pending || 0
  const { data: notificationCountData } = useNotificationCount()
  const unreadNotificationCount = notificationCountData || 0
  const [showNotificationPopup, setShowNotificationPopup] = useState(false)

  const [activityRange, setActivityRange] = useState<"weekly" | "monthly" | "all" | "all-time">("monthly")

  const { data: userActivityData, isFetching: userActivityFetching } = useQuery({
    queryKey: ["admin-activity", "users", activityRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity?scope=users&range=${activityRange}`)
      if (!res.ok) throw new Error("Failed to load user activity")
      return res.json() as Promise<{ rows: any[]; from: string | null; to: string | null }>
    },
    refetchInterval: 15000,
  })

  const { data: facilityActivityData, isFetching: facilityActivityFetching } = useQuery({
    queryKey: ["admin-activity", "facilities", activityRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity?scope=facilities&range=${activityRange}`)
      if (!res.ok) throw new Error("Failed to load facility activity")
      return res.json() as Promise<{ rows: any[]; from: string | null; to: string | null }>
    },
    refetchInterval: 15000,
  })

  const { data: activeFinanceSubs, isFetching: subsFetching } = useQuery({
    queryKey: ["admin-active-subs", "afya-solar"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/subscriptions/active?service=afya-solar`)
      if (!res.ok) throw new Error("Failed to load active subscriptions")
      return res.json() as Promise<{ success: boolean; data: any[] }>
    },
    refetchInterval: 30000,
  })

  useEffect(() => {
    setActiveSection(initialSection)
  }, [initialSection])

  const {
    data: overviewData,
    isFetching: overviewFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load overview")
      }
      return res.json() as Promise<{
        asOf: string
        kpis: {
          facilitiesTotal: number
          facilitiesActive: number
          usersTotal: number
          usersFacility: number
          usersAdmin: number
          devicesTotal: number
          devicesOnline: number
          activeAlerts: number
          criticalAlerts: number
          revenueTotalCompleted: number
          revenue30dCompleted: number
          transactions30d: { total: number; completed: number; failed: number; pending: number }
        }
      }>
    },
    refetchInterval: 15000,
  })

  // Use comprehensive facilities data for the facilities tab
  const { data: comprehensiveFacilities, isLoading: comprehensiveFacilitiesLoading } = useComprehensiveFacilities(
    activeSection === 'facilities' ? searchQuery : undefined,
    activeSection === 'facilities' ? statusFilter : undefined
  )

  // Set sidebar initial state based on screen size
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1024
    setSidebarOpen(isDesktop)
  }, [])

  // Auto-open the group containing the active section
  useEffect(() => {
    const activeGroup = getSectionGroup(activeSection)
    setOpenGroups(new Set([activeGroup]))
  }, [activeSection])

  const toggleGroup = (group: NavGroup) => {
    setOpenGroups((prev) => {
      if (prev.has(group)) {
        const newSet = new Set(prev)
        newSet.delete(group)
        return newSet
      } else {
        return new Set([group])
      }
    })
  }

  const handleToggleBookingFacility = (facilityId: string, enabled: boolean) => {
    adminUpdateBooking.mutateAsync({ facilityId, isBookingEnabled: enabled })
  }

  // Toggle facility card expansion
  const toggleFacilityExpansion = (facilityId: string) => {
    setExpandedFacilities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(facilityId)) {
        newSet.delete(facilityId)
      } else {
        newSet.add(facilityId)
      }
      return newSet
    })
  }

  const openFacilityQuickView = (facility: ComprehensiveFacility) => {
    setFacilityQuickView(facility)
    setFacilityQuickViewOpen(true)
  }

  // Filter facilities based on search and status
  const filteredFacilities = useMemo(() => {
    if (!comprehensiveFacilities) return []
    
    return comprehensiveFacilities.filter((facility: ComprehensiveFacility) => {
      const matchesSearch = !searchQuery || 
        facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        facility.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        facility.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        facility.phone.includes(searchQuery) ||
        (facility.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
      
      const matchesStatus = statusFilter === 'all' || facility.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [comprehensiveFacilities, searchQuery, statusFilter])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r shadow-sm transition-all duration-300 fixed lg:static inset-y-0 left-0 z-50 flex flex-col",
          sidebarOpen ? "w-72" : "w-16",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 flex-shrink-0 rounded-full overflow-hidden border border-emerald-100 bg-emerald-50 flex items-center justify-center">
                  <span className="text-lg font-bold text-emerald-700">AL</span>
                </div>
                <span className="text-base font-semibold text-gray-900">Afya Link</span>
              </div>
            )}
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
          <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
            {Object.entries(navGroups).map(([groupKey, group]) => {
              const GroupIcon = group.icon
              const isOpen = openGroups.has(groupKey as NavGroup)
              const hasActiveItem = group.items.some((item) => item.id === activeSection)
              
              return (
                <div key={groupKey} className="space-y-1">
                  <button
                    onClick={() => toggleGroup(groupKey as NavGroup)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded transition-colors",
                      hasActiveItem
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <GroupIcon className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform flex-shrink-0",
                            isOpen ? "rotate-180" : ""
                          )}
                        />
                      </>
                    )}
                  </button>
                  {isOpen && (
                    <div className={cn("space-y-1", sidebarOpen ? "pl-6" : "pl-0")}>
                      {group.items.map((item) => {
                        const ItemIcon = item.icon
                        const isActive = activeSection === item.id
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.id === 'service-visibility') {
                                setActiveSection('service-visibility')
                                setMobileMenuOpen(false)
                                return
                              }
                              if (item.id === 'overview') {
                                router.push('/dashboard/admin/overview')
                                return
                              }
                              if (item.id === 'facilities') {
                                router.push('/dashboard/admin/facilities')
                                return
                              }
                              if (item.id === 'users') {
                                router.push('/dashboard/admin/users')
                                return
                              }
                              if (item.id === 'notifications') {
                                setShowNotificationPopup(true)
                                setMobileMenuOpen(false)
                                return
                              }
                              setActiveSection(item.id)
                              setMobileMenuOpen(false)
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors",
                              isActive
                                ? "bg-green-600 text-white shadow-sm"
                                : item.id === 'notifications'
                                ? "text-red-600 hover:bg-red-50 border border-red-200"
                                : "text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            <ItemIcon className={cn("w-4 h-4 flex-shrink-0", item.id === 'notifications' && !isActive && "text-red-600")} />
                            {sidebarOpen && (
                              <span className="flex-1 text-left">{item.label}</span>
                            )}
                            {item.id === 'transactions' && pendingWithdrawalsCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                                {pendingWithdrawalsCount}
                              </Badge>
                            )}
                            {item.id === 'notifications' && unreadNotificationCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                                {unreadNotificationCount}
                              </Badge>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t mt-auto">
            <LogoutButton
              variant="ghost"
              className={cn("w-full justify-center text-xs", sidebarOpen && "justify-start")}
              showIcon={false}
              showTextOnMobile={true}
            />
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
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
            <div className="flex flex-col gap-3">
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
                    <Menu className="w-5 h-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide sr-only">
                      Admin Dashboard
                    </p>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
                      Management Panel
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5 truncate hidden sm:block">
                      Monitor Afya Solar facilities and operations
                    </p>
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
                    aria-label="Go to Afya Solar"
                  >
                    <Home className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Overview Section */}
            {activeSection === 'overview' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">System Overview</CardTitle>
                        <CardDescription>
                          Live operational metrics for administrators (auto-refreshes every 15 seconds)
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchOverview()}
                          className="text-xs"
                          disabled={overviewFetching}
                        >
                          <RefreshCcw className={cn("w-3.5 h-3.5 mr-1.5", overviewFetching && "animate-spin")} />
                          Refresh
                        </Button>
                        {overviewData?.asOf && (
                          <Badge variant="secondary" className="text-xs">
                            Updated {format(new Date(overviewData.asOf), "HH:mm:ss")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>Facilities, users, devices, alerts, and payments.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-3">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-2xl font-bold text-blue-700">{overviewData?.kpis.facilitiesTotal ?? facilities?.length ?? 0}</div>
                        <div className="text-sm text-blue-600 font-medium">Facilities</div>
                        <div className="text-xs text-blue-700/80 mt-1">
                          {overviewData?.kpis.facilitiesActive ?? 0} active
                        </div>
                      </div>
                      <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-2xl font-bold text-green-700">{overviewData?.kpis.usersTotal ?? 0}</div>
                        <div className="text-sm text-green-600 font-medium">Users</div>
                        <div className="text-xs text-green-700/80 mt-1">
                          {overviewData?.kpis.usersFacility ?? 0} facility · {overviewData?.kpis.usersAdmin ?? 0} admin
                        </div>
                      </div>
                      <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                        <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center mx-auto mb-3">
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-2xl font-bold text-purple-700">{overviewData?.kpis.devicesTotal ?? 0}</div>
                        <div className="text-sm text-purple-600 font-medium">Devices</div>
                        <div className="text-xs text-purple-700/80 mt-1">
                          {overviewData?.kpis.devicesOnline ?? 0} online
                        </div>
                      </div>
                      <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-3">
                          <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-2xl font-bold text-orange-700">
                          {formatCurrency(overviewData?.kpis.revenueTotalCompleted ?? 0)}
                        </div>
                        <div className="text-sm text-orange-600 font-medium">Revenue (completed)</div>
                        <div className="text-xs text-orange-700/80 mt-1">
                          {formatCurrency(overviewData?.kpis.revenue30dCompleted ?? 0)} last 30d
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Activity & usage</h3>
                        <p className="text-xs text-gray-600">
                          Showing login activity for:{" "}
                          {activityRange === "weekly"
                            ? "last 7 days"
                            : activityRange === "monthly"
                              ? "last 30 days"
                              : activityRange === "all"
                                ? "last 12 months"
                                : "all time"}
                        </p>
                      </div>
                      <Select value={activityRange} onValueChange={(v: any) => setActivityRange(v)}>
                        <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="all">All (12m)</SelectItem>
                          <SelectItem value="all-time">All time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Facilities (usage)</CardTitle>
                          <CardDescription className="text-xs">
                            Sorted by login count in selected range
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="secondary" className="text-xs">
                              Total facilities: {overviewData?.kpis.facilitiesTotal ?? facilities?.length ?? 0}
                            </Badge>
                            {facilityActivityFetching && <span className="text-[11px] text-gray-500">Updating…</span>}
                          </div>
                          <div className="space-y-2">
                            {(facilityActivityData?.rows || []).slice(0, 12).map((row: any) => (
                              <div key={row.facilityId || row.facilityName} className="flex items-center justify-between border rounded-md p-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{row.facilityName}</div>
                                  <div className="text-[11px] text-gray-500 truncate">
                                    {row.city ? `${row.city}, ` : ""}{row.region || ""} · Last login:{" "}
                                    {row.lastLoginAt ? format(new Date(row.lastLoginAt), "PPp") : "—"}
                                  </div>
                                </div>
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                                  {row.loginCount} logins
                                </Badge>
                              </div>
                            ))}
                            {(!facilityActivityData?.rows || facilityActivityData.rows.length === 0) && (
                              <p className="text-xs text-gray-500">No login events yet. Users will start appearing after they sign in.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Users (usage)</CardTitle>
                          <CardDescription className="text-xs">
                            Sorted by login count in selected range
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {(userActivityData?.rows || []).slice(0, 12).map((row: any) => (
                              <div key={row.userId || row.email} className="flex items-center justify-between border rounded-md p-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{row.name || row.email}</div>
                                  <div className="text-[11px] text-gray-500 truncate">
                                    {row.email} · {row.role} · Last login: {row.lastLoginAt ? format(new Date(row.lastLoginAt), "PPp") : "—"}
                                  </div>
                                </div>
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {row.loginCount} logins
                                </Badge>
                              </div>
                            ))}
                            {userActivityFetching && <p className="text-[11px] text-gray-500">Updating…</p>}
                            {(!userActivityData?.rows || userActivityData.rows.length === 0) && (
                              <p className="text-xs text-gray-500">No login events yet. Users will start appearing after they sign in.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-6">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Afya Solar active subscriptions</CardTitle>
                        <CardDescription className="text-xs">
                          Facilities with an active (non-expired) subscription
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="secondary" className="text-xs">
                            Active: {activeFinanceSubs?.data?.length ?? 0}
                          </Badge>
                          {subsFetching && <span className="text-[11px] text-gray-500">Updating…</span>}
                        </div>
                        <div className="space-y-2">
                          {(activeFinanceSubs?.data || []).slice(0, 20).map((row: any) => (
                            <div key={row.facilityId} className="flex items-center justify-between border rounded-md p-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{row.facilityName}</div>
                                <div className="text-[11px] text-gray-500 truncate">
                                  {row.city ? `${row.city}, ` : ""}{row.region || ""} · Plan: {row.planType || "—"} · Billing: {row.billingCycle || "—"} · Expires:{" "}
                                  {row.expiryDate ? format(new Date(row.expiryDate), "PP") : "—"}
                                </div>
                              </div>
                              <Badge className="bg-purple-50 text-purple-700 border border-purple-200">Active</Badge>
                            </div>
                          ))}
                          {(!activeFinanceSubs?.data || activeFinanceSubs.data.length === 0) && (
                            <p className="text-xs text-gray-500">No active subscriptions found.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Facilities Section */}
            {activeSection === 'facilities' && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Facilities</CardTitle>
                        <CardDescription className="text-xs">Manage all healthcare facilities</CardDescription>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          asChild
                        >
                          <Link href="/dashboard/admin/service-visibility">
                            <Eye className="w-3 h-3 mr-1.5" />
                            Service visibility
                          </Link>
                        </Button>
                        <InviteFacilityDialog
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['facilities'] })
                            queryClient.invalidateQueries({ queryKey: ['comprehensive-facilities'] })
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {comprehensiveFacilitiesLoading ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm text-gray-600">Loading facilities...</p>
                      </div>
                    ) : filteredFacilities && filteredFacilities.length > 0 ? (
                      <div className="space-y-2">
                        {filteredFacilities.map((facility) => {
                          const credit = Number(facility.creditBalance || 0)
                          const isLowCredit = credit < 10000
                          
                          return (
                            <div
                              key={facility.id}
                              className="border rounded-lg bg-white hover:shadow-md transition-all"
                            >
                              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white border-b">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                    <Building2 className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg text-gray-900 truncate">{facility.name}</h3>
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                      <Badge 
                                        variant={facility.status === 'active' ? 'default' : 'secondary'}
                                        className={`text-xs px-3 py-1 font-semibold ${
                                          facility.status === 'active' 
                                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-green-400 shadow-sm' 
                                            : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white border-gray-400'
                                        }`}
                                      >
                                        {facility.status === 'active' ? '✓ Active' : facility.status}
                                      </Badge>
                                      {isLowCredit && (
                                        <Badge className="text-xs px-3 py-1 font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-400 shadow-sm">
                                          ⚠️ Low Credit
                                        </Badge>
                                      )}
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <MapPin className="w-4 h-4" />
                                        <span>{facility.city}, {facility.region}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleFacilityExpansion(facility.id)}
                                    className="text-xs h-9 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400 hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all duration-200"
                                  >
                                    {expandedFacilities.has(facility.id) ? (
                                      <>
                                        <ChevronUp className="w-4 h-4 mr-2" />
                                        Hide Details
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-4 h-4 mr-2" />
                                        Show Details
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-9 px-3 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 transition-all duration-200"
                                    onClick={() => {
                                      setFacilityToDelete({ id: facility.id, name: facility.name })
                                      setDeleteFacilityDialogOpen(true)
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </Button>
                                </div>
                              </div>

                              {expandedFacilities.has(facility.id) && (
                                <div className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="border rounded-md p-3 bg-white">
                                      <div className="text-[11px] text-gray-500">Credit balance</div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {formatCurrency(Number(facility.creditBalance || 0))}
                                      </div>
                                    </div>
                                    <div className="border rounded-md p-3 bg-white">
                                      <div className="text-[11px] text-gray-500">Devices</div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {facility.activeDevices || 0}/{facility.deviceCount || 0} active
                                      </div>
                                    </div>
                                    <div className="border rounded-md p-3 bg-white">
                                      <div className="text-[11px] text-gray-500">Users</div>
                                      <div className="text-sm font-semibold text-gray-900">{facility.userCount || 0}</div>
                                    </div>
                                    <div className="border rounded-md p-3 bg-white">
                                      <div className="text-[11px] text-gray-500">Payments</div>
                                      <div className="text-sm font-semibold text-gray-900">{facility.totalPayments || 0}</div>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={() => openFacilityQuickView(facility)}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View details
                                    </Button>
                                    <Button asChild size="sm" variant="outline" className="text-xs">
                                      <Link href={`/dashboard/admin/facilities/${facility.id}`}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        Open full details page
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Building2 className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {searchQuery || statusFilter !== 'all' 
                            ? 'No facilities match your filters' 
                            : 'No facilities yet'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {facilityToDelete && (
                  <DeleteFacilityDialog
                    facilityId={facilityToDelete.id}
                    facilityName={facilityToDelete.name}
                    open={deleteFacilityDialogOpen}
                    onOpenChange={(open) => setDeleteFacilityDialogOpen(open)}
                    onSuccess={() => {
                      setDeleteFacilityDialogOpen(false)
                      setFacilityToDelete(null)
                      queryClient.invalidateQueries({ queryKey: ['facilities'] })
                      toast.success('Facility deleted successfully')
                    }}
                  />
                )}

                <FacilityDetailsDialog
                  facility={facilityQuickView}
                  open={facilityQuickViewOpen}
                  onOpenChange={(open) => {
                    setFacilityQuickViewOpen(open)
                    if (!open) setFacilityQuickView(null)
                  }}
                />
              </>
            )}

            {/* Service Visibility Panel */}
            {activeSection === 'service-visibility' && (
              <ServiceVisibilityPanel
                selectedFacilityId={selectedVisibilityFacilityId}
                loadingVisibility={loadingVisibility}
                savingVisibility={savingVisibility}
                visibleServices={visibleServices}
                setLoadingVisibility={setLoadingVisibility}
                setSavingVisibility={setSavingVisibility}
                setVisibleServices={setVisibleServices}
              />
            )}

            {/* User Management */}
            {activeSection === 'users' && (
              <UserManagement />
            )}

            {/* Technician Management */}
            {activeSection === 'technicians' && (
              <TechnicianManagement />
            )}

            {/* Payment Transactions */}
            {activeSection === 'payment-transactions' && (
              <AdminPaymentTransactions />
            )}

            {/* Transactions */}
            {activeSection === 'transactions' && (
              <AdminTransactions />
            )}

            {/* Feature Requests */}
            {activeSection === 'feature-requests' && (
              <AdminFeatureRequests />
            )}

            {/* Referrals */}
            {activeSection === 'referrals' && (
              <AdminReferrals />
            )}

            {/* Bulk SMS */}
            {activeSection === 'bulk-sms' && (
              <AdminBulkSMS />
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <Card>
                <CardHeader>
                  <CardTitle>Notification Center</CardTitle>
                  <CardDescription>
                    Manage system notifications and alerts
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <AdminNotifications />
                </CardContent>
              </Card>
            )}

            {/* Afya Solar Sections */}
            {activeSection === 'afya-solar-dashboard' && (
              <AfyaSolarAdminDashboard />
            )}

            {activeSection === 'afya-solar-packages' && (
              <AfyaSolarPackageManagement />
            )}

            {activeSection === 'afya-solar-subscribers' && (
              <AfyaSolarSubscribersManagement />
            )}

            {activeSection === 'solar-live-monitoring' && (
              <AdminSolarLiveMonitoring />
            )}

            {activeSection === 'solar-analytics' && (
              <AdminSolarAnalytics />
            )}

            {activeSection === 'solar-alerts' && (
              <AdminSolarAlerts />
            )}

            {activeSection === 'solar-maintenance' && (
              <AdminSolarMaintenance />
            )}

            {activeSection === 'solar-performance' && (
              <AdminSolarPerformance />
            )}

            {activeSection === 'solar-energy-reports' && (
              <AdminSolarEnergyReports />
            )}

            {activeSection === 'solar-carbon-credits' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Leaf className="w-5 h-5 text-green-600" />
                      Carbon Credits Assessment
                    </CardTitle>
                    <CardDescription>
                      Calculate and manage carbon credits for any facility in the system.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Facility Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Select Facility</Label>
                      <Select value={carbonCreditsFacility} onValueChange={setCarbonCreditsFacility}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a facility for carbon credits assessment...">
                            {isLoading && (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                <span>Loading facilities...</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {facilities?.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{facility.name}</span>
                                <span className="text-xs text-gray-500">{facility.city}, {facility.region}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {facilities?.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">No facilities found. Please ensure facilities are registered in the system.</p>
                      )}
                    </div>

                    {/* Assessment Content */}
                    {carbonCreditsFacility && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Performing carbon credits assessment for: 
                          <strong> {facilities?.find(f => f.id === carbonCreditsFacility)?.name}</strong>
                        </p>
                        <FacilityCarbonCredits facilityId={carbonCreditsFacility} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'energy-assessment' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-green-600" />
                      Energy Assessment
                    </CardTitle>
                    <CardDescription>
                      Perform energy efficiency assessments for any facility in the system.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Facility Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Select Facility</Label>
                      <Select value={energyAssessmentFacility} onValueChange={setEnergyAssessmentFacility}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a facility to assess...">
                            {isLoading && (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                <span>Loading facilities...</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {facilities?.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{facility.name}</span>
                                <span className="text-xs text-gray-500">{facility.city}, {facility.region}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {facilities?.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">No facilities found. Please ensure facilities are registered in the system.</p>
                      )}
                    </div>

                    {/* Assessment Content */}
                    {energyAssessmentFacility && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Performing energy efficiency assessment for: 
                          <strong> {facilities?.find(f => f.id === energyAssessmentFacility)?.name}</strong>
                        </p>
                        <EnergyEfficiencyAssessment />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'climate-resilient' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CloudSun className="w-5 h-5 text-blue-600" />
                      Climate Resilient Assessment
                    </CardTitle>
                    <CardDescription>
                      Perform climate resilience assessments for any facility in the system.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Facility Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Select Facility</Label>
                      <Select value={climateResilientFacility} onValueChange={setClimateResilientFacility}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a facility to assess...">
                            {isLoading && (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                <span>Loading facilities...</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {facilities?.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{facility.name}</span>
                                <span className="text-xs text-gray-500">{facility.city}, {facility.region}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {facilities?.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">No facilities found. Please ensure facilities are registered in the system.</p>
                      )}
                    </div>

                    {/* Assessment Content */}
                    {climateResilientFacility && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Performing climate resilience assessment for: 
                          <strong> {facilities?.find(f => f.id === climateResilientFacility)?.name}</strong>
                        </p>
                        <ClimateResilienceAssessment 
                          facilityId={climateResilientFacility}
                          onCapacityScoreChange={(score) => {
                            console.log('Climate resilience capacity score for facility', climateResilientFacility, ':', score)
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Device Requests */}
            {activeSection === 'device-requests' && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Device Requests</CardTitle>
                      <CardDescription className="text-xs">Facility requests for new devices</CardDescription>
                    </div>
                    <select
                      value={deviceStatusFilter}
                      onChange={(e) => setDeviceStatusFilter(e.target.value)}
                      className="text-xs h-8 px-2 border rounded bg-white w-full sm:w-auto"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="fulfilled">Fulfilled</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  {deviceRequests && deviceRequests.length > 0 ? (
                    <div className="space-y-3">
                      {(deviceStatusFilter === 'all' 
                        ? deviceRequests 
                        : deviceRequests.filter(r => r.status === deviceStatusFilter)
                      ).map((request) => (
                        <div
                          key={request.id}
                          className="p-4 border rounded bg-white hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium text-sm truncate">{request.facilityName || 'Unknown Facility'}</h3>
                                <Badge 
                                  className={`text-xs px-1.5 py-0 flex-shrink-0 ${
                                    request.status === 'pending' 
                                      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                      : request.status === 'approved'
                                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                                      : request.status === 'fulfilled'
                                      ? 'bg-green-100 text-green-700 border-green-200'
                                      : 'bg-red-100 text-red-700 border-red-200'
                                  }`}
                                >
                                  {request.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 mb-2">
                                <strong>Request:</strong> {request.quantity} {request.deviceType || 'device(s)'}
                              </p>
                              {request.message && (
                                <p className="text-xs text-gray-600 mb-2 break-words">{request.message}</p>
                              )}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-500 mb-2">
                                <span className="break-words"><strong>From:</strong> {request.name} ({request.email})</span>
                                <span><strong>Phone:</strong> {request.phone}</span>
                                <span><strong>Date:</strong> {new Date(request.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No device requests found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>
        </main>
      </div>

      {/* Notification Popup */}
      <NotificationPopup
        isOpen={showNotificationPopup}
        onClose={() => setShowNotificationPopup(false)}
        unreadCount={unreadNotificationCount}
        onNotificationRead={() => {
          queryClient.invalidateQueries({ queryKey: ['notification-count'] })
        }}
      />
    </div>
  )
}
