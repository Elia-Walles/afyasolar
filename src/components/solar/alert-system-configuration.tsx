import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Webhook,
  Settings,
  TestTube,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

interface NotificationChannel {
  type: 'email' | 'sms' | 'in-app' | 'webhook'
  enabled: boolean
  config: {
    recipients?: string[]
    template?: string
    webhookUrl?: string
    apiKey?: string
  }
}

interface AlertRule {
  id: string
  name: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  condition: string
  threshold: number
  channels: string[]
  escalationRules: {
    delay: number
    action: string
    channels: string[]
  }[]
  enabled: boolean
}

export function AlertSystemConfiguration() {
  const [activeTab, setActiveTab] = useState('channels')
  const [testMessage, setTestMessage] = useState('This is a test alert notification')
  const [testSeverity, setTestSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')

  // Fetch alert system configuration
  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['alert-system-config'],
    queryFn: async () => {
      const response = await fetch('/api/admin/alert-system/config')
      if (!response.ok) throw new Error('Failed to fetch configuration')
      return response.json()
    }
  })

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (configData: any) => {
      const response = await fetch('/api/admin/alert-system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      })
      if (!response.ok) throw new Error('Failed to update configuration')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Alert system configuration updated successfully')
      refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async ({ channel, message, severity }: any) => {
      const response = await fetch('/api/admin/alert-system/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, message, severity })
      })
      if (!response.ok) throw new Error('Failed to send test notification')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Test notification sent successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    }
  })

  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])

  useEffect(() => {
    if (config?.data) {
      setChannels(config.data.notificationChannels || [])
      setRules(config.data.alertRules || [])
    }
  }, [config])

  const handleChannelToggle = (channelType: string, enabled: boolean) => {
    setChannels(prev => 
      prev.map(channel => 
        channel.type === channelType 
          ? { ...channel, enabled }
          : channel
      )
    )
  }

  const handleRuleToggle = (ruleId: string, enabled: boolean) => {
    setRules(prev => 
      prev.map(rule => 
        rule.id === ruleId 
          ? { ...rule, enabled }
          : rule
      )
    )
  }

  const handleSaveConfiguration = () => {
    updateConfigMutation.mutate({
      notificationChannels: channels,
      alertRules: rules
    })
  }

  const handleTestNotification = (channel: string) => {
    testNotificationMutation.mutate({
      channel,
      message: testMessage,
      severity: testSeverity
    })
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />
      case 'sms': return <Smartphone className="h-4 w-4" />
      case 'in-app': return <Bell className="h-4 w-4" />
      case 'webhook': return <Webhook className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading alert system configuration...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Alert System Configuration</h2>
          <p className="text-muted-foreground">
            Configure notification channels and alert rules for solar devices
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSaveConfiguration} disabled={updateConfigMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      {config?.data?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{config.data.stats.totalAlerts}</p>
                </div>
                <Bell className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold text-red-600">{config.data.stats.activeAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                  <p className="text-2xl font-bold text-red-700">{config.data.stats.criticalAlerts}</p>
                </div>
                <Zap className="h-8 w-8 text-red-700" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Alerts Today</p>
                  <p className="text-2xl font-bold">{config.data.stats.alertsToday}</p>
                </div>
                <Clock className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="channels">Notification Channels</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="test">Test Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {channels.map((channel) => (
                  <div key={channel.type} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gray-100 rounded">
                        {getChannelIcon(channel.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold capitalize">{channel.type}</h3>
                        <p className="text-sm text-muted-foreground">
                          {channel.type === 'email' && 'Send alerts via email notifications'}
                          {channel.type === 'sms' && 'Send alerts via SMS messages'}
                          {channel.type === 'in-app' && 'Display alerts in the application'}
                          {channel.type === 'webhook' && 'Send alerts to external webhooks'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestNotification(channel.type)}
                        disabled={testNotificationMutation.isPending}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                      <Switch
                        checked={channel.enabled}
                        onCheckedChange={(enabled) => handleChannelToggle(channel.type, enabled)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Alert Rules</CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge className={getSeverityColor(rule.severity)}>
                            {rule.severity}
                          </Badge>
                          {rule.enabled && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Type</p>
                            <p className="font-medium capitalize">{rule.type}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Condition</p>
                            <p className="font-medium">{rule.condition} {rule.threshold}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Channels</p>
                            <p className="font-medium">{rule.channels.join(', ')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Escalation</p>
                            <p className="font-medium">
                              {rule.escalationRules.length > 0 
                                ? `${rule.escalationRules[0].delay}min delay`
                                : 'None'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(enabled) => handleRuleToggle(rule.id, enabled)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="test-message">Test Message</Label>
                  <Input
                    id="test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Enter test message..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="test-severity">Severity</Label>
                  <Select value={testSeverity} onValueChange={(value: any) => setTestSeverity(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {channels.filter(c => c.enabled).map((channel) => (
                    <Button
                      key={channel.type}
                      variant="outline"
                      onClick={() => handleTestNotification(channel.type)}
                      disabled={testNotificationMutation.isPending}
                      className="flex items-center space-x-2"
                    >
                      {getChannelIcon(channel.type)}
                      <span>Test {channel.type}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AlertSystemConfiguration
