import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Zap,
  Battery,
  Thermometer,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  Bell,
  Calendar
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'

interface DeviceHealth {
  deviceId: string
  serialNumber: string
  facilityName: string
  onlineStatus: 'online' | 'offline'
  status: 'healthy' | 'warning' | 'critical' | 'offline' | 'maintenance'
  uptime: number
  efficiency: number
  batteryLevel: number
  temperature: number
  lastSeen: string
  activeAlerts: number
  maintenanceDue: boolean
  lastMaintenance?: string
}

interface HealthStats {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  healthyDevices: number
  devicesWithAlerts: number
  activeAlerts: number
  criticalAlerts: number
  maintenanceDue: number
  averageEfficiency: number
}

export function RealTimeHealthMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedFacility, setSelectedFacility] = useState('all')

  // Fetch real-time health data
  const { data: healthData = [], isLoading, refetch } = useQuery({
    queryKey: ['device-health-realtime', selectedFacility],
    queryFn: async (): Promise<DeviceHealth[]> => {
      const response = await fetch('/api/admin/health-summary')
      if (!response.ok) throw new Error('Failed to fetch health data')
      return response.json()
    },
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
  })

  // Fetch health statistics
  const { data: healthStats } = useQuery({
    queryKey: ['health-stats'],
    queryFn: async (): Promise<HealthStats> => {
      const response = await fetch('/api/admin/health-stats')
      if (!response.ok) throw new Error('Failed to fetch health stats')
      return response.json()
    },
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute
  })

  // Manual health check trigger
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/health-check', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_HEALTH_CHECK_SECRET}`,
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) throw new Error('Failed to trigger health check')
      return response.json()
    },
    onSuccess: () => {
      refetch()
    }
  })

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetch()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refetch])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      case 'offline': return 'bg-gray-500'
      case 'maintenance': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'offline': return <WifiOff className="h-4 w-4" />
      case 'maintenance': return <Clock className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading health monitoring data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-Time Health Monitoring</h2>
          <p className="text-muted-foreground">
            Live monitoring of device health and automated alerts
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh (30s)
            </label>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => healthCheckMutation.mutate()}
            disabled={healthCheckMutation.isPending}
          >
            <Activity className="h-4 w-4 mr-2" />
            Run Health Check
          </Button>
        </div>
      </div>

      {/* Health Statistics Overview */}
      {healthStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                  <p className="text-2xl font-bold">{healthStats.totalDevices}</p>
                  <p className="text-xs text-muted-foreground">
                    {healthStats.onlineDevices} online, {healthStats.offlineDevices} offline
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Healthy Devices</p>
                  <p className="text-2xl font-bold text-green-600">{healthStats.healthyDevices}</p>
                  <p className="text-xs text-muted-foreground">
                    {((healthStats.healthyDevices / healthStats.totalDevices) * 100).toFixed(1)}% of total
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold text-red-600">{healthStats.activeAlerts}</p>
                  <p className="text-xs text-muted-foreground">
                    {healthStats.criticalAlerts} critical
                  </p>
                </div>
                <Bell className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Efficiency</p>
                  <p className="text-2xl font-bold">{healthStats.averageEfficiency.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    Across all devices
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Device Health List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Device Health Status</span>
            <Badge variant="outline">
              {healthData.length} devices
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {healthData.map((device) => (
              <div key={device.deviceId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
                      {getStatusIcon(device.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{device.serialNumber}</h3>
                        <p className="text-sm text-muted-foreground">{device.facilityName}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={device.onlineStatus === 'online' ? 'default' : 'secondary'}>
                          {device.onlineStatus === 'online' ? (
                            <><Wifi className="h-3 w-3 mr-1" />Online</>
                          ) : (
                            <><WifiOff className="h-3 w-3 mr-1" />Offline</>
                          )}
                        </Badge>
                        {device.activeAlerts > 0 && (
                          <Badge variant="destructive">
                            {device.activeAlerts} alerts
                          </Badge>
                        )}
                        {device.maintenanceDue && (
                          <Badge variant="outline">
                            <Calendar className="h-3 w-3 mr-1" />
                            Maintenance Due
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Health Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Efficiency</p>
                        <div className="flex items-center gap-2">
                          <Progress value={device.efficiency} className="flex-1" />
                          <span className={`text-sm font-medium ${getEfficiencyColor(device.efficiency)}`}>
                            {device.efficiency.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Battery</p>
                        <div className="flex items-center gap-2">
                          <Progress value={device.batteryLevel} className="flex-1" />
                          <span className={`text-sm font-medium ${getBatteryColor(device.batteryLevel)}`}>
                            {device.batteryLevel.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                        <div className="flex items-center gap-2">
                          <Progress value={device.uptime} className="flex-1" />
                          <span className="text-sm font-medium">{device.uptime.toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Temperature</p>
                        <div className="flex items-center gap-1">
                          <Thermometer className="h-3 w-3" />
                          <span className="text-sm font-medium">{device.temperature.toFixed(1)}°C</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Seen</p>
                        <p className="text-sm font-medium">{formatLastSeen(device.lastSeen)}</p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        {device.lastMaintenance && (
                          <span>Last maintenance: {format(new Date(device.lastMaintenance), 'MMM dd, yyyy')}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Activity className="h-4 w-4 mr-1" />
                          View Details
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
          
          {healthData.length === 0 && (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No health data available</h3>
              <p className="text-gray-500">Run a health check to see device status</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default RealTimeHealthMonitoring
