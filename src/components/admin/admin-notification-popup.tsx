"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, X, Phone, Mail, Building2, Package, User, FileText, CreditCard, Users, AlertTriangle, CheckCircle } from "lucide-react"
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

interface AdminNotificationPopupProps {
  isOpen: boolean
  onClose: () => void
  onMarkAllAsRead: () => void
  notifications: AdminNotification[]
  loading?: boolean
}

export function AdminNotificationPopup({ 
  isOpen, 
  onClose, 
  onMarkAllAsRead, 
  notifications, 
  loading = false 
}: AdminNotificationPopupProps) {
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote_request':
        return <Phone className="h-5 w-5 text-blue-600" />
      case 'new_order':
        return <Package className="h-5 w-5 text-green-600" />
      case 'user_registration':
        return <Building2 className="h-5 w-5 text-purple-600" />
      case 'invoice_request':
        return <FileText className="h-5 w-5 text-orange-600" />
      case 'credit_application':
        return <CreditCard className="h-5 w-5 text-red-600" />
      case 'pool_update':
        return <Users className="h-5 w-5 text-indigo-600" />
      case 'urgent':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Bell className="h-5 w-5 text-gray-600" />
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

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-l-red-500'
      case 'high':
        return 'border-l-4 border-l-orange-500'
      case 'normal':
        return 'border-l-4 border-l-blue-500'
      case 'low':
        return 'border-l-4 border-l-gray-500'
      default:
        return 'border-l-4 border-l-gray-500'
    }
  }

  const handleNotificationAction = (notification: AdminNotification) => {
    setSelectedNotifications(prev => new Set(prev).add(notification.id))
    
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank')
    }
    
    toast({
      title: "Notification Actioned",
      description: `You can now view the ${notification.title.toLowerCase()} details.`,
      duration: 3000,
    })
  }

  const unreadNotifications = notifications.filter(n => !n.isRead && !n.isDismissed)
  const urgentNotifications = unreadNotifications.filter(n => n.priority === 'urgent')
  const highPriorityNotifications = unreadNotifications.filter(n => n.priority === 'high')

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-6 w-6 text-blue-600" />
                {unreadNotifications.length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadNotifications.length}
                  </Badge>
                )}
              </div>
              <div>
                <DialogTitle className="text-lg">Admin Notifications</DialogTitle>
                <DialogDescription>
                  {unreadNotifications.length > 0 
                    ? `You have ${unreadNotifications.length} unread notification${unreadNotifications.length > 1 ? 's' : ''}`
                    : "All caught up! No new notifications."
                  }
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">All Clear!</h3>
              <p className="text-gray-500">No new notifications to review.</p>
            </div>
          ) : (
            <>
              {/* Priority Summary */}
              {(urgentNotifications.length > 0 || highPriorityNotifications.length > 0) && (
                <div className="flex gap-2 mb-4 flex-shrink-0">
                  {urgentNotifications.length > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {urgentNotifications.length} Urgent
                    </Badge>
                  )}
                  {highPriorityNotifications.length > 0 && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {highPriorityNotifications.length} High Priority
                    </Badge>
                  )}
                </div>
              )}

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-3 pr-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 rounded-lg border bg-white transition-all hover:shadow-md",
                        getPriorityBorder(notification.priority),
                        selectedNotifications.has(notification.id) && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm truncate">{notification.title}</h4>
                            <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3">{notification.message}</p>
                          
                          {notification.metadata && (
                            <div className="text-xs text-gray-600 mb-3 space-y-1 bg-gray-50 p-3 rounded">
                              {notification.metadata.facility && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3 w-3" />
                                  <span><strong>Facility:</strong> {notification.metadata.facility.name}</span>
                                </div>
                              )}
                              {notification.metadata.product && (
                                <div className="flex items-center gap-2">
                                  <Package className="h-3 w-3" />
                                  <span><strong>Product:</strong> {notification.metadata.product.name}</span>
                                </div>
                              )}
                              {notification.metadata.requestedBy && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  <span><strong>Requested by:</strong> {notification.metadata.requestedBy.name}</span>
                                </div>
                              )}
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
                              {notification.metadata.amount && (
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-3 w-3" />
                                  <span><strong>Amount:</strong> {notification.metadata.amount}</span>
                                </div>
                              )}
                              {notification.metadata.message && (
                                <div className="mt-2 p-2 bg-white rounded text-xs border">
                                  <strong>Message:</strong> {notification.metadata.message}
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            <div className="flex gap-2">
                              {notification.actionUrl && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs"
                                  onClick={() => handleNotificationAction(notification)}
                                  disabled={selectedNotifications.has(notification.id)}
                                >
                                  {selectedNotifications.has(notification.id) ? 'Actioned' : 'View Details'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t mt-4 flex-shrink-0">
                <div className="text-sm text-gray-600">
                  {unreadNotifications.length} of {notifications.length} unread
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onMarkAllAsRead}>
                    Mark All as Read
                  </Button>
                  <Button variant="default" size="sm" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
