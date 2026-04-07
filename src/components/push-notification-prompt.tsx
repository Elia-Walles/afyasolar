'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePushNotification } from '@/hooks/use-push-notification'
import { Button } from '@/components/ui/button'
import { Bell, X, BellRing, Smartphone, CheckCircle } from 'lucide-react'

const PROMPT_DISMISSED_KEY = 'push_notification_prompt_dismissed'
const PROMPT_DELAY_MS = 2500 // Show prompt after 2.5 seconds

export function PushNotificationPrompt() {
  const { data: session } = useSession()
  const { isSupported, isSubscribed, isSubscribing, subscribe } = usePushNotification()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Don't show if no session, not supported, or already subscribed
    if (!session || !isSupported || isSubscribed) {
      return
    }

    // Check if user has already dismissed the prompt permanently
    try {
      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY)
      if (dismissed === 'true') {
        return
      }
    } catch {
      // ignore storage errors and continue
    }

    // Only show if the browser is still in "default" state (user has not decided yet)
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted' || Notification.permission === 'denied') {
        // User has already allowed or blocked notifications; don't prompt again
        return
      }
    }

    // Show the prompt after a delay
    const timer = setTimeout(() => {
      setShowPrompt(true)
      // Animate in after a short delay
      setTimeout(() => setIsVisible(true), 50)
    }, PROMPT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [session, isSupported, isSubscribed])

  const handleEnable = async () => {
    try {
      await subscribe()
      // Mark as handled so we don't show the prompt again on this device
      try {
        localStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
      } catch {
        // ignore storage errors
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error)
      // If the user explicitly blocked notifications, also stop re-showing the prompt
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          localStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
        }
      } catch {
        // ignore
      }
    } finally {
      // In all cases, hide the prompt after user action
      setIsVisible(false)
      setTimeout(() => setShowPrompt(false), 300)
    }
  }

  const handleDismiss = () => {
    try {
      // Permanently mark as dismissed for this device
      localStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
    } catch {
      // ignore storage errors
    }
    setIsVisible(false)
    setTimeout(() => setShowPrompt(false), 300)
  }

  const handleLater = () => {
    setIsVisible(false)
    setTimeout(() => setShowPrompt(false), 300)
  }

  if (!showPrompt) return null

  return (
    <div
      className={`fixed right-4 top-4 z-50 transition-all duration-200 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg px-3 py-2 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs text-gray-800 dark:text-gray-100">
          Allow notifications?
        </span>
        <Button
          size="sm"
          className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleEnable}
          disabled={isSubscribing}
        >
          Allow
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] border-gray-300 text-gray-600 hover:bg-gray-50"
          onClick={handleDismiss}
          disabled={isSubscribing}
        >
          Do not allow
        </Button>
      </div>
    </div>
  )
}

/**
 * Compact notification toggle for headers/navbars
 */
export function NotificationToggle() {
  const { isSupported, isSubscribed, subscribe, unsubscribe, isSubscribing } = usePushNotification()
  const { data: session } = useSession()

  if (!session || !isSupported) return null

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isSubscribing}
      className={`
        relative p-2 rounded-full transition-all duration-200
        ${isSubscribed 
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
        ${isSubscribing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
      `}
      title={isSubscribed ? 'Notifications enabled - click to disable' : 'Click to enable notifications'}
    >
      {isSubscribing ? (
        <span className="w-5 h-5 flex items-center justify-center">
          <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        </span>
      ) : isSubscribed ? (
        <BellRing className="h-5 w-5" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
      {isSubscribed && (
        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900" />
      )}
    </button>
  )
}
