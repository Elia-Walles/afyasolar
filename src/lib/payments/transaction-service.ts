/**
 * Payment Transaction Service
 * Handles all payment transaction operations with comprehensive tracking
 */

import { db } from '@/lib/db'
import { 
  paymentTransactions, 
  transactionStatusHistory, 
  facilityNotifications,
  serviceSubscriptions,
  subscriptionPayments,
  serviceAccessPayments,
  facilities,
} from '@/lib/db/schema'
import { eq, and, or, sql, lte, gte } from 'drizzle-orm'
import { notificationCreators } from '@/lib/notifications/event-notifications'

// Transaction status types
export type TransactionStatus = 
  | 'initiated'      // Transaction created in our system
  | 'pending'        // Sent to Azam Pay, awaiting processing
  | 'processing'     // Azam Pay is processing
  | 'awaiting_confirmation' // PIN prompt sent to customer
  | 'completed'      // Payment successful
  | 'failed'         // Payment failed
  | 'cancelled'      // Cancelled by user or system
  | 'expired'        // Transaction timed out
  | 'refunded'       // Payment was refunded

export type NotificationType = 
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'subscription_renewed'
  | 'access_restricted'
  | 'system'

interface CreateTransactionInput {
  facilityId: string
  serviceName: string
  amount: number
  currency?: string
  paymentType: 'mobile' | 'bank'
  paymentMethod: string
  mobileNumber?: string
  mobileProvider?: string
  bankName?: string
  bankAccountNumber?: string
  bankMobileNumber?: string
  billingCycle?: 'monthly' | 'yearly'
  requestPayload?: object
}

interface UpdateTransactionStatusInput {
  transactionId: string
  status: TransactionStatus
  statusMessage?: string
  failureReason?: string
  azamTransactionId?: string
  azamReference?: string
  mnoReference?: string
  responsePayload?: object
  callbackPayload?: object
  changedBy?: string
  sourceIp?: string
}

/**
 * Generate a unique external ID for the transaction
 */
export function generateExternalId(): string {
  const timestamp = Date.now()
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `PAY-${timestamp}-${randomPart}`
}

/**
 * Create a new payment transaction
 */
export async function createTransaction(input: CreateTransactionInput) {
  const transactionId = crypto.randomUUID()
  const externalId = generateExternalId()
  
  // Set expiry time (30 minutes from now)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  
  const transaction = {
    id: transactionId,
    facilityId: input.facilityId,
    serviceName: input.serviceName,
    externalId,
    amount: String(input.amount),
    currency: input.currency || 'TZS',
    paymentType: input.paymentType,
    paymentMethod: input.paymentMethod,
    mobileNumber: input.mobileNumber || null,
    mobileProvider: input.mobileProvider || null,
    bankName: input.bankName || null,
    bankAccountNumber: input.bankAccountNumber || null,
    bankMobileNumber: input.bankMobileNumber || null,
    billingCycle: input.billingCycle || null,
    status: 'initiated' as TransactionStatus,
    statusMessage: 'Transaction initiated',
    requestPayload: input.requestPayload ? JSON.stringify(input.requestPayload) : null,
    initiatedAt: new Date(),
    expiresAt,
  }
  
  await db.insert(paymentTransactions).values(transaction)
  
  // Record initial status in history
  await recordStatusChange({
    transactionId,
    previousStatus: null,
    newStatus: 'initiated',
    statusMessage: 'Transaction created',
    changedBy: 'system',
  })
  
  // Create notification for payment initiation
  await createNotification({
    facilityId: input.facilityId,
    type: 'payment_initiated',
    title: 'Payment Initiated',
    message: `Payment of ${input.currency || 'TZS'} ${input.amount.toLocaleString()} for ${input.serviceName} has been initiated. Please complete the payment on your phone.`,
    serviceName: input.serviceName,
    transactionId,
    priority: 'high',
  })
  
  return {
    id: transactionId,
    externalId,
    status: 'initiated',
    expiresAt,
  }
}

/**
 * Update transaction status with full audit trail
 */
