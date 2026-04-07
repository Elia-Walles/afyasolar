import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Calendar,
  Zap,
  Battery,
  Thermometer,
  MapPin,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sun,
  Wind,
  Droplets
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, subMonths } from 'date-fns'

interface AnalyticsData {
  period: string
  totalEnergy: number
  avgEfficiency: number
  peakPower: number
  co2Saved: number
  costSavings: number
  uptime: number
  devicesOnline: number
  alertsCount: number
}

interface FacilityPerformance {
  id: string
  name: string
  location: string
  energyGenerated: number
  efficiency: number
  uptime: number
  alerts: number
  lastMaintenance: string
}

interface TopPerformer {
  id: string
  name: string
  metric: string
  value: number
  change: number
  trend: 'up' | 'down'
}

export function AdminSolarAnalytics() {
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedMetric, setSelectedMetric] = useState('energy')
  const [searchQuery, setSearchQuery] = useState('')

  // Real analytics data from database
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['solar-analytics', timeRange],
    queryFn: async (): Promise<AnalyticsData> => {
      const response = await fetch(`/api/admin/solar/analytics?period=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      const result = await response.json()
      return result.data
    },
  })

  // Real facility performance data from database
  const { data: facilityPerformance = [] } = useQuery({
    queryKey: ['facility-performance', timeRange],
    queryFn: async (): Promise<FacilityPerformance[]> => {
      const response = await fetch(`/api/admin/solar/facility-performance?period=${timeRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch facility performance')
      }
      const result = await response.json()
      return result.data || []
    },
  })

  // Real top performers data from database
  const { data: topPerformers = [] } = useQuery({
    queryKey: ['top-performers', selectedMetric],
    queryFn: async (): Promise<TopPerformer[]> => {
      const response = await fetch(`/api/admin/solar/top-performers?metric=${selectedMetric}`)
      if (!response.ok) {
        throw new Error('Failed to fetch top performers')
      }
      const result = await response.json()
      return result.data || []
    },
  })

  const filteredFacilities = facilityPerformance.filter(facility =>
    facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    facility.location.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'energy': return 'Energy Generated'
      case 'efficiency': return 'Efficiency'
      case 'uptime': return 'Uptime'
      case 'savings': return 'Cost Savings'
      default: return 'Performance'
    }
  }

  const formatNumber = (num: number, decimals = 1) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading analytics...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Solar Analytics & Insights</h2>
          <p className="text-muted-foreground">
            Comprehensive analytics and performance insights for solar systems
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Energy</p>
                <p className="text-2xl font-bold">{formatNumber(analyticsData?.totalEnergy || 0)} kWh</p>
                <p className="text-xs text-muted-foreground">
                  {timeRange === '7d' ? 'Past 7 days' : timeRange === '30d' ? 'Past 30 days' : 'Past 90 days'}
                </p>
              </div>
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Efficiency</p>
                <p className="text-2xl font-bold">{analyticsData?.avgEfficiency.toFixed(1)}%</p>
                <p className="text-xs text-green-600 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +2.3% vs last period
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CO₂ Saved</p>
                <p className="text-2xl font-bold">{formatNumber(analyticsData?.co2Saved || 0)} kg</p>
                <p className="text-xs text-muted-foreground">Environmental impact</p>
              </div>
              <Droplets className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cost Savings</p>
                <p className="text-2xl font-bold">${formatNumber(analyticsData?.costSavings || 0)}</p>
                <p className="text-xs text-muted-foreground">Estimated savings</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Performance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">System Uptime</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${analyticsData?.uptime || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{analyticsData?.uptime.toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Peak Power Output</span>
                <span className="text-sm font-medium">{analyticsData?.peakPower} kW</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Devices</span>
                <span className="text-sm font-medium">{analyticsData?.devicesOnline || 0} / {(analyticsData?.devicesOnline || 0) + 8}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Alerts</span>
                <Badge variant={analyticsData?.alertsCount && analyticsData.alertsCount > 0 ? "destructive" : "secondary"}>
                  {analyticsData?.alertsCount || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <div key={performer.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{performer.name}</p>
                      <p className="text-xs text-muted-foreground">{performer.metric}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{performer.value.toFixed(1)}</p>
                    <p className={`text-xs flex items-center gap-1 ${
                      performer.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {performer.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(performer.change)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facility Performance Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Facility Performance</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search facilities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="energy">Energy Generated</SelectItem>
                  <SelectItem value="efficiency">Efficiency</SelectItem>
                  <SelectItem value="uptime">Uptime</SelectItem>
                  <SelectItem value="savings">Cost Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Facility</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Energy (kWh)</th>
                  <th className="text-left p-2">Efficiency</th>
                  <th className="text-left p-2">Uptime</th>
                  <th className="text-left p-2">Alerts</th>
                  <th className="text-left p-2">Last Maintenance</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map((facility) => (
                  <tr key={facility.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{facility.name}</td>
                    <td className="p-2 text-sm text-muted-foreground">{facility.location}</td>
                    <td className="p-2">{facility.energyGenerated}</td>
                    <td className="p-2">
                      <span className={facility.efficiency >= 90 ? 'text-green-600' : facility.efficiency >= 75 ? 'text-yellow-600' : 'text-red-600'}>
                        {facility.efficiency.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2">{facility.uptime.toFixed(1)}%</td>
                    <td className="p-2 text-sm">
                      {(() => {
                        if (!facility.lastMaintenance) return 'Never'
                        try {
                          const date = new Date(facility.lastMaintenance)
                          // Check if date is valid
                          if (isNaN(date.getTime())) return 'Never'
                          return format(date, 'MMM dd, yyyy')
                        } catch {
                          return 'Never'
                        }
                      })()}
                    </td>
                    <td className="p-2">
                      <Badge variant={facility.alerts === 0 ? "default" : "destructive"}>
                        {facility.alerts === 0 ? 'Healthy' : 'Needs Attention'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredFacilities.length === 0 && (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No facilities found</h3>
              <p className="text-gray-500">Try adjusting your search criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminSolarAnalytics
