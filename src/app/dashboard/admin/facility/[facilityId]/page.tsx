'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  LayoutDashboard,
  Plug,
  Zap,
  Monitor,
  DollarSign,
  FileText,
  Bell,
  BarChart3,
  Settings,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Activity,
  CloudSun,
} from 'lucide-react'
import { useFacility } from '@/hooks/use-facilities'
import { useLiveEnergyData } from '@/hooks/use-energy-data'
import { FacilityDashboardContent } from '@/components/dashboard/facility-dashboard-content'
import { FacilityIntelligenceAdminReview } from '@/components/admin/facility-intelligence-admin-review'
import { formatCurrency } from '@/lib/utils'

type NavSection = 'overview' | 'devices' | 'energy' | 'energy-efficiency' | 'climate-resilience' | 'bills-payment' | 'notifications' | 'report' | 'carbon-credits' | 'subscription' | 'settings'

const navItems: { id: NavSection; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: Plug },
  { id: 'energy', label: 'Energy', icon: Zap },
  { id: 'energy-efficiency', label: 'Energy Efficiency', icon: DollarSign },
  { id: 'climate-resilience', label: 'Climate Resilience', icon: CloudSun },
  { id: 'bills-payment', label: 'Bills & Payment', icon: DollarSign },
  { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
  { id: 'report', label: 'Report', icon: BarChart3 },
  { id: 'carbon-credits', label: 'Carbon Credits', icon: Activity },
  { id: 'subscription', label: 'Subscription', icon: Users },
]

export default function AdminFacilityDashboard() {
  const router = useRouter()
  const params = useParams()
  const facilityId = params.facilityId as string
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const initialSection = (searchParams.get('section') as NavSection) || 'overview'
  const overviewOnly = searchParams.get('view') === 'overview'
  const [activeSection, setActiveSection] = useState<NavSection>(initialSection)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: facility, isLoading: facilityLoading } = useFacility(facilityId)
  const { data: liveData, isLoading: dataLoading } = useLiveEnergyData(facilityId)

  useEffect(() => {
    const section = searchParams.get('section') as NavSection
    if (section && ['overview', 'devices', 'energy', 'energy-efficiency', 'climate-resilience', 'bills-payment', 'contract-details', 'notifications', 'report', 'carbon-credits', 'subscription', 'settings'].includes(section)) {
      setActiveSection(section as NavSection)
    }
  }, [searchParams])

  const handleSectionChange = (section: NavSection) => {
    setActiveSection(section)
    const url = new URL(window.location.href)
    url.searchParams.set('section', section)
    window.history.pushState({}, '', url.toString())
  }

  const handleBackToSubscribers = () => {
    router.push('/dashboard/admin#afya-solar-subscribers')
  }

  if (facilityLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading facility dashboard...</p>
        </div>
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Facility not found</p>
          <Button onClick={handleBackToSubscribers} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Subscribers
          </Button>
        </div>
      </div>
    )
  }

  // Compact "overview-only" view: show just the facility overview dashboard with metrics,
  // without the admin shell navigation or section switching.
  if (overviewOnly) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <FacilityDashboardContent
              facility={facility}
              liveData={liveData}
              adminMode={true}
              activeSection="overview"
              onSectionChange={() => {}}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToSubscribers}
                className="flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Subscribers
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  {facility.name} - Admin View
                </h1>
                <p className="text-sm text-gray-600">
                  Controlling facility dashboard as administrator
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={facility.status === 'active' ? 'default' : 'destructive'}>
                {facility.status}
              </Badge>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(Number(facility.creditBalance || 0))}
                </p>
                <p className="text-xs text-gray-600">Credit Balance</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Facility Info Bar */}
      <div className="bg-white border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {facility.city}, {facility.region}
              </div>
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {facility.phone}
              </div>
              {facility.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {facility.email}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Registered {new Date(facility.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-red-600">Admin Control Mode</span>
              <Badge variant="outline">Full Access</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r min-h-screen">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <FacilityIntelligenceAdminReview facilityId={facilityId} />
            <FacilityDashboardContent 
              facility={facility} 
              liveData={liveData} 
              adminMode={true}
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
