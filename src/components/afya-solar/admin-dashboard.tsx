'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { 
  Package, 
  Users, 
  FileText, 
  Zap, 
  Settings, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  Edit,
  Plus,
  Trash2,
  Save,
  BarChart3,
  Battery,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface DashboardStats {
  totalServices: number
  activeServices: number
  suspendedServices: number
  pendingInstall: number
  totalPackages: number
  activePackages: number
  totalMeters: number
  onlineMeters: number
  queuedCommands: number
  monthlyRevenue: number
  overdueServices: number
  lastCheck: string
  automationEnabled: boolean
}

interface RecentService {
  id: number
  facilityId: string
  siteName: string
  status: string
  packageName: string
  planType: string
  createdAt: string
  smartmeterSerial?: string
}

interface RecentCommand {
  id: number
  commandType: string
  smartmeterSerial: string
  status: string
  createdAt: string
  reasonCode: string
}

interface SolarPackage {
  id: number
  name: string
  powerRating: number
  suitableFor: string
  minPrice?: number
  maxPrice?: number
  isActive: boolean
  createdAt: string
  description?: string
  plans?: Array<{
    id: number
    planType: string
  }>
}

interface DesignReport {
  id: number
  facilityId: string | null
  facilityName: string | null
  pvSizeKw: number | null
  batteryKwh: number | null
  grossMonthlySavings: number | null
  totalDailyEnergyKwh?: number | null
  criticalEnergyKwh?: number | null
  adjustedDailyEnergyKwh?: number | null
  numPanels?: number | null
  batteryAh?: number | null
  inverterKw?: number | null
  mpptCurrentA?: number | null
  baselineGridMonthly?: number | null
  baselineDieselMonthly?: number | null
  baselineTotalMonthly?: number | null
  afterGridMonthly?: number | null
  afterDieselMonthly?: number | null
  afterTotalMonthly?: number | null
  cashPriceTzs?: number | null
  cashPaybackMonths?: number | null
  installmentUpfrontTzs?: number | null
  installmentMonthlyTzs?: number | null
  installmentTermMonths?: number | null
  installmentNetSavingsTzs?: number | null
  installmentBreakevenMonths?: number | null
  eaasMonthlyTzs?: number | null
  eaasTermMonths?: number | null
  eaasNetSavingsTzs?: number | null
  meuTotalDailyLoadKwh?: number | null
  payloadJson?: string | null
  createdAt: string | null
}

type AdminTabId = 'services' | 'commands' | 'packages' | 'design' | 'automation'

