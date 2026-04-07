"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, X, Phone, Mail, Building2, Package, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"

interface AdminNotification {
  id: string
  type: string
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  facilityId?: string
  productId?: string
  serviceName?: string
  metadata?: any
  priority: string
  isRead: boolean
  isDismissed: boolean
  createdAt: string
}

interface AdminNotificationsProps {
  showUnreadOnly?: boolean
  limit?: number
}

export function AdminNotifications({ showUnreadOnly = false, limit = 20 }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        ...(showUnreadOnly && { unreadOnly: 'true' })
      })
      
      const response = await fetch(`/api/admin/notifications?${queryParams}`)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId, isRead: true })
      })

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const dismissNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId, isDismissed: true })
      })

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote_request':
        return <Phone className="h-4 w-4" />
      case 'new_order':
        return <Package className="h-4 w-4" />
      case 'user_registration':
        return <Building2 className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading notifications...</div>
  }

  if (notifications.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No new notifications
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Notifications</h3>
        <Badge variant="outline" className="text-xs">
          {notifications.length} new
        </Badge>
      </div>
      
      <div className="space-y-2">
        {notifications.map((notification) => (
          <Card key={notification.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                  <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                    {notification.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {notification.message}
                </p>
                {notification.metadata && (
                  <div className="text-xs text-muted-foreground mb-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3" />
                      <span><strong>Facility:</strong> {notification.metadata.facility?.name}</span>
                    </div>
                    {notification.metadata.product && (
                      <div className="flex items-center gap-2">
                        <Package className="h-3 w-3" />
                        <span><strong>Product:</strong> {notification.metadata.product.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span><strong>Requested by:</strong> {notification.metadata.requestedBy?.name}</span>
                    </div>
                    {notification.metadata.requestedBy?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span><strong>Phone:</strong> {notification.metadata.requestedBy.phone}</span>
                      </div>
                    )}
                    {notification.metadata.requestedBy?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span><strong>Email:</strong> {notification.metadata.requestedBy.email}</span>
                      </div>
                    )}
                    {notification.metadata.message && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <strong>Message:</strong> {notification.metadata.message}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => dismissNotification(notification.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
