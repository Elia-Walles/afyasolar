import { db } from '@/lib/db'
import { adminNotifications } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { eq, and, desc } from 'drizzle-orm'

/**
 * Create a quote request notification for admins
 */
export async function createQuoteRequestNotification(data: {
  facilityId: string
  facilityName: string
  productId: string
  productName: string
  productCategory: string
  requestedBy: string
  requestedByEmail?: string
  requestedByPhone?: string
  message?: string
}) {
  try {
    const notificationId = generateId()
    
    const metadata = {
      facility: {
        id: data.facilityId,
        name: data.facilityName,
      },
      product: {
        id: data.productId,
        name: data.productName,
        category: data.productCategory,
      },
      requestedBy: {
        name: data.requestedBy,
        email: data.requestedByEmail,
        phone: data.requestedByPhone,
      },
      message: data.message,
      requestedAt: new Date().toISOString(),
    }

    await db
      .insert(adminNotifications)
      .values({
        id: notificationId,
        type: 'quote_request',
        title: `Quote Request: ${data.productName}`,
        message: `${data.facilityName} is requesting a quote for ${data.productName} (${data.productCategory})`,
        actionUrl: '/dashboard/admin',
        actionLabel: 'View Request',
        facilityId: data.facilityId,
        productId: data.productId,
        serviceName: 'afya-solar',
        metadata,
        priority: 'high',
        showInDashboard: true,
        sendEmail: true, // Send email notification to admins
        sendSms: false,
        isRead: false,
        isDismissed: false,
      })

    return { id: notificationId }
  } catch (error) {
    console.error('Error creating quote request notification:', error)
    throw error
  }
}

/**
 * Get unread admin notifications
 */
export async function getUnreadAdminNotifications(limit: number = 20) {
  try {
    const notifications = await db
      .select()
      .from(adminNotifications)
      .where(
        and(
          eq(adminNotifications.isRead, false),
          eq(adminNotifications.isDismissed, false)
        )
      )
      .orderBy(desc(adminNotifications.createdAt))
      .limit(limit)

    return notifications
  } catch (error) {
    console.error('Error fetching unread admin notifications:', error)
    throw error
  }
}

/**
 * Mark admin notification as read
 */
export async function markAdminNotificationAsRead(notificationId: string) {
  try {
    await db
      .update(adminNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(adminNotifications.id, notificationId))

    return { id: notificationId, isRead: true }
  } catch (error) {
    console.error('Error marking admin notification as read:', error)
    throw error
  }
}

/**
 * Dismiss admin notification
 */
export async function dismissAdminNotification(notificationId: string) {
  try {
    await db
      .update(adminNotifications)
      .set({
        isDismissed: true,
        dismissedAt: new Date(),
      })
      .where(eq(adminNotifications.id, notificationId))

    return { id: notificationId, isDismissed: true }
  } catch (error) {
    console.error('Error dismissing admin notification:', error)
    throw error
  }
}
