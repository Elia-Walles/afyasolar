import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  Eye,
  Settings,
  Zap,
  Wifi,
  WifiOff,
  Battery,
  Thermometer,
  MapPin,
  Calendar,
  User,
  Mail,
  Phone,
  MessageSquare,
  RefreshCw
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import AlertSystemConfiguration from './alert-system-configuration'

interface SolarAlert {
  id: string
  deviceId: string
  deviceSerial: string
  facilityId: string
  facilityName: string
  type: 'critical' | 'warning' | 'info' | 'maintenance'
  severity: 'high' | 'medium' | 'low'
  title: string
  message: string
  status: 'active' | 'acknowledged' | 'resolved'
  triggeredAt: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolvedAt?: string
  resolvedBy?: string
  notificationSent: boolean
  notificationChannels: string[]
  metadata: {
    temperature?: number
    batteryLevel?: number
    powerOutput?: number
    efficiency?: number
    errorCode?: string
    threshold?: number
    actualValue?: number
    lastSeen?: string
    operatingHours?: number
    lastMaintenance?: string
  }
}

export function AdminSolarAlerts() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [selectedAlert, setSelectedAlert] = useState<SolarAlert | null>(null)

  // Real alerts data from database
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['solar-alerts', statusFilter, severityFilter],
    queryFn: async (): Promise<SolarAlert[]> => {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (severityFilter !== 'all') {
        params.set('severity', severityFilter)
      }
      
      const response = await fetch(`/api/admin/solar/alerts?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch alerts')
      }
      const result = await response.json()
      return result.data || []
    },
  })

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async ({ alertId, acknowledgedBy }: { alertId: string; acknowledgedBy: string }) => {
      const response = await fetch(`/api/admin/solar/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy })
      })
      
      if (!response.ok) {
        throw new Error('Failed to acknowledge alert')
      }
      
      return await response.json()
    },
    onSuccess: () => {
      refetch()
    }
  })

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async ({ alertId, resolvedBy }: { alertId: string; resolvedBy: string }) => {
      const response = await fetch(`/api/admin/solar/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy })
      })
      
      if (!response.ok) {
        throw new Error('Failed to resolve alert')
      }
      
      return await response.json()
    },
    onSuccess: () => {
      refetch()
    }
  })

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.deviceSerial.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.facilityName.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
    
    return matchesSearch && matchesStatus && matchesSeverity
  })

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'critical': return 'destructive'
      case 'warning': return 'secondary'
      case 'maintenance': return 'outline'
      case 'info': return 'default'
      default: return 'secondary'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <AlertTriangle className="h-4 w-4" />
      case 'acknowledged': return <Clock className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  const formatTimeAgo = (timestamp: string) => {
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
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    critical: alerts.filter(a => a.type === 'critical' && a.status === 'active').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    resolved: alerts.filter(a => a.status === 'resolved').length
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading alerts...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs for different views */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="configuration">Alert Configuration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="alerts" className="space-y-6">

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-red-600">{stats.active}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-700">{stats.critical}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-700" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acknowledged</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.acknowledged}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Alerts ({filteredAlerts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(alert.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{alert.title}</h3>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getAlertTypeColor(alert.type)}>
                          {alert.type}
                        </Badge>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Device</p>
                        <p className="text-sm font-medium">{alert.deviceSerial}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Facility</p>
                        <p className="text-sm font-medium">{alert.facilityName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Triggered</p>
                        <p className="text-sm font-medium">{formatTimeAgo(alert.triggeredAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Notifications</p>
                        <p className="text-sm font-medium">
                          {alert.notificationSent ? 'Sent' : 'Pending'} ({alert.notificationChannels.length})
                        </p>
                      </div>
                    </div>

                    {/* Alert Metadata */}
                    {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {alert.metadata.temperature && (
                            <div className="flex items-center gap-1">
                              <Thermometer className="h-3 w-3" />
                              <span>Temp: {alert.metadata.temperature}°C</span>
                            </div>
                          )}
                          {alert.metadata.batteryLevel && (
                            <div className="flex items-center gap-1">
                              <Battery className="h-3 w-3" />
                              <span>Battery: {alert.metadata.batteryLevel}%</span>
                            </div>
                          )}
                          {alert.metadata.powerOutput && (
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              <span>Power: {alert.metadata.powerOutput}W</span>
                            </div>
                          )}
                          {alert.metadata.efficiency && (
                            <div className="flex items-center gap-1">
                              <span>Efficiency: {alert.metadata.efficiency}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {alert.acknowledgedAt && (
                          <span>Acknowledged by {alert.acknowledgedBy} at {format(new Date(alert.acknowledgedAt), 'MMM dd, HH:mm')}</span>
                        )}
                        {alert.resolvedAt && (
                          <span>Resolved by {alert.resolvedBy} at {format(new Date(alert.resolvedAt), 'MMM dd, HH:mm')}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedAlert(alert)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        {alert.status === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => acknowledgeAlertMutation.mutate({ 
                              alertId: alert.id, 
                              acknowledgedBy: 'admin@afyalink.com' 
                            })}
                            disabled={acknowledgeAlertMutation.isPending}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        {(alert.status === 'active' || alert.status === 'acknowledged') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => resolveAlertMutation.mutate({ 
                              alertId: alert.id, 
                              resolvedBy: 'admin@afyalink.com' 
                            })}
                            disabled={resolveAlertMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredAlerts.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No alerts found</h3>
              <p className="text-gray-500">All systems are operating normally</p>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        
        <TabsContent value="configuration">
          <AlertSystemConfiguration />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminSolarAlerts
