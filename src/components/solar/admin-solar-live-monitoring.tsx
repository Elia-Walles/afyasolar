import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  MoreVertical,
  Zap,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Battery,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useAfyaSolarSubscribers } from '@/hooks/use-afya-solar-subscribers'
import { useFacility } from '@/hooks/use-facilities'
import { useLiveEnergyData } from '@/hooks/use-energy-data'
import { FacilityDashboardContent } from '@/components/dashboard/facility-dashboard-content'
import { formatCurrency } from '@/lib/utils'
import RealTimeHealthMonitoring from './real-time-health-monitoring'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Device {
  id: string
  serialNumber: string
  type: string
  facilityId: string
  facilityName: string
  status: 'online' | 'offline' | 'maintenance' | 'error'
  lastSeen: string
  efficiency: number
  batteryLevel: number
  temperature: number
  powerOutput: number
  location: string
  installDate: string
  firmwareVersion: string
  alerts: number
}

export function AdminSolarLiveMonitoring() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)

  // Real device data from database
  const { data: devices = [], isLoading: devicesLoading, refetch } = useQuery({
    queryKey: ['admin-solar-devices'],
    queryFn: async (): Promise<Device[]> => {
      const response = await fetch('/api/admin/solar/devices')
      if (!response.ok) {
        throw new Error('Failed to fetch devices')
      }
      const result = await response.json()
      return result.data || []
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Afya Solar subscriber facilities (for facility-level live monitoring access)
  const { data: subscribers = [], isLoading: subscribersLoading } = useAfyaSolarSubscribers()

  const facilitiesWithCompletedPayment = useMemo(
    () =>
      subscribers.filter((subscriber) =>
        subscriber.paymentStatus === 'completed' ||
        (subscriber.subscriptionStatus === 'active' && subscriber.paymentStatus === 'completed')
      ),
    [subscribers]
  )

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         device.facilityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         device.type.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'offline': return 'bg-red-500'
      case 'maintenance': return 'bg-yellow-500'
      case 'error': return 'bg-red-600'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="w-4 h-4" />
      case 'offline': return <WifiOff className="w-4 h-4" />
      case 'maintenance': return <Clock className="w-4 h-4" />
      case 'error': return <AlertTriangle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'text-green-600'
    if (efficiency >= 75) return 'text-yellow-600'
    if (efficiency > 0) return 'text-red-600'
    return 'text-gray-400'
  }

  const getBatteryColor = (level: number) => {
    if (level >= 75) return 'text-green-600'
    if (level >= 50) return 'text-yellow-600'
    if (level >= 25) return 'text-orange-600'
    return 'text-red-600'
  }

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    maintenance: devices.filter(d => d.status === 'maintenance').length,
    avgEfficiency: devices.length > 0 ? devices.reduce((sum, d) => sum + d.efficiency, 0) / devices.length : 0,
    totalPower: devices.reduce((sum, d) => sum + d.powerOutput, 0),
    activeAlerts: devices.reduce((sum, d) => sum + d.alerts, 0)
  }

  const facilitiesLoading = subscribersLoading && facilitiesWithCompletedPayment.length === 0

  // Data for the currently selected facility overview (used when admin wants to inspect metrics)
  const { data: selectedFacility, isLoading: selectedFacilityLoading } = useFacility(
    selectedFacilityId || undefined
  )
  const { data: selectedLiveData, isLoading: selectedLiveLoading } = useLiveEnergyData(
    selectedFacilityId || undefined
  )

  if (devicesLoading && facilitiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading live monitoring data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Solar Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of all solar devices across facilities
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Facilities view: Afya Solar subscribers with completed payment */}
      <Tabs defaultValue="facilities" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
        </TabsList>

        <TabsContent value="facilities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Afya Solar Facilities (Completed Payment)</CardTitle>
            </CardHeader>
            <CardContent>
              {facilitiesLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading facilities…
                </div>
              ) : facilitiesWithCompletedPayment.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No eligible facilities found</h3>
                  <p className="text-gray-500 text-sm">
                    No facilities with completed Afya Solar payments are currently available for live monitoring.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {facilitiesWithCompletedPayment.map((facility) => (
                      <div
                        key={facility.id}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg transition-colors gap-3 ${
                          selectedFacilityId === facility.id
                            ? 'border-blue-500 bg-blue-50/40'
                            : 'border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{facility.name}</h3>
                            <Badge variant="outline" className="text-[10px]">
                              {facility.packageName || 'Afya Solar'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {facility.city}, {facility.region}
                            </span>
                            {typeof facility.creditBalance === 'number' && (
                              <span>
                                Credit balance:{' '}
                                <span className="font-medium">
                                  {formatCurrency(facility.creditBalance)}
                                </span>
                              </span>
                            )}
                            {facility.smartmeterSerial && (
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Meter: {facility.smartmeterSerial}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800 text-[11px]">
                            Payment: completed
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setSelectedFacilityId(facility.id)
                              setOverviewOpen(true)
                            }}
                          >
                            <LayoutDashboard className="h-3 w-3 mr-1" />
                            View Overview
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Dialog open={overviewOpen && !!selectedFacilityId} onOpenChange={setOverviewOpen}>
                    <DialogContent className="max-w-6xl p-0 overflow-hidden border border-blue-100 shadow-2xl">
                      <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50">
                        <DialogTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-600/10 flex items-center justify-center">
                              <LayoutDashboard className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900">
                                Facility Energy Overview
                              </span>
                              {selectedFacility && (
                                <span className="text-xs text-gray-500">
                                  {selectedFacility.name} · {selectedFacility.city}, {selectedFacility.region}
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedFacility && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {selectedFacility.systemSize && (
                                <Badge variant="outline" className="bg-white/70 border-blue-200 text-blue-800">
                                  System {selectedFacility.systemSize}
                                </Badge>
                              )}
                              {typeof selectedFacility.monthlyConsumption === 'number' && (
                                <Badge variant="outline" className="bg-white/70 border-emerald-200 text-emerald-800">
                                  Monthly load: {selectedFacility.monthlyConsumption} kWh
                                </Badge>
                              )}
                            </div>
                          )}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="max-h-[80vh] overflow-y-auto bg-slate-50/60">
                        {(!selectedFacilityId || selectedFacilityLoading || selectedLiveLoading || !selectedFacility) ? (
                          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Loading facility overview…
                          </div>
                        ) : (
                          <div className="px-4 sm:px-6 pb-6 pt-4">
                            <FacilityDashboardContent
                              facility={selectedFacility as any}
                              liveData={selectedLiveData as any}
                              adminMode={true}
                              activeSection="overview"
                              onSectionChange={() => {}}
                            />
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Zap className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Online</p>
                    <p className="text-2xl font-bold text-green-600">{stats.online}</p>
                  </div>
                  <Wifi className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Efficiency</p>
                    <p className="text-2xl font-bold">{stats.avgEfficiency.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Power</p>
                    <p className="text-2xl font-bold">{(stats.totalPower / 1000).toFixed(1)} kW</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Device Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by serial number, facility, or type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Devices List */}
          <Card>
            <CardHeader>
              <CardTitle>Devices ({filteredDevices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredDevices.map((device) => (
                  <div key={device.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
                          {getStatusIcon(device.status)}
                          <div>
                            <h3 className="font-semibold">{device.serialNumber}</h3>
                            <p className="text-sm text-muted-foreground">{device.type}</p>
                          </div>
                          <Badge variant={device.alerts > 0 ? "destructive" : "secondary"}>
                            {device.alerts} alerts
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Facility</p>
                            <p className="text-sm font-medium">{device.facilityName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Efficiency</p>
                            <p className={`text-sm font-medium ${getEfficiencyColor(device.efficiency)}`}>
                              {device.efficiency.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Battery</p>
                            <p className={`text-sm font-medium flex items-center gap-1 ${getBatteryColor(device.batteryLevel)}`}>
                              <Battery className="h-3 w-3" />
                              {device.batteryLevel}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Power Output</p>
                            <p className="text-sm font-medium">{(device.powerOutput / 1000).toFixed(1)} kW</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {device.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Thermometer className="h-3 w-3" />
                              {device.temperature}°C
                            </span>
                            <span>Last seen: {formatLastSeen(device.lastSeen)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredDevices.length === 0 && (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No devices found</h3>
                  <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="health">
          <RealTimeHealthMonitoring />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminSolarLiveMonitoring
