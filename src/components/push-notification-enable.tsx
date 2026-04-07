'use client'

import { usePushNotification } from '@/hooks/use-push-notification'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'
import { useEffect } from 'react'

export function PushNotificationEnable() {
  const { isSupported, isSubscribed, isSubscribing, error, subscribe, unsubscribe } =
    usePushNotification()

  if (!isSupported) {
    return null // Don't show anything if not supported
  }

  return (
    <div className="flex items-center gap-2">
      {isSubscribed ? (
        <Button
          variant="outline"
          size="sm"
          onClick={unsubscribe}
          disabled={isSubscribing}
          className="flex items-center gap-2"
        >
          <BellOff className="h-4 w-4" />
          {isSubscribing ? 'Disabling...' : 'Disable Notifications'}
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          onClick={subscribe}
          disabled={isSubscribing}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Bell className="h-4 w-4" />
          {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
        </Button>
      )}
      {error && (
        <span className="text-xs text-red-600" title={error}>
          Error
        </span>
      )}
    </div>
  )
}

/**
 * Auto-enable push notifications on app load (optional)
 * Add this to your layout or dashboard to automatically prompt users
 */
export function AutoEnablePushNotifications() {
  const { isSupported, isSubscribed, subscribe } = usePushNotification()

  useEffect(() => {
    // Auto-subscribe if supported and not already subscribed
    // Only do this after a delay to not be too aggressive
    if (isSupported && !isSubscribed) {
      const timer = setTimeout(() => {
        // Check if permission was previously granted
        if (Notification.permission === 'granted') {
          subscribe()
        }
        // If permission is 'default', we'll wait for user to click
      }, 5000) // Wait 5 seconds

      return () => clearTimeout(timer)
    }
  }, [isSupported, isSubscribed, subscribe])

  return null
}

