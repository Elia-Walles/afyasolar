/**
 * Hook for managing push notification subscriptions
 */
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface PushSubscriptionState {
  isSupported: boolean
  isSubscribed: boolean
  isSubscribing: boolean
  error: string | null
}

export function usePushNotification() {
  const { data: session } = useSession()
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isSubscribing: false,
    error: null,
  })

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setState((prev) => ({ ...prev, isSupported }))

    if (isSupported && session) {
      checkSubscriptionStatus()
    }
  }, [session])

  const checkSubscriptionStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setState((prev) => ({
        ...prev,
        isSubscribed: !!subscription,
      }))
    } catch (error) {
      console.error('Error checking subscription status:', error)
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined' || !state.isSupported || !session) {
      return
    }

    setState((prev) => ({ ...prev, isSubscribing: true, error: null }))

    try {
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      // Get VAPID public key
      const response = await fetch('/api/push/vapid-public-key')
      if (!response.ok) {
        throw new Error('Failed to get VAPID public key')
      }
      const { publicKey } = await response.json()

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey)

      // Register service worker
      const registration = await navigator.serviceWorker.ready

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })

      // Send subscription to server
      const subscribeResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      })

      if (!subscribeResponse.ok) {
        throw new Error('Failed to save subscription')
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isSubscribing: false,
      }))
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error)
      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isSubscribing: false,
        error: error.message || 'Failed to subscribe to push notifications',
      }))
    }
  }, [state.isSupported, session])

  const unsubscribe = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    setState((prev) => ({ ...prev, isSubscribing: true, error: null }))

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from push service
        await subscription.unsubscribe()

        // Remove from server
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        })

        setState((prev) => ({
          ...prev,
          isSubscribed: false,
          isSubscribing: false,
        }))
      }
    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error)
      setState((prev) => ({
        ...prev,
        isSubscribing: false,
        error: error.message || 'Failed to unsubscribe from push notifications',
      }))
    }
  }, [])

  return {
    ...state,
    subscribe,
    unsubscribe,
    checkSubscriptionStatus,
  }
}

/**
 * Convert VAPID key from base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