export async function updateTransactionStatus(input: UpdateTransactionStatusInput) {
  // Get current transaction
  const [currentTransaction] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, input.transactionId))
    .limit(1)
  
  if (!currentTransaction) {
    throw new Error('Transaction not found')
  }
  
  const previousStatus = currentTransaction.status as TransactionStatus
  
  // Prepare update data
  const updateData: Record<string, any> = {
    status: input.status,
    statusMessage: input.statusMessage || null,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }
  
  if (input.azamTransactionId) {
    updateData.azamTransactionId = input.azamTransactionId
  }
  if (input.azamReference) {
    updateData.azamReference = input.azamReference
  }
  if (input.mnoReference) {
    updateData.mnoReference = input.mnoReference
  }
  if (input.responsePayload) {
    updateData.responsePayload = JSON.stringify(input.responsePayload)
  }
  if (input.callbackPayload) {
    updateData.callbackPayload = JSON.stringify(input.callbackPayload)
    updateData.callbackReceivedAt = sql`CURRENT_TIMESTAMP`
  }
  if (input.failureReason) {
    updateData.failureReason = input.failureReason
  }
  
  // Set timestamps based on status
  switch (input.status) {
    case 'pending':
      updateData.sentToProviderAt = sql`CURRENT_TIMESTAMP`
      break
    case 'awaiting_confirmation':
      updateData.customerPromptedAt = sql`CURRENT_TIMESTAMP`
      break
    case 'completed':
      updateData.completedAt = sql`CURRENT_TIMESTAMP`
      break
    case 'failed':
    case 'cancelled':
    case 'expired':
      updateData.failedAt = sql`CURRENT_TIMESTAMP`
      break
  }
  
  // Update transaction
  await db
    .update(paymentTransactions)
    .set(updateData)
    .where(eq(paymentTransactions.id, input.transactionId))
  
  // Record status change in history
  await recordStatusChange({
    transactionId: input.transactionId,
    previousStatus,
    newStatus: input.status,
    statusMessage: input.statusMessage,
    changedBy: input.changedBy || 'system',
    sourceIp: input.sourceIp,
    metadata: input.callbackPayload || input.responsePayload,
  })
  
  // Handle status-specific actions
  if (input.status === 'completed') {
    await handlePaymentCompleted(currentTransaction)
  } else if (input.status === 'failed') {
    await handlePaymentFailed(currentTransaction, input.failureReason)
  }
  
  return { success: true, previousStatus, newStatus: input.status }
}

/**
 * Record a status change in the history table
 */
async function recordStatusChange(data: {
  transactionId: string
  previousStatus: string | null
  newStatus: string
  statusMessage?: string
  changedBy?: string
  sourceIp?: string
  metadata?: object
}) {
  await db.insert(transactionStatusHistory).values({
    id: crypto.randomUUID(),
    transactionId: data.transactionId,
    previousStatus: data.previousStatus,
    newStatus: data.newStatus,
    statusMessage: data.statusMessage || null,
    changedBy: data.changedBy || 'system',
    sourceIp: data.sourceIp || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
  })
}

/**
 * Handle successful payment completion
 */
