'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building2, Phone, Mail, MapPin, Calendar } from 'lucide-react'
import { useFacility } from '@/hooks/use-facilities'
import { useLiveEnergyData } from '@/hooks/use-energy-data'
import { FacilityDashboardContent } from '@/components/dashboard/facility-dashboard-content'
import { formatCurrency } from '@/lib/utils'
import type { NavSection } from '@/lib/dashboard/facility-nav'
import { getFacilityNavItems } from '@/lib/dashboard/facility-nav'

const ADMIN_ALLOWED_SECTIONS = new Set<NavSection>([
  ...(getFacilityNavItems({ adminMode: true }).map((i) => i.id) as NavSection[]),
  'settings',
])

function normalizeAdminSection(section: string | null): NavSection {
  if (!section) return 'overview'
  if (ADMIN_ALLOWED_SECTIONS.has(section as NavSection)) return section as NavSection
  return 'overview'
}

export default function AdminFacilityDashboard() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const facilityId = params.facilityId as string

  const overviewOnly = searchParams.get('view') === 'overview'

  const [activeSection, setActiveSection] = useState<NavSection>(() =>
    normalizeAdminSection(searchParams.get('section'))
  )

  const { data: facility, isLoading: facilityLoading } = useFacility(facilityId)
  const { data: liveData, isLoading: dataLoading } = useLiveEnergyData(facilityId)

  useEffect(() => {
    const section = normalizeAdminSection(searchParams.get('section'))
    setActiveSection(section)
  }, [searchParams])

  const handleSectionChange = (section: NavSection) => {
    const next = normalizeAdminSection(section)
    setActiveSection(next)
    const url = new URL(window.location.href)
    url.searchParams.set('section', next)
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
              onSectionChange={handleSectionChange}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b shadow-sm flex-shrink-0 z-20">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4 min-w-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToSubscribers}
                className="flex items-center flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2 truncate">
                  <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{facility.name}</span>
                </h1>
                <p className="text-sm text-gray-600 truncate">Admin view — same experience as the facility (assessments in AfyaLink)</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge variant={facility.status === 'active' ? 'default' : 'destructive'}>
                {facility.status}
              </Badge>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(Number(facility.creditBalance || 0))}
                </p>
                <p className="text-xs text-gray-600">Credit</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              {facility.city}, {facility.region}
            </div>
            <div className="flex items-center gap-1">
              <Phone className="w-4 h-4 flex-shrink-0" />
              {facility.phone}
            </div>
            {facility.email && (
              <div className="flex items-center gap-1 min-w-0">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{facility.email}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              Registered {new Date(facility.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <FacilityDashboardContent
          facility={facility}
          liveData={liveData}
          adminMode={true}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />
      </div>
    </div>
  )
}
