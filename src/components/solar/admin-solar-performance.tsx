import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Zap,
  Battery,
  Thermometer,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Target,
  RefreshCw,
  Download,
  Filter,
  Eye,
  Settings
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'

interface EfficiencyScore {
  deviceId: string
  facilityId: string
  facilityName: string
  deviceSerial: string
  period: string
  overallScore: number
  efficiencyScore: number
  reliabilityScore: number
  performanceScore: number
  maintenanceScore: number
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  trend: 'improving' | 'stable' | 'declining'
  recommendations: string[]
  metadata: {
    avgEfficiency: number
    uptime: number
    energyGenerated: number
    alertsCount: number
    benchmarkScore: number
  }
}

interface PerformanceMetrics {
  facilityId: string
  deviceId: string
  facilityName: string
  deviceSerial: string
  period: string
  metrics: {
    energyGenerated: number
    avgPower: number
    peakPower: number
    avgEfficiency: number
    capacityFactor: number
    performanceRatio: number
    reliability: number
    degradationRate: number
  }
  benchmarks: {
    regionalAvg: any
    facilityAvg: any
    industryAvg: {
      avgEfficiency: number
      capacityFactor: number
      performanceRatio: number
    }
  }
  trends: {
    energyTrend: 'increasing' | 'stable' | 'decreasing'
    efficiencyTrend: 'improving' | 'stable' | 'declining'
  }
}

