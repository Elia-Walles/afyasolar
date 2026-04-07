/**
 * Custom service worker with push notification support
 * This file is loaded by next-pwa for custom functionality
 */

// Skip workbox import if already loaded
if (typeof workbox === 'undefined') {
  try {
    importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')
  } catch (e) {
    console.log('[SW] Workbox not needed or already loaded')
  }
}

// Listen for push events
self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event)

  // Default notification data
  let notificationData = {
    title: 'Ubuntu AfyaLink',
    body: 'You have a new notification',
    icon: '/images/services/logo.png',
    badge: '/images/services/logo.png',
    tag: 'notification-' + Date.now(),
    requireInteraction: false,
    data: {
      url: '/',
    },
  }

  // Parse the push payload
  if (event.data) {
    try {
      const payload = event.data.json()
      console.log('[SW] Push payload:', payload)
      
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
      console.error('[SW] Error parsing push payload:', e)
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
    vibrate: [100, 50, 100, 50, 100],
    renotify: true,
    silent: false,
    actions: [
      {
        action: 'open',
        title: 'View',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
  })

  event.waitUntil(promiseChain)
})

// Listen for notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action, event.notification.tag)

  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/'
  const fullUrl = new URL(urlToOpen, self.location.origin).href

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then(function(clientList) {
      // Try to focus an existing window
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl)
          return client.focus()
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl)
      }
    })
  )
})

// Listen for notification close
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event.notification.tag)
})

// Handle subscription change
self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[SW] Push subscription changed')
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then(function(subscription) {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
    }).catch(function(error) {
      console.error('[SW] Re-subscription failed:', error)
    })
  )
})

console.log('[SW] Custom service worker with push support loaded')
