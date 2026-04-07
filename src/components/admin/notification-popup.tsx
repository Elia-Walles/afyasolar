"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, X, Phone, Mail, Building2, Package, User, CheckCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

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

interface NotificationPopupProps {
  isOpen: boolean
  onClose: () => void
  unreadCount: number
  onNotificationRead?: () => void
}

export function NotificationPopup({ isOpen, onClose, unreadCount, onNotificationRead }: NotificationPopupProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const { toast } = useToast()
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/notifications?limit=20&unreadOnly=true')
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
        onNotificationRead?.()
        toast({
          title: "Notification marked as read",
          description: "The notification has been marked as read.",
        })
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true)
      const response = await fetch('/api/admin/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        setNotifications([])
        onNotificationRead?.()
        toast({
          title: "All notifications marked as read",
          description: `${unreadCount} notifications have been marked as read.`,
        })
      } else {
        throw new Error('Failed to mark all as read')
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read.",
        variant: "destructive",
      })
    } finally {
      setMarkingAll(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote_request':
        return <Phone className="h-4 w-4" />
      case 'new_order':
        return <Package className="h-4 w-4" />
      case 'user_registration':
        return <User className="h-4 w-4" />
      case 'maintenance_request':
        return <Building2 className="h-4 w-4" />
      case 'feature_request':
        return <Bell className="h-4 w-4" />
      case 'feedback_submitted':
        return <Mail className="h-4 w-4" />
      case 'device_request':
        return <Package className="h-4 w-4" />
      case 'pool_created':
        return <User className="h-4 w-4" />
      case 'credit_application':
        return <Package className="h-4 w-4" />
      case 'distribution_hub_request':
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div 
        ref={popupRef}
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center p-3 border-b bg-gray-50">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={markingAll || notifications.length === 0}
            className="text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            {markingAll ? 'Marking...' : 'Mark as Read'}
          </Button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No unread notifications</p>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {notifications.map((notification) => (
                <Card key={notification.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-full border",
                        getPriorityColor(notification.priority)
                      )}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPriorityColor(notification.priority))}
                          >
                            {notification.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{notification.message}</p>
                        
                        {/* Additional Details */}
                        {notification.metadata && (
                          <div className="text-xs text-gray-500 space-y-1 mb-2">
                            {notification.metadata.facility?.name && (
                              <div><strong>Facility:</strong> {notification.metadata.facility.name}</div>
                            )}
                            {notification.metadata.productName && (
                              <div><strong>Product:</strong> {notification.metadata.productName}</div>
                            )}
                            {notification.metadata.requestedAmount && (
                              <div><strong>Amount:</strong> TSh {notification.metadata.requestedAmount}</div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