export function AdminSolarPerformance() {
  const [activeTab, setActiveTab] = useState('efficiency')
  const [selectedFacility, setSelectedFacility] = useState('all')
  const [selectedDevice, setSelectedDevice] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('monthly')

  // Fetch efficiency scores
  const { data: efficiencyScores = [], isLoading: efficiencyLoading, refetch: refetchEfficiency } = useQuery({
    queryKey: ['efficiency-scores', selectedFacility, selectedDevice, periodFilter],
    queryFn: async (): Promise<EfficiencyScore[]> => {
      const params = new URLSearchParams({
        ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
        ...(selectedDevice !== 'all' && { deviceId: selectedDevice }),
        period: periodFilter,
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/analytics/efficiency/score?${params}`)
      if (!response.ok) throw new Error('Failed to fetch efficiency scores')
      const data = await response.json()
      return data.data
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Fetch performance metrics
  const { data: performanceMetrics = [], isLoading: performanceLoading, refetch: refetchPerformance } = useQuery({
    queryKey: ['performance-metrics', selectedFacility, selectedDevice, periodFilter],
    queryFn: async (): Promise<PerformanceMetrics[]> => {
      const params = new URLSearchParams({
        ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
        ...(selectedDevice !== 'all' && { deviceId: selectedDevice }),
        period: periodFilter,
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/analytics/performance/metrics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch performance metrics')
      const data = await response.json()
      return data.data
    },
    refetchInterval: 60000,
  })

  const filteredEfficiencyScores = efficiencyScores.filter(score => {
    const matchesFacility = selectedFacility === 'all' || score.facilityId === selectedFacility
    const matchesDevice = selectedDevice === 'all' || score.deviceId === selectedDevice
    return matchesFacility && matchesDevice
  })

  const filteredPerformanceMetrics = performanceMetrics.filter(metric => {
    const matchesFacility = selectedFacility === 'all' || metric.facilityId === selectedFacility
    const matchesDevice = selectedDevice === 'all' || metric.deviceId === selectedDevice
    return matchesFacility && matchesDevice
  })

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-green-600 text-white'
      case 'A': return 'bg-green-500 text-white'
      case 'B+': return 'bg-blue-500 text-white'
      case 'B': return 'bg-blue-400 text-white'
      case 'C+': return 'bg-yellow-500 text-white'
      case 'C': return 'bg-yellow-400 text-white'
      case 'D': return 'bg-orange-500 text-white'
      case 'F': return 'bg-red-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const efficiencyStats = {
    avgScore: efficiencyScores.length > 0 ? efficiencyScores.reduce((sum, s) => sum + s.overallScore, 0) / efficiencyScores.length : 0,
    topPerformers: efficiencyScores.filter(s => s.grade === 'A+' || s.grade === 'A').length,
    needsAttention: efficiencyScores.filter(s => s.grade === 'D' || s.grade === 'F').length,
    improving: efficiencyScores.filter(s => s.trend === 'improving').length
  }

  const performanceStats = {
    avgEfficiency: performanceMetrics.length > 0 ? performanceMetrics.reduce((sum, m) => sum + m.metrics.avgEfficiency, 0) / performanceMetrics.length : 0,
    avgCapacityFactor: performanceMetrics.length > 0 ? performanceMetrics.reduce((sum, m) => sum + m.metrics.capacityFactor, 0) / performanceMetrics.length : 0,
    totalEnergy: performanceMetrics.reduce((sum, m) => sum + m.metrics.energyGenerated, 0),
    avgReliability: performanceMetrics.length > 0 ? performanceMetrics.reduce((sum, m) => sum + m.metrics.reliability, 0) / performanceMetrics.length : 0
  }

  if (efficiencyLoading || performanceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading analytics data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Solar Performance Metrics</h2>
          <p className="text-muted-foreground">
            Detailed performance metrics and KPI tracking for solar systems
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => { refetchEfficiency(); refetchPerformance(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedFacility} onValueChange={setSelectedFacility}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                <SelectItem value="fac-1">Kigali Central Hospital</SelectItem>
                <SelectItem value="fac-2">Muhanga Health Center</SelectItem>
                <SelectItem value="fac-3">Rubavu Dispensary</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="efficiency">Efficiency Scoring</TabsTrigger>
          <TabsTrigger value="performance">Performance Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="efficiency" className="space-y-6">
          {/* Efficiency Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(efficiencyStats.avgScore)}`}>
                      {efficiencyStats.avgScore.toFixed(1)}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Top Performers</p>
                    <p className="text-2xl font-bold text-green-600">{efficiencyStats.topPerformers}</p>
                  </div>
                  <Award className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Needs Attention</p>
                    <p className="text-2xl font-bold text-red-600">{efficiencyStats.needsAttention}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Improving</p>
                    <p className="text-2xl font-bold text-blue-600">{efficiencyStats.improving}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Efficiency Scores List */}
          <Card>
            <CardHeader>
              <CardTitle>Efficiency Scores ({filteredEfficiencyScores.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredEfficiencyScores.map((score) => (
                  <div key={score.deviceId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(score.grade)}`}>
                            {score.grade}
                          </div>
                          {getTrendIcon(score.trend)}
                          <div className="flex-1">
                            <h3 className="font-semibold">{score.facilityName}</h3>
                            <p className="text-sm text-muted-foreground">
                              Device: {score.deviceSerial} • Period: {score.period}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${getScoreColor(score.overallScore)}`}>
                              {score.overallScore}
                            </p>
                            <p className="text-xs text-muted-foreground">Overall Score</p>
                          </div>
                        </div>

                        {/* Component Scores */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Efficiency</span>
                              <span className="text-xs font-medium">{score.efficiencyScore}%</span>
                            </div>
                            <Progress value={score.efficiencyScore} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Reliability</span>
                              <span className="text-xs font-medium">{score.reliabilityScore}%</span>
                            </div>
                            <Progress value={score.reliabilityScore} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Performance</span>
                              <span className="text-xs font-medium">{score.performanceScore}%</span>
                            </div>
                            <Progress value={score.performanceScore} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Maintenance</span>
                              <span className="text-xs font-medium">{score.maintenanceScore}%</span>
                            </div>
                            <Progress value={score.maintenanceScore} className="h-2" />
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground mb-3">
                          <div>
                            <span>Avg Efficiency: {score.metadata.avgEfficiency}%</span>
                          </div>
                          <div>
                            <span>Uptime: {score.metadata.uptime}%</span>
                          </div>
                          <div>
                            <span>Energy: {score.metadata.energyGenerated} kWh</span>
                          </div>
                          <div>
                            <span>Benchmark: {score.metadata.benchmarkScore}%</span>
                          </div>
                        </div>

                        {/* Recommendations */}
                        {score.recommendations.length > 0 && (
                          <div className="bg-blue-50 p-3 rounded text-sm">
                            <p className="font-medium text-blue-800 mb-1">Recommendations:</p>
                            <ul className="text-blue-700 space-y-1">
                              {score.recommendations.slice(0, 2).map((rec, index) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span className="text-blue-500 mt-0.5">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4 mr-1" />
                              Configure
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredEfficiencyScores.length === 0 && (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No efficiency scores found</h3>
                  <p className="text-gray-500">Calculate efficiency scores to see performance analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Efficiency</p>
                    <p className={`text-2xl font-bold ${getScoreColor(performanceStats.avgEfficiency)}`}>
                      {performanceStats.avgEfficiency.toFixed(1)}%
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
                    <p className="text-sm font-medium text-muted-foreground">Capacity Factor</p>
                    <p className="text-2xl font-bold">{performanceStats.avgCapacityFactor.toFixed(1)}%</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Energy</p>
                    <p className="text-2xl font-bold">{(performanceStats.totalEnergy / 1000).toFixed(1)} MWh</p>
                  </div>
                  <Battery className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reliability</p>
                    <p className="text-2xl font-bold">{performanceStats.avgReliability.toFixed(1)}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics List */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics ({filteredPerformanceMetrics.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredPerformanceMetrics.map((metric) => (
                  <div key={metric.deviceId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex items-center space-x-2">
                            {getTrendIcon(metric.trends.efficiencyTrend)}
                            {getTrendIcon(metric.trends.energyTrend)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{metric.facilityName}</h3>
                            <p className="text-sm text-muted-foreground">
                              Device: {metric.deviceSerial} • Period: {metric.period}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${getScoreColor(metric.metrics.avgEfficiency)}`}>
                              {metric.metrics.avgEfficiency.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Avg Efficiency</p>
                          </div>
                        </div>

                        {/* Performance Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Energy Generated</p>
                            <p className="text-sm font-medium">{metric.metrics.energyGenerated} kWh</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Capacity Factor</p>
                            <p className="text-sm font-medium">{metric.metrics.capacityFactor}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Performance Ratio</p>
                            <p className="text-sm font-medium">{metric.metrics.performanceRatio}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Reliability</p>
                            <p className="text-sm font-medium">{metric.metrics.reliability}%</p>
                          </div>
                        </div>

                        {/* Benchmark Comparison */}
                        <div className="grid grid-cols-3 gap-4 mb-3 text-xs">
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-muted-foreground">Industry Avg</p>
                            <p className="font-medium">{metric.benchmarks.industryAvg.avgEfficiency}%</p>
                          </div>
                          <div className="text-center p-2 bg-blue-50 rounded">
                            <p className="text-muted-foreground">Facility Avg</p>
                            <p className="font-medium">{metric.benchmarks.facilityAvg.avgEfficiency}%</p>
                          </div>
                          <div className="text-center p-2 bg-green-50 rounded">
                            <p className="text-muted-foreground">Regional Avg</p>
                            <p className="font-medium">{metric.benchmarks.regionalAvg.avgEfficiency}%</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            <Button variant="outline" size="sm">
                              <BarChart3 className="h-4 w-4 mr-1" />
                              Analytics
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredPerformanceMetrics.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No performance metrics found</h3>
                  <p className="text-gray-500">Generate performance metrics to see detailed analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminSolarPerformance
