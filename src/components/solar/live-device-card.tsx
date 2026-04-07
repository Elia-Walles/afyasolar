import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Battery, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  TrendingUp,
  TrendingDown,
  Sun,
  Thermometer,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DeviceWithHealth, DeviceHealth, DeviceAlert } from '@/types/solar'

interface LiveDeviceCardProps {
  device: DeviceWithHealth
  onRefresh?: () => void
}

export function LiveDeviceCard({ device, onRefresh }: LiveDeviceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      case 'offline': return 'bg-gray-500'
      case 'maintenance': return 'bg-blue-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'offline': return <WifiOff className="h-4 w-4" />
      case 'maintenance': return <Activity className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never'
    const date = new Date(lastSeen)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const getBatteryIcon = (level: string | null) => {
    if (!level) return <Battery className="h-4 w-4" />
    const levelNum = parseFloat(level)
    if (levelNum > 75) return <Battery className="h-4 w-4 text-green-500" />
    if (levelNum > 50) return <Battery className="h-4 w-4 text-yellow-500" />
    if (levelNum > 25) return <Battery className="h-4 w-4 text-orange-500" />
    return <Battery className="h-4 w-4 text-red-500" />
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(device.deviceStatus)}`} />
            {getStatusIcon(device.deviceStatus)}
            <div>
              <CardTitle className="text-lg">{device.serialNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{device.type}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {device.onlineStatus ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide' : 'Details'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{device.efficiency || 'N/A'}%</p>
              <p className="text-xs text-muted-foreground">Efficiency</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getBatteryIcon(device.batteryHealth)}
            <div>
              <p className="text-sm font-medium">{device.batteryHealth || 'N/A'}%</p>
              <p className="text-xs text-muted-foreground">Battery</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{device.health?.temperatureAvg || 'N/A'}°C</p>
              <p className="text-xs text-muted-foreground">Temp</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{device.activeAlerts}</p>
              <p className="text-xs text-muted-foreground">Alerts</p>
            </div>
          </div>
        </div>

        {/* Alerts Summary */}
        {device.activeAlerts > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Active Alerts</h4>
            <div className="space-y-1">
              {device.alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center space-x-2">
                    <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                      {alert.severity}
                    </Badge>
                    <span className="text-sm">{alert.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatLastSeen(alert.triggeredAt)}
                  </span>
                </div>
              ))}
              {device.alerts.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{device.alerts.length - 3} more alerts
                </p>
              )}
            </div>
          </div>
        )}

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Device Information</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Device ID:</span>
                    <span className="font-mono text-xs">{device.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Seen:</span>
                    <span>{formatLastSeen(device.lastSeen)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime:</span>
                    <span>{device.uptime}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Firmware:</span>
                    <span>{device.health?.firmwareVersion || 'Unknown'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Performance Metrics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Error Count:</span>
                    <span>{device.health?.errorCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Warning Count:</span>
                    <span>{device.health?.warningCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Maintenance Due:</span>
                    <span>{device.maintenanceDue ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="outline" className="text-xs">
                      {device.deviceStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {device.maintenanceDue && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Maintenance Required
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Refresh Data
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LiveDeviceCard
