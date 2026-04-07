import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  Battery, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sun,
  Thermometer,
  AlertCircle,
  Settings,
  BarChart3
} from 'lucide-react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import LiveDeviceCard from './live-device-card'
import { DeviceWithHealth, FacilityHealthSummary } from '@/types/solar'

interface LiveDashboardProps {
  facilityId: string
  isAdmin?: boolean
}

export function LiveDashboard({ facilityId, isAdmin = false }: LiveDashboardProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch facility health summary
  const { data: healthSummary, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['facility-health', facilityId],
    queryFn: async () => {
      const response = await fetch(`/api/facilities/${facilityId}/devices/health`)
      if (!response.ok) throw new Error('Failed to fetch health summary')
      return response.json()
    },
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
  })

  // Fetch real-time telemetry data
  const { data: telemetryData, isLoading: telemetryLoading, refetch: refetchTelemetry } = useQuery({
    queryKey: ['telemetry', facilityId],
    queryFn: async () => {
      const response = await fetch(`/api/devices/telemetry?facilityId=${facilityId}&limit=50`)
      if (!response.ok) throw new Error('Failed to fetch telemetry data')
      return response.json()
    },
    refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds
  })

  // Fetch recent alerts
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts', facilityId],
    queryFn: async () => {
      const response = await fetch(`/api/devices/telemetry?facilityId=${facilityId}&limit=20`)
      if (!response.ok) throw new Error('Failed to fetch alerts')
      return response.json()
    },
    refetchInterval: autoRefresh ? 15000 : false, // Refresh every 15 seconds
  })

  const handleRefreshAll = () => {
    refetchHealth()
    refetchTelemetry()
    refetchAlerts()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      case 'critical': return 'text-red-600 bg-red-50'
      case 'minor_issues': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />
      case 'warning': return <AlertTriangle className="h-5 w-5" />
      case 'critical': return <XCircle className="h-5 w-5" />
      case 'minor_issues': return <AlertCircle className="h-5 w-5" />
      default: return <Activity className="h-5 w-5" />
    }
  }

  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  const summary = healthSummary?.data
  const devices = summary?.devices || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Solar Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of solar devices and energy performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{summary?.totalDevices || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600">{summary?.onlineDevices || 0}</p>
              </div>
              <Wifi className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">{summary?.summary?.healthScore || 0}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Efficiency</p>
                <p className="text-2xl font-bold">{summary?.summary?.avgEfficiency || 0}%</p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(summary?.summary?.overallStatus || 'unknown')}
              <span>Facility Status</span>
            </CardTitle>
            <Badge className={getStatusColor(summary?.summary?.overallStatus || 'unknown')}>
              {summary?.summary?.overallStatus?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{summary?.onlineDevices || 0}</p>
              <p className="text-sm text-muted-foreground">Online</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{summary?.offlineDevices || 0}</p>
              <p className="text-sm text-muted-foreground">Offline</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{summary?.devicesWithIssues || 0}</p>
              <p className="text-sm text-muted-foreground">Issues</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{summary?.maintenanceDue || 0}</p>
              <p className="text-sm text-muted-foreground">Maintenance Due</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Last updated: {summary?.summary?.lastUpdated ? formatLastUpdated(summary.summary.lastUpdated) : 'Never'}
          </div>
        </CardContent>
      </Card>

      {/* Device Details */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {devices.map((device: DeviceWithHealth) => (
              <LiveDeviceCard
                key={device.id}
                device={device}
                onRefresh={handleRefreshAll}
              />
            ))}
          </div>
          {devices.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No devices found</h3>
                <p className="text-muted-foreground">
                  No solar devices are registered for this facility yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.criticalAlerts && summary.criticalAlerts.length > 0 ? (
                <div className="space-y-2">
                  {summary.criticalAlerts.map((alert: any) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(alert.triggeredAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">No critical alerts</h3>
                  <p className="text-muted-foreground">All systems are operating normally.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telemetry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Telemetry Data</CardTitle>
            </CardHeader>
            <CardContent>
              {telemetryData?.data && telemetryData.data.length > 0 ? (
                <div className="space-y-2">
                  {telemetryData.data.slice(0, 10).map((reading: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{reading.deviceId.slice(0, 8)}</Badge>
                        <div>
                          <p className="font-medium">
                            Power: {reading.power}W | Solar: {reading.solarGeneration}W
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Battery: {reading.batteryLevel}% | Temp: {reading.temperature}°C
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(reading.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No telemetry data</h3>
                  <p className="text-muted-foreground">
                    No recent telemetry data available from devices.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default LiveDashboard