async function handlePaymentCompleted(transaction: any) {
  const { facilityId, serviceName, amount, billingCycle } = transaction
  
  // Calculate subscription period
  const startDate = new Date()
  let endDate = new Date()
  
  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1)
  } else {
    // Default to monthly
    endDate.setMonth(endDate.getMonth() + 1)
  }
  
  // Check if subscription exists
  const [existingSubscription] = await db
    .select()
    .from(serviceSubscriptions)
    .where(
      and(
        eq(serviceSubscriptions.facilityId, facilityId),
        eq(serviceSubscriptions.serviceName, serviceName)
      )
    )
    .limit(1)
  
  let subscriptionId: string
  
  if (existingSubscription) {
    // Update existing subscription
    subscriptionId = existingSubscription.id
    await db
      .update(serviceSubscriptions)
      .set({
        status: 'active',
        startDate,
        expiryDate: endDate,
        billingCycle: billingCycle || 'monthly',
        amount: amount,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(serviceSubscriptions.id, subscriptionId))
  } else {
    // Create new subscription
    subscriptionId = crypto.randomUUID()
    await db.insert(serviceSubscriptions).values({
      id: subscriptionId,
      facilityId,
      serviceName,
      status: 'active',
      startDate,
      expiryDate: endDate,
      billingCycle: billingCycle || 'monthly',
      amount: amount,
    })
  }
  
  // Link payment to subscription
  await db.insert(subscriptionPayments).values({
    id: crypto.randomUUID(),
    subscriptionId,
    transactionId: transaction.id,
    periodStart: startDate,
    periodEnd: endDate,
    billingCycle: billingCycle || 'monthly',
    amount,
    currency: transaction.currency || 'TZS',
    status: 'completed',
    isRenewal: !!existingSubscription,
    previousPaymentId: existingSubscription?.id || null,
  })
  
  // Update service access payment if exists
  // IMPORTANT: serviceAccessPayments.transactionId can be either externalId or azamTransactionId
  // Search by both to ensure we find and update it
  const conditions = [eq(serviceAccessPayments.transactionId, transaction.externalId)]
  
  if (transaction.azamTransactionId) {
    conditions.push(eq(serviceAccessPayments.transactionId, transaction.azamTransactionId))
  }
  
  const updateResult = await db
    .update(serviceAccessPayments)
    .set({
      status: 'completed',
      paidAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(or(...conditions))
  
  console.log('[handlePaymentCompleted] Service access payment update:', {
    externalId: transaction.externalId,
    azamTransactionId: transaction.azamTransactionId,
    searchConditions: conditions.length,
  })
  
  // Create success notification
  await createNotification({
    facilityId,
    type: 'payment_completed',
    title: 'Payment Successful! 🎉',
    message: `Your payment of TZS ${Number(amount).toLocaleString()} for ${serviceName} has been completed successfully. Your subscription is now active until ${endDate.toLocaleDateString()}.`,
    serviceName,
    transactionId: transaction.id,
    subscriptionId,
    priority: 'high',
    sendEmail: true,
    actionUrl: `/services/${serviceName === 'afya-booking' ? 'booking' : serviceName}`,
    actionLabel: 'Go to Dashboard',
  })

  // Create admin notification for Afya Solar payments
  if (serviceName === 'afya-solar') {
    try {
      const [facility] = await db
        .select({ id: facilities.id, name: facilities.name })
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1)

      await notificationCreators.solarPaymentCompleted({
        transactionId: transaction.id,
        externalId: transaction.externalId,
        facilityId,
        facilityName: facility?.name || facilityId,
        amount: String(amount),
      })
    } catch (error) {
      console.error('Error creating Afya Solar admin payment notification:', error)
    }
  }
}

/**
 * Handle payment failure
 */
async function handlePaymentFailed(transaction: any, failureReason?: string) {
  const { facilityId, serviceName, amount } = transaction
  
  // Update service access payment if exists
  await db
    .update(serviceAccessPayments)
    .set({
      status: 'failed',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(serviceAccessPayments.transactionId, transaction.externalId))
  
  // Create failure notification
  await createNotification({
    facilityId,
    type: 'payment_failed',
    title: 'Payment Failed',
    message: `Your payment of TZS ${Number(amount).toLocaleString()} for ${serviceName} could not be completed. ${failureReason ? `Reason: ${failureReason}` : 'Please try again.'}`,
    serviceName,
    transactionId: transaction.id,
    priority: 'high',
    sendEmail: true,
    actionUrl: '/services/afya-solar',
    actionLabel: 'Try Again',
  })

  // Create admin notification for Afya Solar failed payments
  if (serviceName === 'afya-solar') {
    try {
      const [facility] = await db
        .select({ id: facilities.id, name: facilities.name })
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1)

      await notificationCreators.solarPaymentFailed({
        transactionId: transaction.id,
        externalId: transaction.externalId,
        facilityId,
        facilityName: facility?.name || facilityId,
        amount: String(amount),
        failureReason,
      })
    } catch (error) {
      console.error('Error creating Afya Solar admin FAILED payment notification:', error)
    }
  }
}

/**
 * Create a notification
 */
export async function createNotification(data: {
  facilityId: string
  userId?: string
  type: NotificationType
  title: string
  message: string
  serviceName?: string
  transactionId?: string
  subscriptionId?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  sendEmail?: boolean
  sendSms?: boolean
  actionUrl?: string
  actionLabel?: string
  expiresAt?: Date
}) {
  const notificationId = crypto.randomUUID()
  
  await db.insert(facilityNotifications).values({
    id: notificationId,
    facilityId: data.facilityId,
    userId: data.userId || null,
    type: data.type,
    title: data.title,
    message: data.message,
    serviceName: data.serviceName || null,
    transactionId: data.transactionId || null,
    subscriptionId: data.subscriptionId || null,
    priority: data.priority || 'normal',
    showInDashboard: true,
    sendEmail: data.sendEmail || false,
    sendSms: data.sendSms || false,
    actionUrl: data.actionUrl || null,
    actionLabel: data.actionLabel || null,
    expiresAt: data.expiresAt || null,
  })
  
  // TODO: If sendEmail is true, trigger email sending
  // TODO: If sendSms is true, trigger SMS sending
  
  return notificationId
}

/**
 * Get transaction by external ID
 */
export async function getTransactionByExternalId(externalId: string) {
  const [transaction] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.externalId, externalId))
    .limit(1)
  
  return transaction
}

