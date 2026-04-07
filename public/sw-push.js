/**
 * Push notification handler for service worker
 * This file handles push events and notification interactions
 */

// Listen for push events
self.addEventListener('push', function(event) {
  console.log('[SW Push] Push received:', event)

  // Default notification data
  let notificationData = {
    title: 'Ubuntu AfyaLink',
    body: 'You have a new notification',
    icon: '/images/services/logo.png',
    badge: '/images/services/logo.png',
    tag: 'default-' + Date.now(),
    requireInteraction: false,
    data: {
      url: '/',
    },
  }

  // Parse the push payload
  if (event.data) {
    try {
      const payload = event.data.json()
      console.log('[SW Push] Payload:', payload)
      
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        requireInteraction: payload.requireInteraction || false,
        data: {
          url: payload.data?.url || '/',
          ...payload.data,
        },
      }
    } catch (e) {
      console.error('[SW Push] Error parsing push payload:', e)
      // Try to use text if JSON parsing fails
      const text = event.data.text()
      if (text) {
        notificationData.body = text
      }
    }
  }

  // Show the notification
  const promiseChain = self.registration.showNotification(notificationData.title, {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    data: notificationData.data,
    vibrate: [100, 50, 100, 50, 100], // Vibration pattern for mobile
    actions: [
      {
        action: 'open',
        title: 'View',
        icon: '/images/services/logo.png',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
    // Additional options for better mobile experience
    renotify: true, // Vibrate again even if same tag
    silent: false, // Make sound
  })

  event.waitUntil(promiseChain)
})

// Listen for notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[SW Push] Notification clicked:', event)

  // Close the notification
  event.notification.close()

  // Handle the close action
  if (event.action === 'close') {
    return
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/'
  const fullUrl = new URL(urlToOpen, self.location.origin).href

  console.log('[SW Push] Opening URL:', fullUrl)

  // Focus or open window
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then(function(clientList) {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        // If the URL is similar, focus that window
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl)
          return client.focus()
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(fullUrl)
      }
    })
  )
})

// Listen for notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[SW Push] Notification closed:', event.notification.tag)
})

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[SW Push] Subscription changed:', event)
  
  // Re-subscribe with the new subscription
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then(function(subscription) {
      console.log('[SW Push] Re-subscribed:', subscription)
      
      // Send the new subscription to the server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      })
    }).catch(function(error) {
      console.error('[SW Push] Re-subscription failed:', error)
    })
  )
})

console.log('[SW Push] Push notification handler loaded')
