/**
 * Web Push notification utility
 */
import webpush from 'web-push'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Initialize VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@afyasolar.ubuntuafyalink.co.tz'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
  tag?: string
  requireInteraction?: boolean
}

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured. Push notifications disabled.')
    return { success: 0, failed: 0 }
  }

  try {
    // Get all subscriptions for this user
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))

    if (subscriptions.length === 0) {
      return { success: 0, failed: 0 }
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/icon-192x192.png',
      data: payload.data || {},
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
    })

    let successCount = 0
    let failedCount = 0

    // Send to all subscriptions
    const promises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload
        )
        successCount++
      } catch (error: any) {
        failedCount++
        console.error('Failed to send push notification:', error)

        // If subscription is invalid (410 Gone or 404 Not Found), remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscription.id))
        }
      }
    })

    await Promise.allSettled(promises)

    return { success: successCount, failed: failedCount }
  } catch (error) {
    console.error('Error sending push notifications:', error)
    return { success: 0, failed: 0 }
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: number; failed: number }> {
  const results = await Promise.all(
    userIds.map((userId) => sendPushNotification(userId, payload))
  )

  return results.reduce(
    (acc, result) => ({
      success: acc.success + result.success,
      failed: acc.failed + result.failed,
    }),
    { success: 0, failed: 0 }
  )
}

/**
 * Send notification to facility users
 */
export async function notifyFacility(
  facilityId: string,
  payload: PushNotificationPayload
): Promise<void> {
  // Get all users associated with this facility
  const { users } = await import('@/lib/db/schema')
  const facilityUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.facilityId, facilityId))

  const userIds = facilityUsers.map((u) => u.id)
  if (userIds.length > 0) {
    await sendPushNotificationToUsers(userIds, payload)
  }
}

/**
 * Send notification to technician
 * Finds the user account by matching the technician's email
 */
export async function notifyTechnician(
  technicianId: string,
  payload: PushNotificationPayload
): Promise<void> {
  // Get technician details
  const { users, technicians } = await import('@/lib/db/schema')
  const [technician] = await db
    .select({ email: technicians.email })
    .from(technicians)
    .where(eq(technicians.id, technicianId))
    .limit(1)

  if (technician?.email) {
    // Find the user account with this email and role='technician'
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, technician.email))
      .limit(1)

    if (user?.id) {
      await sendPushNotification(user.id, payload)
    }
  }
}

/**
 * Send notification to admin users
 */
export async function notifyAdmins(payload: PushNotificationPayload): Promise<void> {
  const { users } = await import('@/lib/db/schema')
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))

  const userIds = adminUsers.map((u) => u.id)
  if (userIds.length > 0) {
    await sendPushNotificationToUsers(userIds, payload)
  }
}

