/**
 * Subscription Reminder Service
 * Handles checking for expiring subscriptions and sending reminder notifications
 */

import { db } from '@/lib/db'
import { serviceSubscriptions, facilityNotifications, facilities } from '@/lib/db/schema'
import { eq, and, sql, lte, gte, isNull, or } from 'drizzle-orm'
import { createNotification } from '@/lib/payments/transaction-service'
import { sendEmailNotification } from './email-service'

/**
 * Check and process expiring subscriptions
 * Should be called by a cron job (e.g., daily)
 */
export async function processExpiringSubscriptions(): Promise<{
  checked: number
  reminders7Days: number
  reminders3Days: number
  reminders1Day: number
  expired: number
}> {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

  let reminders7Days = 0
  let reminders3Days = 0
  let reminders1Day = 0
  let expired = 0

  // Get all active subscriptions
  const activeSubscriptions = await db
    .select({
      subscription: serviceSubscriptions,
      facilityName: facilities.name,
      facilityEmail: facilities.email,
    })
    .from(serviceSubscriptions)
    .leftJoin(facilities, eq(serviceSubscriptions.facilityId, facilities.id))
    .where(eq(serviceSubscriptions.status, 'active'))

  for (const { subscription, facilityName, facilityEmail } of activeSubscriptions) {
    if (!subscription.expiryDate) continue

    const expiryDate = new Date(subscription.expiryDate)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Check if already expired
    if (expiryDate < now) {
      // Mark as expired
      await db
        .update(serviceSubscriptions)
        .set({ 
          status: 'expired', 
          updatedAt: sql`CURRENT_TIMESTAMP` 
        })
        .where(eq(serviceSubscriptions.id, subscription.id))

      // Send expiration notification
      const notificationId = await createNotification({
        facilityId: subscription.facilityId,
        type: 'subscription_expired',
        title: 'Subscription Expired',
        message: `Your ${subscription.serviceName} subscription has expired. Please renew to continue accessing the service.`,
        serviceName: subscription.serviceName,
        subscriptionId: subscription.id,
        priority: 'urgent',
        sendEmail: true,
        actionUrl: '/services/afya-solar',
        actionLabel: 'Renew Now',
      })

      // Send email immediately for urgent notifications
      await sendEmailNotification(notificationId)

      expired++
      continue
    }

    // Check if reminder already sent for this period
    const reminderKey = `reminder_${daysUntilExpiry <= 1 ? '1day' : daysUntilExpiry <= 3 ? '3days' : '7days'}`
    
    // Check for existing reminder notification
    const [existingReminder] = await db
      .select()
      .from(facilityNotifications)
      .where(
        and(
          eq(facilityNotifications.facilityId, subscription.facilityId),
          eq(facilityNotifications.subscriptionId, subscription.id),
          eq(facilityNotifications.type, 'subscription_expiring'),
          gte(facilityNotifications.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)) // Within last 24 hours
        )
      )
      .limit(1)

    if (existingReminder) {
      // Already sent reminder today
      continue
    }

    // Send appropriate reminder based on days until expiry
    if (daysUntilExpiry <= 1 && daysUntilExpiry > 0) {
      // 1 day reminder (urgent)
      const notificationId = await createNotification({
        facilityId: subscription.facilityId,
        type: 'subscription_expiring',
        title: '⚠️ Last Day! Subscription Expires Tomorrow',
        message: `Your ${subscription.serviceName} subscription expires tomorrow (${expiryDate.toLocaleDateString()}). Renew now to avoid service interruption.`,
        serviceName: subscription.serviceName,
        subscriptionId: subscription.id,
        priority: 'urgent',
        sendEmail: true,
        actionUrl: '/services/afya-solar',
        actionLabel: 'Renew Now',
        expiresAt: expiryDate,
      })

      await sendEmailNotification(notificationId)
      reminders1Day++
    } else if (daysUntilExpiry <= 3 && daysUntilExpiry > 1) {
      // 3 day reminder (high priority)
      const notificationId = await createNotification({
        facilityId: subscription.facilityId,
        type: 'subscription_expiring',
        title: '⏰ Subscription Expiring in 3 Days',
        message: `Your ${subscription.serviceName} subscription will expire on ${expiryDate.toLocaleDateString()}. Renew soon to continue uninterrupted service.`,
        serviceName: subscription.serviceName,
        subscriptionId: subscription.id,
        priority: 'high',
        sendEmail: true,
        actionUrl: '/services/afya-solar',
        actionLabel: 'Renew Subscription',
        expiresAt: expiryDate,
      })

      await sendEmailNotification(notificationId)
      reminders3Days++
    } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 3) {
      // 7 day reminder (normal priority)
      const notificationId = await createNotification({
        facilityId: subscription.facilityId,
        type: 'subscription_expiring',
        title: '📅 Subscription Expiring Soon',
        message: `Your ${subscription.serviceName} subscription will expire on ${expiryDate.toLocaleDateString()} (${daysUntilExpiry} days remaining). Consider renewing early.`,
        serviceName: subscription.serviceName,
        subscriptionId: subscription.id,
        priority: 'normal',
        sendEmail: true,
        actionUrl: '/services/afya-solar',
        actionLabel: 'View Subscription',
        expiresAt: expiryDate,
      })

      await sendEmailNotification(notificationId)
      reminders7Days++
    }
  }

  console.log('=== SUBSCRIPTION REMINDER PROCESSING COMPLETE ===')
  console.log({
    checked: activeSubscriptions.length,
    reminders7Days,
    reminders3Days,
    reminders1Day,
    expired,
  })

  return {
    checked: activeSubscriptions.length,
    reminders7Days,
    reminders3Days,
    reminders1Day,
    expired,
  }
}

/**
 * Get subscription status for a facility
 */
export async function getSubscriptionStatus(facilityId: string, serviceName: string) {
  const [subscription] = await db
    .select()
    .from(serviceSubscriptions)
    .where(
      and(
        eq(serviceSubscriptions.facilityId, facilityId),
        eq(serviceSubscriptions.serviceName, serviceName)
      )
    )
    .limit(1)

  if (!subscription) {
    return {
      hasSubscription: false,
      status: 'none',
      isActive: false,
      canAccess: false,
    }
  }

  const now = new Date()
  const expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate) : null
  const isExpired = expiryDate && expiryDate < now
  const daysRemaining = expiryDate 
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Auto-update status if expired
  if (isExpired && subscription.status === 'active') {
    await db
      .update(serviceSubscriptions)
      .set({ status: 'expired', updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(serviceSubscriptions.id, subscription.id))
    subscription.status = 'expired'
  }

  return {
    hasSubscription: true,
    subscriptionId: subscription.id,
    status: subscription.status,
    isActive: subscription.status === 'active' && !isExpired,
    canAccess: subscription.status === 'active' && !isExpired,
    expiryDate: subscription.expiryDate,
    daysRemaining,
    isExpiringSoon: daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0,
    billingCycle: subscription.billingCycle,
    amount: subscription.amount,
  }
}