/**
 * Get transaction by Azam transaction ID
 */
export async function getTransactionByAzamId(azamTransactionId: string) {
  const [transaction] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.azamTransactionId, azamTransactionId))
    .limit(1)
  
  return transaction
}

/**
 * Find transaction by any reference (external ID, Azam ID, or MNO reference)
 */
export async function findTransactionByReference(reference: string) {
  // Try external ID first
  let transaction = await getTransactionByExternalId(reference)
  if (transaction) return transaction
  
  // Try Azam transaction ID
  transaction = await getTransactionByAzamId(reference)
  if (transaction) return transaction
  
  // Try MNO reference
  const [byMnoRef] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.mnoReference, reference))
    .limit(1)
  
  return byMnoRef || null
}

/**
 * Check subscription status for a facility and service
 */
export async function checkSubscriptionAccess(facilityId: string, serviceName: string) {
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
    return { hasAccess: false, reason: 'no_subscription' }
  }
  
  if (subscription.status !== 'active') {
    return { hasAccess: false, reason: 'subscription_inactive', status: subscription.status }
  }
  
  if (subscription.expiryDate && new Date(subscription.expiryDate) < new Date()) {
    // Subscription expired - update status
    await db
      .update(serviceSubscriptions)
      .set({ status: 'expired', updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(serviceSubscriptions.id, subscription.id))
    
    return { hasAccess: false, reason: 'subscription_expired', expiredAt: subscription.expiryDate }
  }
  
  return { 
    hasAccess: true, 
    subscription,
    expiresAt: subscription.expiryDate,
    daysRemaining: subscription.expiryDate 
      ? Math.ceil((new Date(subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null
  }
}

/**
 * Get expiring subscriptions (for reminder notifications)
 * Returns subscriptions expiring within the specified days
 */
export async function getExpiringSubscriptions(withinDays: number = 7) {
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + withinDays)
  
  return await db
    .select()
    .from(serviceSubscriptions)
    .where(
      and(
        eq(serviceSubscriptions.status, 'active'),
        gte(serviceSubscriptions.expiryDate, now),
        lte(serviceSubscriptions.expiryDate, futureDate)
      )
    )
}

/**
 * Get unread notifications for a facility
 */
export async function getUnreadNotifications(facilityId: string, limit: number = 10) {
  return await db
    .select()
    .from(facilityNotifications)
    .where(
      and(
        eq(facilityNotifications.facilityId, facilityId),
        eq(facilityNotifications.isRead, false),
        eq(facilityNotifications.isDismissed, false)
      )
    )
    .orderBy(sql`${facilityNotifications.createdAt} DESC`)
    .limit(limit)
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  await db
    .update(facilityNotifications)
    .set({ 
      isRead: true, 
      readAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP` 
    })
    .where(eq(facilityNotifications.id, notificationId))
}

/**
 * Dismiss notification
 */
export async function dismissNotification(notificationId: string) {
  await db
    .update(facilityNotifications)
    .set({ 
      isDismissed: true, 
      dismissedAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP` 
    })
    .where(eq(facilityNotifications.id, notificationId))
}

