'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  DollarSign,
  Zap,
  Target,
  Calendar,
  Download,
  RefreshCw,
  Activity,
  PieChart,
  LineChart,
  MapPin,
  Clock,
  Award,
  AlertTriangle
} from 'lucide-react'

interface AnalyticsData {
  overview: {
    totalRevenue: number
    totalCustomers: number
    totalEnergyGenerated: number
    systemUptime: number
    customerSatisfaction: number
    marketPenetration: number
  }
  trends: {
    revenue: Array<{ period: string; value: number; change: number }>
    customers: Array<{ period: string; value: number; change: number }>
    energy: Array<{ period: string; value: number; change: number }>
    satisfaction: Array<{ period: string; value: number; change: number }>
  }
  geographic: Array<{
    region: string
    customers: number
    revenue: number
    energyGenerated: number
    percentage: number
  }>
  performance: {
    topFacilities: Array<{
      name: string
      energyGenerated: number
      efficiency: number
      uptime: number
    }>
    packagePerformance: Array<{
      name: string
      sales: number
      revenue: number
      satisfaction: number
    }>
    systemHealth: {
      overall: number
      meters: {
        online: number
        total: number
        uptime: number
      }
      services: {
        active: number
        total: number
        uptime: number
      }
    }
  }
  predictions: {
    nextMonthRevenue: number
    nextQuarterCustomers: number
    yearlyEnergyGrowth: number
    maintenanceAlerts: number
  }
}

export default function AfyaSolarAdvancedAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('30d')
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'customers' | 'energy' | 'satisfaction'>('revenue')

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeRange])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ timeRange })
      
      const response = await fetch(`/api/afya-solar/admin/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics data')
      
      const data = await response.json()
      setAnalyticsData(data.data)
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS'
    }).format(amount)
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Activity className="h-4 w-4 text-gray-600" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600'
    if (change < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  if (loading && !analyticsData) {
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
          <h2 className="text-2xl font-bold text-gray-900">Advanced Analytics</h2>
          <p className="text-gray-600">Comprehensive business intelligence and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: '30d' | '90d' | '1y' | 'all') => setTimeRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAnalyticsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {analyticsData && (
        <>
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analyticsData.overview.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {timeRange === '30d' ? 'Last 30 days' : 
                   timeRange === '90d' ? 'Last 90 days' : 
                   timeRange === '1y' ? 'Last year' : 'All time'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.overview.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  Active facilities
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Energy Generated</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analyticsData.overview.totalEnergyGenerated.toFixed(0)} MWh</div>
                <p className="text-xs text-muted-foreground">
                  Total solar generation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{analyticsData.overview.systemUptime.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Overall system reliability
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{analyticsData.overview.customerSatisfaction.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Average satisfaction score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Market Penetration</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{analyticsData.overview.marketPenetration.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Market share
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trends Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Trends</CardTitle>
                <CardDescription>Key metrics over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Revenue</p>
                        <p className="text-sm text-gray-500">{formatCurrency(analyticsData.trends.revenue[0]?.value || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(analyticsData.trends.revenue[0]?.change || 0)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.trends.revenue[0]?.change || 0)}`}>
                        {analyticsData.trends.revenue[0]?.change > 0 ? '+' : ''}{analyticsData.trends.revenue[0]?.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Customers</p>
                        <p className="text-sm text-gray-500">{analyticsData.trends.customers[0]?.value || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(analyticsData.trends.customers[0]?.change || 0)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.trends.customers[0]?.change || 0)}`}>
                        {analyticsData.trends.customers[0]?.change > 0 ? '+' : ''}{analyticsData.trends.customers[0]?.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-medium">Energy Generated</p>
                        <p className="text-sm text-gray-500">{(analyticsData.trends.energy[0]?.value || 0).toFixed(0)} MWh</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(analyticsData.trends.energy[0]?.change || 0)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.trends.energy[0]?.change || 0)}`}>
                        {analyticsData.trends.energy[0]?.change > 0 ? '+' : ''}{analyticsData.trends.energy[0]?.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Satisfaction</p>
                        <p className="text-sm text-gray-500">{(analyticsData.trends.satisfaction[0]?.value || 0).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(analyticsData.trends.satisfaction[0]?.change || 0)}
                      <span className={`text-sm font-medium ${getTrendColor(analyticsData.trends.satisfaction[0]?.change || 0)}`}>
                        {analyticsData.trends.satisfaction[0]?.change > 0 ? '+' : ''}{analyticsData.trends.satisfaction[0]?.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Predictions & Alerts</CardTitle>
                <CardDescription>AI-powered insights and forecasts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Next Month Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(analyticsData.predictions.nextMonthRevenue)}</p>
                    <p className="text-sm text-blue-700">Predicted based on current trends</p>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">Quarterly Customer Growth</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">+{analyticsData.predictions.nextQuarterCustomers}</p>
                    <p className="text-sm text-green-700">Expected new customers</p>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-yellow-900">Maintenance Alerts</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900">{analyticsData.predictions.maintenanceAlerts}</p>
                    <p className="text-sm text-yellow-700">Systems requiring attention</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Geographic Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Geographic Distribution</CardTitle>
              <CardDescription>Performance by region</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.geographic.map((region, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{region.region}</p>
                        <p className="text-sm text-gray-500">{region.customers} facilities</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(region.revenue)}</p>
                      <p className="text-sm text-gray-500">{region.energyGenerated.toFixed(0)} MWh</p>
                      <Badge variant="outline" className="mt-1">{region.percentage.toFixed(1)}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Performing Facilities</CardTitle>
                <CardDescription>Best energy generation and efficiency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.performance.topFacilities.map((facility, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{facility.name}</p>
                        <p className="text-sm text-gray-500">{facility.energyGenerated.toFixed(0)} MWh</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-100 text-green-800 mb-1">
                          {facility.efficiency.toFixed(1)}% efficient
                        </Badge>
                        <p className="text-sm text-gray-500">{facility.uptime.toFixed(1)}% uptime</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Package Performance</CardTitle>
                <CardDescription>Most popular and profitable packages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.performance.packagePerformance.map((pkg, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{pkg.name}</p>
                        <p className="text-sm text-gray-500">{pkg.sales} sales</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(pkg.revenue)}</p>
                        <Badge variant="outline" className="mt-1">
                          {pkg.satisfaction.toFixed(1)}% satisfaction
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Health Dashboard</CardTitle>
              <CardDescription>Overall system performance and reliability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {analyticsData.performance.systemHealth.overall.toFixed(1)}%
                  </div>
                  <p className="text-sm font-medium text-green-900">Overall Health</p>
                  <p className="text-xs text-green-700 mt-1">All systems operational</p>
                </div>

                <div className="text-center p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {analyticsData.performance.systemHealth.meters.online}/{analyticsData.performance.systemHealth.meters.total}
                  </div>
                  <p className="text-sm font-medium text-blue-900">Smart Meters</p>
                  <p className="text-xs text-blue-700 mt-1">{analyticsData.performance.systemHealth.meters.uptime.toFixed(1)}% uptime</p>
                </div>

                <div className="text-center p-6 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {analyticsData.performance.systemHealth.services.active}/{analyticsData.performance.systemHealth.services.total}
                  </div>
                  <p className="text-sm font-medium text-purple-900">Active Services</p>
                  <p className="text-xs text-purple-700 mt-1">{analyticsData.performance.systemHealth.services.uptime.toFixed(1)}% uptime</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
