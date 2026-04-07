'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { 
  Zap, 
  Sun, 
  Battery, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Filter,
  Download,
  Eye,
  MapPin,
  Calendar
} from 'lucide-react'

interface EnergyData {
  id: string
  facilityId: string
  facilityName: string
  timestamp: string
  power: number
  energy: number
  voltage: number
  current: number
  solarGeneration: number
  batteryLevel: number
  gridStatus: string
  creditBalance: number
}

interface FacilityEnergySummary {
  facilityId: string
  facilityName: string
  location: string
  totalConsumption: number
  solarGeneration: number
  gridConsumption: number
  avgBatteryLevel: number
  efficiency: number
  lastUpdate: string
  status: 'online' | 'offline' | 'warning'
}

export default function AfyaSolarEnergyManagement() {
  const [energyData, setEnergyData] = useState<EnergyData[]>([])
  const [facilitySummaries, setFacilitySummaries] = useState<FacilityEnergySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [selectedFacility, setSelectedFacility] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchEnergyData()
    fetchFacilitySummaries()
  }, [timeRange, selectedFacility, statusFilter])

  const fetchEnergyData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        timeRange,
        facility: selectedFacility,
        status: statusFilter
      })
      
      const response = await fetch(`/api/afya-solar/admin/energy?${params}`)
      if (!response.ok) throw new Error('Failed to fetch energy data')
      
      const data = await response.json()
      setEnergyData(data.data || [])
    } catch (error) {
      console.error('Error fetching energy data:', error)
      setEnergyData([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFacilitySummaries = async () => {
    try {
      const response = await fetch('/api/afya-solar/admin/energy/summaries')
      if (!response.ok) throw new Error('Failed to fetch facility summaries')
      
      const data = await response.json()
      setFacilitySummaries(data.data || [])
    } catch (error) {
      console.error('Error fetching facility summaries:', error)
      setFacilitySummaries([])
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800'
      case 'offline': return 'bg-red-100 text-red-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle className="h-4 w-4" />
      case 'offline': return <AlertTriangle className="h-4 w-4" />
      case 'warning': return <Clock className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS'
    }).format(amount)
  }

  const filteredSummaries = facilitySummaries.filter(summary => {
    const matchesSearch = summary.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         summary.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || summary.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalStats = {
    totalFacilities: facilitySummaries.length,
    onlineFacilities: facilitySummaries.filter(f => f.status === 'online').length,
    totalConsumption: facilitySummaries.reduce((sum, f) => sum + f.totalConsumption, 0),
    totalSolarGeneration: facilitySummaries.reduce((sum, f) => sum + f.solarGeneration, 0),
    avgEfficiency: facilitySummaries.length > 0 
      ? facilitySummaries.reduce((sum, f) => sum + f.efficiency, 0) / facilitySummaries.length 
      : 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Energy Management</h2>
          <p className="text-gray-600">Monitor and manage energy consumption across all facilities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEnergyData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facilities</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalFacilities}</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.onlineFacilities} online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalConsumption.toFixed(2)} kWh</div>
            <p className="text-xs text-muted-foreground">
              Last {timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solar Generation</CardTitle>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalStats.totalSolarGeneration.toFixed(2)} kWh</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.totalConsumption > 0 
                ? `${((totalStats.totalSolarGeneration / totalStats.totalConsumption) * 100).toFixed(1)}% of total`
                : '0% of total'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.avgEfficiency.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              System efficiency
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select value={timeRange} onValueChange={(value: '24h' | '7d' | '30d') => setTimeRange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search facilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facility Summaries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Facility Overview</CardTitle>
          <CardDescription>Energy performance across all facilities</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No facility data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSummaries.map((summary) => (
                <div key={summary.facilityId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{summary.facilityName}</h3>
                      <Badge className={getStatusColor(summary.status)}>
                        {getStatusIcon(summary.status)}
                        <span className="ml-1">{summary.status}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="h-4 w-4" />
                      {summary.location}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Consumption</p>
                      <p className="font-semibold">{summary.totalConsumption.toFixed(2)} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Solar Generation</p>
                      <p className="font-semibold text-green-600">{summary.solarGeneration.toFixed(2)} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Battery Level</p>
                      <p className="font-semibold">{summary.avgBatteryLevel.toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Efficiency</p>
                      <p className="font-semibold">{summary.efficiency.toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      Last update: {new Date(summary.lastUpdate).toLocaleString()}
                    </div>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Energy Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Energy Readings</CardTitle>
          <CardDescription>Latest energy consumption data from all facilities</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : energyData.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No energy data available</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {energyData.slice(0, 50).map((data) => (
                <div key={data.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{data.facilityName}</span>
                      {data.solarGeneration && Number(data.solarGeneration) > 0 && (
                        <Badge className="bg-green-100 text-green-800">
                          <Sun className="h-3 w-3 mr-1" />
                          Solar
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{Number(data.power).toFixed(2)} W</span>
                      <span>{Number(data.energy).toFixed(2)} kWh</span>
                      <span>{new Date(data.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.batteryLevel && (
                      <Badge variant={Number(data.batteryLevel) > 50 ? "default" : "secondary"}>
                        <Battery className="h-3 w-3 mr-1" />
                        {Number(data.batteryLevel).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
