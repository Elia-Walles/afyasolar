"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  X,
  Mail,
  MessageSquare,
  Smartphone,
  Settings,
  Save,
  Eye,
  EyeOff,
  Info,
  XCircle
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface NotificationsAlertsProps {
  facilityId?: string
}

interface Alert {
  id: string
  type: 'payment-due' | 'grace-period' | 'restriction' | 'general'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string
  amount?: number
  createdAt: string
  isRead: boolean
}

interface AlertHistoryItem {
  id: string
  date: string
  type: string
  message: string
  status: 'read' | 'unread'
}

interface NotificationPreferences {
  smsEnabled: boolean
  smsNumber: string
  whatsappEnabled: boolean
  whatsappNumber: string
  emailEnabled: boolean
  emailAddress: string
  alertTypes: {
    paymentReminders: boolean
    graceWarnings: boolean
    restrictionNotices: boolean
    generalAnnouncements: boolean
  }
}

export function NotificationsAlerts({ facilityId }: NotificationsAlertsProps) {
  const [activeTab, setActiveTab] = useState("alerts")
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    smsEnabled: true,
    smsNumber: "+255 712 345 678",
    whatsappEnabled: true,
    whatsappNumber: "+255 712 345 678",
    emailEnabled: true,
    emailAddress: "facility@afyasolar.co.tz",
    alertTypes: {
      paymentReminders: true,
      graceWarnings: true,
      restrictionNotices: true,
      generalAnnouncements: true
    }
  })

  // Mock data - in real app, this would come from API
  const activeAlerts: Alert[] = [
    {
      id: "1",
      type: "payment-due",
      title: "Payment Due",
      message: "Your monthly payment of TZS 50,000 is due on March 15, 2024",
      severity: "high",
      dueDate: "2024-03-15",
      amount: 50000,
      createdAt: "2024-03-01T10:00:00Z",
      isRead: false
    },
    {
      id: "2",
      type: "grace-period",
      title: "Grace Period Warning",
      message: "You have 3 days remaining in your grace period for March payment",
      severity: "medium",
      dueDate: "2024-03-15",
      createdAt: "2024-03-12T10:00:00Z",
      isRead: false
    },
    {
      id: "3",
      type: "restriction",
      title: "Service Restriction Notice",
      message: "Your service will be temporarily suspended if payment is not received by March 20, 2024",
      severity: "critical",
      createdAt: "2024-03-10T15:00:00Z",
      isRead: false
    },
    {
      id: "4",
      type: "general",
      title: "System Maintenance Scheduled",
      message: "Scheduled maintenance on March 25, 2024 from 2:00 AM to 4:00 AM. Service may be temporarily unavailable.",
      severity: "low",
      createdAt: "2024-03-05T09:00:00Z",
      isRead: true
    }
  ]

  const alertHistory: AlertHistoryItem[] = [
    {
      id: "1",
      date: "2024-03-12T10:00:00Z",
      type: "payment-due",
      message: "Payment reminder: March payment due in 3 days",
      status: "unread"
    },
    {
      id: "2",
      date: "2024-03-10T15:00:00Z",
      type: "grace-period",
      message: "Grace period warning for March payment",
      status: "read"
    },
    {
      id: "3",
      date: "2024-03-05T09:00:00Z",
      type: "general",
      message: "System maintenance notification - March 25",
      status: "read"
    },
    {
      id: "4",
      date: "2024-03-01T10:00:00Z",
      type: "payment-due",
      message: "Payment due for February - TZS 50,000",
      status: "read"
    }
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "critical":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "low":
        return <Info className="h-4 w-4" />
      case "medium":
        return <AlertTriangle className="h-4 w-4" />
      case "high":
        return <AlertCircle className="h-4 w-4" />
      case "critical":
        return <XCircle className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case "payment-due":
        return <DollarSign className="h-4 w-4" />
      case "grace-period":
        return <Clock className="h-4 w-4" />
      case "restriction":
        return <AlertTriangle className="h-4 w-4" />
      case "general":
        return <Info className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const markAsRead = (alertId: string) => {
    // In real app, this would call API to mark alert as read
    console.log(`Marking alert ${alertId} as read`)
  }

  const savePreferences = () => {
    // In real app, this would save preferences to API
    console.log("Saving notification preferences:", preferences)
  }

  const unreadCount = useMemo(() => {
    return activeAlerts.filter(alert => !alert.isRead).length
  }, [activeAlerts])

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="alerts" className="relative">
            Active Alerts
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Alert History</TabsTrigger>
        </TabsList>

        {/* Active Alerts Section */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-green-600" />
                Active Alerts
              </CardTitle>
              <CardDescription>
                Current alerts and notifications from Afya Solar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No active alerts at this time</p>
                  </div>
                ) : (
                  activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-4 border rounded-lg",
                        alert.isRead ? "bg-gray-50 opacity-60" : "bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-full",
                              getSeverityColor(alert.severity)
                            )}>
                              {getSeverityIcon(alert.severity)}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{alert.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                              {alert.dueDate && (
                                <div className="flex items-center gap-2 mt-2 text-sm">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span>Due: {new Date(alert.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              {alert.amount && (
                                <div className="flex items-center gap-2 mt-2 text-sm">
                                  <DollarSign className="h-4 w-4 text-gray-400" />
                                  <span>Amount: {formatCurrency(alert.amount)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn(getSeverityColor(alert.severity), "capitalize")}>
                            {alert.severity}
                          </Badge>
                          {!alert.isRead && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markAsRead(alert.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert History Section */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600" />
                Alert History
              </CardTitle>
              <CardDescription>
                View your notification and Alert history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAlertTypeIcon(item.type)}
                          <span className="capitalize">{item.type.replace("-", " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="line-clamp-2 text-sm">{item.message}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          item.status === 'read' 
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-yellow-100 text-yellow-800 border-yellow-200"
                        )}>
                          {item.status === 'read' ? (
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Read
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <EyeOff className="h-3 w-3" />
                              Unread
                            </div>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => item.status === 'unread' ? markAsRead(item.id) : undefined}
                          disabled={item.status === 'read'}
                        >
                          {item.status === 'read' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