export default function AfyaSolarAdminDashboard({ initialTab = 'services' }: { initialTab?: AdminTabId }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentServices, setRecentServices] = useState<RecentService[]>([])
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>([])
  // Add test package for debugging edit button
  const [packages, setPackages] = useState<SolarPackage[]>([
    {
      id: 1,
      name: "Test Solar Package",
      powerRating: 5,
      suitableFor: "Small homes",
      minPrice: 1000000,
      maxPrice: 2000000,
      isActive: true,
      createdAt: new Date().toISOString(),
      description: "A test package for debugging edit functionality",
      plans: [
        { id: 1, planType: "OUTRIGHT" },
        { id: 2, planType: "INSTALLMENT" }
      ]
    }
  ])
  const [loading, setLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<SolarPackage | null>(null)
  const [newPackage, setNewPackage] = useState<Partial<SolarPackage>>({
    name: '',
    powerRating: 0,
    suitableFor: '',
    minPrice: 0,
    maxPrice: 0,
    isActive: true,
    description: ''
  })
  const [designQuoteSummary, setDesignQuoteSummary] = useState<{
    pvKw: number
    panels: number
    batteryKwh: number
    inverterKw: number
    grossSavings: number
    eaasMonthly?: number | null
  } | null>(null)
  const [designQuoteError, setDesignQuoteError] = useState<string | null>(null)
  const [designReports, setDesignReports] = useState<DesignReport[] | null>(null)
  const [designReportsLoading, setDesignReportsLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState<DesignReport | null>(null)
  
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch automation status for stats
      const statsResponse = await fetch('/api/afya-solar/automation')
      if (!statsResponse.ok) throw new Error('Failed to fetch automation stats')
      const statsData = await statsResponse.json()
      
      // Fetch recent services
      const servicesResponse = await fetch('/api/afya-solar/client-services?limit=10')
      if (!servicesResponse.ok) throw new Error('Failed to fetch services')
      const servicesData = await servicesResponse.json()
      
      // Fetch recent commands
      const commandsResponse = await fetch('/api/afya-solar/meter-commands?limit=10')
      if (!commandsResponse.ok) throw new Error('Failed to fetch commands')
      const commandsData = await commandsResponse.json()

      // Fetch packages for package stats
      console.log('=== FETCHING PACKAGES ===')
      const packagesResponse = await fetch('/api/afya-solar/packages')
      console.log('Packages response status:', packagesResponse.status)
      if (!packagesResponse.ok) {
        console.error('Failed to fetch packages:', packagesResponse.statusText)
        throw new Error('Failed to fetch packages')
      }
      const packagesData = await packagesResponse.json()
      console.log('Packages data received:', packagesData)

      // Normalize packages list to a safe array
      const packageList: any[] = Array.isArray(packagesData?.data)
        ? packagesData.data
        : Array.isArray(packagesData)
          ? packagesData
          : []

      console.log('Normalized package list length:', packageList.length)

      // Calculate package stats
      const packageStats = {
        total: packageList.length,
        active: packageList.filter((pkg: any) => pkg.isActive === 1).length,
      }
      console.log('Package stats calculated:', packageStats)

      // Combine all stats
      const dashboardStats: DashboardStats = {
        totalServices: statsData.data?.services?.total || 0,
        activeServices: statsData.data?.services?.active || 0,
        suspendedServices: (statsData.data?.services?.suspendedOverdue || 0) + (statsData.data?.services?.suspendedAdmin || 0),
        pendingInstall: statsData.data?.services?.pendingInstall || 0,
        totalPackages: packageStats.total,
        activePackages: packageStats.active,
        totalMeters: statsData.data?.meters?.total || 0,
        onlineMeters: statsData.data?.meters?.online || 0,
        queuedCommands: statsData.data?.commands?.queued || 0,
        monthlyRevenue: 0, // Will be calculated from contracts in future
        overdueServices: statsData.data?.services?.suspendedOverdue || 0,
        lastCheck: statsData.data?.lastCheck || new Date().toISOString(),
        automationEnabled: statsData.data?.automationEnabled !== false
      }

      setStats(dashboardStats)
      setRecentServices(servicesData.data?.services || [])
      setRecentCommands(commandsData.data || [])
      console.log('=== SETTING PACKAGES STATE ===')
      console.log('Setting packages to:', packagesData.data || [])
      setPackages(packageList)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Set empty state on error
      setStats({
        totalServices: 0,
        activeServices: 0,
        suspendedServices: 0,
        pendingInstall: 0,
        totalPackages: 0,
        activePackages: 0,
        totalMeters: 0,
        onlineMeters: 0,
        queuedCommands: 0,
        monthlyRevenue: 0,
        overdueServices: 0,
        lastCheck: new Date().toISOString(),
        automationEnabled: false
      })
      setRecentServices([])
      setRecentCommands([])
      setPackages([])
    } finally {
      setLoading(false)
    }
  }

  const handleRunDesignEngine = async () => {
    try {
      setDesignQuoteError(null)
      // Simple default payload for admin preview; a richer UI can be added later.
      const payload = {
        DEVICE_LOAD_TABLE: [
          {
            device_name: 'Critical medical loads',
            wattage_w: 3000,
            quantity: 1,
            hours_per_day: 12,
            is_critical: true,
          },
        ],
        FACILITY_DATA: {
          facility_type: 'hybrid' as const,
          avg_outage_hours_per_day: 4,
          tanesco_monthly_bill_tzs: 1_500_000,
          diesel_litres_per_day: 10,
          diesel_price_tzs_per_litre: 3000,
        },
        SOLAR_SITE_DATA: {
          peak_sun_hours_worst_month: 4.5,
          system_dc_voltage: 48,
          battery_chemistry: 'lifepo4' as const,
        },
        SYSTEM_PARAMETERS: {
          panel_watt_rating: 620,
          growth_margin: 0.15,
        },
      }
      const res = await fetch('/api/afya-solar/design/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json?.success || !json?.data) {
        setDesignQuoteError(json?.error || 'Failed to run design engine')
        setDesignQuoteSummary(null)
        return
      }
      const data = json.data
      setDesignQuoteSummary({
        pvKw: data.system_design.pv_system_size_kw,
        panels: data.system_design.number_of_620w_panels,
        batteryKwh: data.system_design.battery_capacity_kwh,
        inverterKw: data.system_design.recommended_inverter_kw,
        grossSavings: data.monthly_savings.gross_monthly_savings_tzs,
        eaasMonthly: data.financing_comparison?.selected_pricing?.eaas_monthly_tzs ?? null,
      })
    } catch (err: any) {
      console.error('Error running design engine from admin dashboard:', err)
      setDesignQuoteError(err?.message || 'Unexpected error while running design engine')
      setDesignQuoteSummary(null)
    }
  }

  const fetchDesignReports = async () => {
    try {
      setDesignReportsLoading(true)
      const res = await fetch('/api/afya-solar/admin/design-reports?limit=20')
      const json = await res.json()
      if (!res.ok || !json?.success) {
        console.error('Error loading design reports:', json?.error)
        setDesignReports(null)
        return
      }
      setDesignReports(json.data || [])
    } catch (err) {
      console.error('Error fetching Afya Solar design reports:', err)
      setDesignReports(null)
    } finally {
      setDesignReportsLoading(false)
    }
  }

  // Load latest design reports on first mount so admins see data without
  // having to click Refresh manually.
  useEffect(() => {
    fetchDesignReports().catch((err) => {
      console.error('Error preloading Afya Solar design reports:', err)
    })
  }, [])
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'SUSPENDED_OVERDUE': return 'bg-red-100 text-red-800'
      case 'SUSPENDED_ADMIN': return 'bg-orange-100 text-orange-800'
      case 'PENDING_INSTALL': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCommandColor = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-yellow-100 text-yellow-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACKED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleEditPackage = (pkg: SolarPackage) => {
    console.log('=== EDIT PACKAGE DEBUG ===')
    console.log('Package clicked:', pkg)
    console.log('Package ID:', pkg.id)
    console.log('Package Name:', pkg.name)
    console.log('Current editingPackage state:', editingPackage)
    console.log('Current isEditDialogOpen state:', isEditDialogOpen)
    
    try {
      setEditingPackage(pkg)
      console.log('After setEditingPackage - editingPackage:', pkg)
      
      setIsEditDialogOpen(true)
      console.log('After setIsEditDialogOpen - isEditDialogOpen:', true)
      
      console.log('=== EDIT PACKAGE SUCCESS ===')
    } catch (error) {
      console.error('=== EDIT PACKAGE ERROR ===')
      console.error('Error in handleEditPackage:', error)
    }
  }

  const handleCreatePackage = () => {
    setNewPackage({
      name: '',
      powerRating: 0,
      suitableFor: '',
      minPrice: 0,
      maxPrice: 0,
      isActive: true,
      description: ''
    })
    setIsCreateDialogOpen(true)
  }

  const handleUpdatePackage = async () => {
    if (!editingPackage) return

    try {
      const response = await fetch(`/api/afya-solar/packages/${editingPackage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPackage)
      })

      if (!response.ok) throw new Error('Failed to update package')

      // Refresh packages data
      const packagesResponse = await fetch('/api/afya-solar/packages')
      if (packagesResponse.ok) {
        const packagesData = await packagesResponse.json()
        setPackages(packagesData.data || [])
      }

      setIsEditDialogOpen(false)
      setEditingPackage(null)
    } catch (error) {
      console.error('Error updating package:', error)
    }
  }

  const handleCreateNewPackage = async () => {
    try {
      const response = await fetch('/api/afya-solar/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPackage)
      })

      if (!response.ok) throw new Error('Failed to create package')

      // Refresh packages data
      const packagesResponse = await fetch('/api/afya-solar/packages')
      if (packagesResponse.ok) {
        const packagesData = await packagesResponse.json()
        setPackages(packagesData.data || [])
      }

      setIsCreateDialogOpen(false)
      setNewPackage({
        name: '',
        powerRating: 0,
        suitableFor: '',
        minPrice: 0,
        maxPrice: 0,
        isActive: true,
        description: ''
      })
    } catch (error) {
      console.error('Error creating package:', error)
    }
  }

  const handleDeletePackage = async (pkgId: number) => {
    if (!confirm('Are you sure you want to delete this package?')) return

    try {
      const response = await fetch(`/api/afya-solar/packages/${pkgId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete package')

      // Refresh packages data
      const packagesResponse = await fetch('/api/afya-solar/packages')
      if (packagesResponse.ok) {
        const packagesData = await packagesResponse.json()
        setPackages(packagesData.data || [])
      }
    } catch (error) {
      console.error('Error deleting package:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Afya Solar Admin</h1>
          <p className="text-gray-600">Manage solar services, contracts, and automation</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            Refresh
          </Button>
          <Button onClick={() => window.location.href = '/api/afya-solar/automation'} variant="outline" size="sm">
            Run Automation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalServices || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeServices || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.activeServices || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.suspendedServices || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.overdueServices || 0} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Smart Meters</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMeters || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.onlineMeters || 0} online
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="design">Design &amp; Finance</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Services</CardTitle>
              <CardDescription>Latest client service registrations and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentServices.map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{service.siteName || 'Unnamed Site'}</p>
                        <p className="text-sm text-gray-600">
                          {service.packageName} • {service.planType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(service.status)}>
                        {service.status.replace('_', ' ')}
                      </Badge>
                      {service.smartmeterSerial && (
                        <Badge variant="outline">{service.smartmeterSerial}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Commands</CardTitle>
              <CardDescription>Latest smart meter commands and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCommands.map((command) => (
                  <div key={command.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{command.commandType}</p>
                        <p className="text-sm text-gray-600">
                          Meter: {command.smartmeterSerial} • {command.reasonCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCommandColor(command.status)}>
                        {command.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Solar Packages</CardTitle>
                  <CardDescription>Manage solar package offerings and pricing</CardDescription>
                </div>
                <Button onClick={handleCreatePackage} className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Package
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{pkg.name}</h3>
                      <Badge className={pkg.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {pkg.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    {pkg.description && (
                      <p className="text-sm text-gray-600">{pkg.description}</p>
                    )}
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Power:</span>
                        <span className="font-medium">{pkg.powerRating} kW</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Suitable for:</span>
                        <span className="font-medium">{pkg.suitableFor}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Price Range:</span>
                        <span className="font-medium">
                          TZS {pkg.minPrice?.toLocaleString()} - {pkg.maxPrice?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-gray-600 mb-1">Available Plans:</p>
                      <div className="flex flex-wrap gap-1">
                        {pkg.plans?.map((plan) => (
                          <Badge key={plan.id} variant="outline" className="text-xs">
                            {plan.planType}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          Created {new Date(pkg.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex gap-1">
                          {/* Test Button */}
                          <button
                            type="button"
                            className="bg-blue-500 text-white px-2 py-1 text-xs rounded hover:bg-blue-600"
                            onClick={() => {
                              console.log('=== TEST BUTTON CLICKED ===')
                              console.log('Package ID:', pkg.id)
                              alert(`Test clicked package ${pkg.id}`)
                            }}
                          >
                            TEST
                          </button>
                          
                          {/* Edit Button */}
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 h-8 w-8"
                            onClick={() => {
                              console.log('=== EDIT BUTTON CLICKED ===')
                              console.log('Package ID:', pkg.id)
                              console.log('Package Name:', pkg.name)
                              handleEditPackage(pkg)
                            }}
                            title="Edit Package"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          
                          {/* Delete Button */}
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 h-8 w-8"
                            onClick={() => {
                              console.log('=== DELETE BUTTON CLICKED ===')
                              console.log('Package ID:', pkg.id)
                              handleDeletePackage(pkg.id)
                            }}
                            title="Delete Package"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {packages.length === 0 && (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No packages found</p>
                  <Button className="mt-4" onClick={handleCreatePackage}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Package
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Package Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            console.log('=== DIALOG OPEN CHANGE ===', { open, previousState: isEditDialogOpen })
            setIsEditDialogOpen(open)
            if (!open) {
              console.log('Dialog closed, clearing editingPackage')
              setEditingPackage(null)
            }
          }}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Package</DialogTitle>
                <DialogDescription>
                  Update the package details below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="edit-name"
                    value={editingPackage?.name || ''}
                    onChange={(e) => {
                      console.log('Name input changed:', e.target.value)
                      setEditingPackage(prev => prev ? {...prev, name: e.target.value} : null)
                    }}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-power" className="text-right">
                    Power (kW)
                  </Label>
                  <Input
                    id="edit-power"
                    type="number"
                    value={editingPackage?.powerRating || ''}
                    onChange={(e) => setEditingPackage(prev => prev ? {...prev, powerRating: Number(e.target.value)} : null)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-suitable" className="text-right">
                    Suitable For
                  </Label>
                  <Input
                    id="edit-suitable"
                    value={editingPackage?.suitableFor || ''}
                    onChange={(e) => setEditingPackage(prev => prev ? {...prev, suitableFor: e.target.value} : null)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-min-price" className="text-right">
                    Min Price
                  </Label>
                  <Input
                    id="edit-min-price"
                    type="number"
                    value={editingPackage?.minPrice || ''}
                    onChange={(e) => setEditingPackage(prev => prev ? {...prev, minPrice: Number(e.target.value)} : null)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-max-price" className="text-right">
                    Max Price
                  </Label>
                  <Input
                    id="edit-max-price"
                    type="number"
                    value={editingPackage?.maxPrice || ''}
                    onChange={(e) => setEditingPackage(prev => prev ? {...prev, maxPrice: Number(e.target.value)} : null)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={editingPackage?.description || ''}
                    onChange={(e) => setEditingPackage(prev => prev ? {...prev, description: e.target.value} : null)}
                    className="col-span-3"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-active" className="text-right">
                    Active
                  </Label>
                  <Switch
                    id="edit-active"
                    checked={editingPackage?.isActive || false}
                    onCheckedChange={(checked) => setEditingPackage(prev => prev ? {...prev, isActive: checked} : null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePackage}>
                  <Save className="h-4 w-4 mr-2" />
                  Update Package
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Package Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Package</DialogTitle>
                <DialogDescription>
                  Add a new solar package to your offerings.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="create-name"
                    value={newPackage.name || ''}
                    onChange={(e) => setNewPackage(prev => ({...prev, name: e.target.value}))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-power" className="text-right">
                    Power (kW)
                  </Label>
                  <Input
                    id="create-power"
                    type="number"
                    value={newPackage.powerRating || ''}
                    onChange={(e) => setNewPackage(prev => ({...prev, powerRating: Number(e.target.value)}))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-suitable" className="text-right">
                    Suitable For
                  </Label>
                  <Input
                    id="create-suitable"
                    value={newPackage.suitableFor || ''}
                    onChange={(e) => setNewPackage(prev => ({...prev, suitableFor: e.target.value}))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-min-price" className="text-right">
                    Min Price
                  </Label>
                  <Input
                    id="create-min-price"
                    type="number"
                    value={newPackage.minPrice || ''}
                    onChange={(e) => setNewPackage(prev => ({...prev, minPrice: Number(e.target.value)}))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-max-price" className="text-right">
                    Max Price
                  </Label>
                  <Input
                    id="create-max-price"
                    type="number"
                    value={newPackage.maxPrice || ''}
                    onChange={(e) => setNewPackage(prev => ({...prev, maxPrice: Number(e.target.value)}))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-description" className="text-right">
                    Description
                  </Label>
                  <Textarea
                    id="create-description"
                    value={newPackage.description || ''}
                    onChange={(e) => setNewPackage(prev => ({...prev, description: e.target.value}))}
                    className="col-span-3"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-active" className="text-right">
                    Active
                  </Label>
                  <Switch
                    id="create-active"
                    checked={newPackage.isActive || false}
                    onCheckedChange={(checked) => setNewPackage(prev => ({...prev, isActive: checked}))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNewPackage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Package
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation Status</CardTitle>
              <CardDescription>System automation health and recent activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="font-medium">Last Check</p>
                  <p className="text-sm text-gray-600">
                    {stats?.lastCheck ? new Date(stats.lastCheck).toLocaleString() : 'Not available'}
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Settings className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium">Automation</p>
                  <p className="text-sm text-gray-600">
                    {stats?.automationEnabled ? 'Enabled and running' : 'Disabled'}
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="font-medium">Queued Commands</p>
                  <p className="text-sm text-gray-600">
                    {stats?.queuedCommands || 0} pending
                  </p>
                </div>
              </div>
              
              {/* Additional automation details */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Service Status Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total Services:</span>
                      <span className="font-medium">{stats?.totalServices || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Services:</span>
                      <span className="font-medium text-green-600">{stats?.activeServices || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Suspended Services:</span>
                      <span className="font-medium text-red-600">{stats?.suspendedServices || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overdue Services:</span>
                      <span className="font-medium text-orange-600">{stats?.overdueServices || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Smart Meter Status</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total Meters:</span>
                      <span className="font-medium">{stats?.totalMeters || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Online Meters:</span>
                      <span className="font-medium text-green-600">{stats?.onlineMeters || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Offline Meters:</span>
                      <span className="font-medium text-gray-600">
                        {(stats?.totalMeters || 0) - (stats?.onlineMeters || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Online Rate:</span>
                      <span className="font-medium">
                        {stats?.totalMeters ? 
                          Math.round((stats.onlineMeters / stats.totalMeters) * 100) : 0
                        }%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Design &amp; Financing Planner
                  </CardTitle>
                  <CardDescription>
                    Run the Afya Solar sizing engine to preview a standard hybrid facility design and monthly savings.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleRunDesignEngine}>
                  Run Engine
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {designQuoteError && (
                <p className="text-xs text-red-600">{designQuoteError}</p>
              )}
              {designQuoteSummary ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">PV System</p>
                      <p className="text-lg font-semibold">
                        {designQuoteSummary.pvKw.toFixed(2)} kW
                      </p>
                      <p className="text-xs text-gray-500">
                        {designQuoteSummary.panels} × 620 W panels
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Battery Bank</p>
                      <p className="text-lg font-semibold">
                        {designQuoteSummary.batteryKwh.toFixed(1)} kWh
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Battery className="h-3 w-3" />
                        LiFePO₄ (example)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Inverter</p>
                      <p className="text-lg font-semibold">
                        {designQuoteSummary.inverterKw.toFixed(1)} kW
                      </p>
                      <p className="text-xs text-gray-500">
                        Approximate continuous rating
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Gross Monthly Savings</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(designQuoteSummary.grossSavings)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Indicative EaaS Fee</p>
                      <p className="text-xl font-bold text-purple-600">
                        {designQuoteSummary.eaasMonthly != null
                          ? formatCurrency(designQuoteSummary.eaasMonthly)
                          : "N/A"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Usage</p>
                      <p className="text-sm text-gray-600">
                        Use this as a reference when configuring real facility offers with client-specific loads.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-600">
                  Run the engine to generate a sample design and savings preview. For a client-specific proposal,
                  use the facility-side sizing tool with real device inventory.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Detailed report dialog */}
          {selectedReport && (
            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
              <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Design &amp; Finance Assessment –{" "}
                    {selectedReport.facilityName || selectedReport.facilityId || "Facility"}
                  </DialogTitle>
                  <DialogDescription>
                    Captured when the facility ran the Design &amp; Finance Engine.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Facility</p>
                      <p className="font-medium">
                        {selectedReport.facilityName || "Unknown facility"}
                      </p>
                      {selectedReport.facilityId && (
                        <p className="text-xs text-gray-500">ID: {selectedReport.facilityId}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Assessment Date</p>
                      <p className="font-medium">
                        {selectedReport.createdAt
                          ? new Date(selectedReport.createdAt).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-md p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">1. Load Analysis</p>
                    <ul className="text-xs text-gray-700 space-y-1">
                      <li>
                        Total daily energy:{" "}
                        <span className="font-semibold">
                          {selectedReport.totalDailyEnergyKwh != null
                            ? `${Number(selectedReport.totalDailyEnergyKwh).toFixed(1)} kWh/day`
                            : "—"}
                        </span>
                      </li>
                      <li>
                        Critical energy:{" "}
                        <span className="font-semibold">
                          {selectedReport.criticalEnergyKwh != null
                            ? `${Number(selectedReport.criticalEnergyKwh).toFixed(1)} kWh/day`
                            : "—"}
                        </span>
                      </li>
                      <li>
                        Adjusted energy (with growth):{" "}
                        <span className="font-semibold">
                          {selectedReport.adjustedDailyEnergyKwh != null
                            ? `${Number(selectedReport.adjustedDailyEnergyKwh).toFixed(1)} kWh/day`
                            : "—"}
                        </span>
                      </li>
                      <li>
                        MEU total daily load:{" "}
                        <span className="font-semibold">
                          {selectedReport.meuTotalDailyLoadKwh != null
                            ? `${Number(selectedReport.meuTotalDailyLoadKwh).toFixed(1)} kWh/day`
                            : "—"}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="border rounded-md p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">2. System Design</p>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                      <div>
                        <p className="text-gray-500">PV size</p>
                        <p className="font-semibold">
                          {selectedReport.pvSizeKw != null
                            ? `${Number(selectedReport.pvSizeKw).toFixed(2)} kW`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Panels (620 W)</p>
                        <p className="font-semibold">
                          {selectedReport.numPanels != null ? selectedReport.numPanels : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Battery energy</p>
                        <p className="font-semibold">
                          {selectedReport.batteryKwh != null
                            ? `${Number(selectedReport.batteryKwh).toFixed(1)} kWh`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Battery capacity</p>
                        <p className="font-semibold">
                          {selectedReport.batteryAh != null
                            ? `${Number(selectedReport.batteryAh).toFixed(0)} Ah`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Inverter</p>
                        <p className="font-semibold">
                          {selectedReport.inverterKw != null
                            ? `${Number(selectedReport.inverterKw).toFixed(1)} kW`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">MPPT current</p>
                        <p className="font-semibold">
                          {selectedReport.mpptCurrentA != null
                            ? `${Number(selectedReport.mpptCurrentA).toFixed(0)} A`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-md p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">3. Costs Before &amp; After Solar</p>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
                      <div>
                        <p className="text-gray-500">Baseline (grid + diesel)</p>
                        <p className="font-semibold">
                          {selectedReport.baselineTotalMonthly != null
                            ? formatCurrency(selectedReport.baselineTotalMonthly)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">After solar (grid + diesel)</p>
                        <p className="font-semibold">
                          {selectedReport.afterTotalMonthly != null
                            ? formatCurrency(selectedReport.afterTotalMonthly)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Baseline grid only</p>
                        <p className="font-semibold">
                          {selectedReport.baselineGridMonthly != null
                            ? formatCurrency(selectedReport.baselineGridMonthly)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Baseline diesel only</p>
                        <p className="font-semibold">
                          {selectedReport.baselineDieselMonthly != null
                            ? formatCurrency(selectedReport.baselineDieselMonthly)
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 text-xs">
                      <p className="text-gray-500">Gross monthly savings</p>
                      <p className="font-semibold text-green-700">
                        {selectedReport.grossMonthlySavings != null
                          ? formatCurrency(selectedReport.grossMonthlySavings)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-md p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">4. Financing Comparison</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Cash</p>
                        <p>
                          Price:{" "}
                          <span className="font-semibold">
                            {selectedReport.cashPriceTzs != null
                              ? formatCurrency(selectedReport.cashPriceTzs)
                              : "—"}
                          </span>
                        </p>
                        <p>
                          Payback:{" "}
                          <span className="font-semibold">
                            {selectedReport.cashPaybackMonths != null
                              ? `${Number(selectedReport.cashPaybackMonths).toFixed(1)} months`
                              : "—"}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Installment</p>
                        <p>
                          Upfront:{" "}
                          <span className="font-semibold">
                            {selectedReport.installmentUpfrontTzs != null
                              ? formatCurrency(selectedReport.installmentUpfrontTzs)
                              : "—"}
                          </span>
                        </p>
                        <p>
                          Term:{" "}
                          <span className="font-semibold">
                            {selectedReport.installmentTermMonths != null
                              ? `${selectedReport.installmentTermMonths} months`
                              : "—"}
                          </span>
                        </p>
                        <p>
                          Monthly:{" "}
                          <span className="font-semibold">
                            {selectedReport.installmentMonthlyTzs != null
                              ? formatCurrency(selectedReport.installmentMonthlyTzs)
                              : "—"}
                          </span>
                        </p>
                        <p>
                          Net savings:{" "}
                          <span className="font-semibold">
                            {selectedReport.installmentNetSavingsTzs != null
                              ? formatCurrency(selectedReport.installmentNetSavingsTzs)
                              : "—"}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">EaaS</p>
                        <p>
                          Monthly fee:{" "}
                          <span className="font-semibold">
                            {selectedReport.eaasMonthlyTzs != null
                              ? formatCurrency(selectedReport.eaasMonthlyTzs)
                              : "—"}
                          </span>
                        </p>
                        <p>
                          Term:{" "}
                          <span className="font-semibold">
                            {selectedReport.eaasTermMonths != null
                              ? `${selectedReport.eaasTermMonths} months`
                              : "—"}
                          </span>
                        </p>
                        <p>
                          Net savings:{" "}
                          <span className="font-semibold">
                            {selectedReport.eaasNetSavingsTzs != null
                              ? formatCurrency(selectedReport.eaasNetSavingsTzs)
                              : "—"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Recent Facility Design Reports</CardTitle>
                  <CardDescription>
                    Assessments saved when facilities run the Design &amp; Finance Engine.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchDesignReports}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {designReportsLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-gray-500">
                  <div className="w-4 h-4 mr-2 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Loading design reports…
                </div>
              ) : !designReports || designReports.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No design reports have been captured yet. Once facilities run the Design &amp; Finance Engine,
                  their assessments will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {designReports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedReport(report)}
                      className="w-full flex items-center justify-between px-3 py-2 border rounded-md hover:bg-emerald-50 text-left transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {report.facilityName || report.facilityId || "Unknown facility"}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {report.createdAt
                            ? new Date(report.createdAt).toLocaleString()
                            : "Date unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-700">
                        <div>
                          <span className="block text-[11px] text-gray-500">PV Size</span>
                          <span className="font-semibold">
                            {report.pvSizeKw != null ? Number(report.pvSizeKw).toFixed(1) : "—"} kW
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-gray-500">Battery</span>
                          <span className="font-semibold">
                            {report.batteryKwh != null ? Number(report.batteryKwh).toFixed(1) : "—"} kWh
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-gray-500">Gross Savings</span>
                          <span className="font-semibold text-green-700">
                            {report.grossMonthlySavings != null
                              ? formatCurrency(report.grossMonthlySavings)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
