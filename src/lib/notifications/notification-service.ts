/**
 * Centralized Notification Service
 * Handles all push notifications and in-app notifications across the application
 */

import { sendPushNotification, sendPushNotificationToUsers, PushNotificationPayload } from './push'
import { db } from '@/lib/db'
import { users, technicians, facilities, admins, maintenanceRequests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType =
  // Maintenance Request Notifications
  | 'maintenance_request_created'
  | 'maintenance_request_assigned'
  | 'maintenance_request_confirmed'
  | 'maintenance_quote_submitted'
  | 'maintenance_quote_approved'
  | 'maintenance_quote_rejected'
  | 'maintenance_quote_accepted'
  | 'maintenance_advance_paid'
  | 'maintenance_work_started'
  | 'maintenance_report_submitted'
  | 'maintenance_report_approved'
  | 'maintenance_completed'
  | 'maintenance_cancelled'
  // Booking Notifications
  | 'appointment_created'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_reminder'
  // Payment Notifications
  | 'payment_received'
  | 'payment_failed'
  | 'withdrawal_requested'
  | 'withdrawal_processed'
  // Facility Notifications
  | 'facility_invited'
  | 'facility_registered'
  | 'referral_bonus_earned'
  // Technician Notifications
  | 'technician_invited'
  | 'technician_registered'
  | 'commission_earned'
  // System Notifications
  | 'system_alert'
  | 'new_feature_request'
  | 'feedback_received'
  // Energy & climate
  | 'energy_efficiency_alert'
  | 'climate_resilience_alert'

// ============================================
// NOTIFICATION PAYLOADS
// ============================================

interface NotificationConfig {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

const NOTIFICATION_CONFIGS: Record<NotificationType, (data: any) => NotificationConfig> = {
  // Maintenance Notifications
  maintenance_request_created: (data) => ({
    title: '🔧 New Maintenance Request',
    body: `New request #${data.requestNumber} from ${data.facilityName}`,
    url: '/dashboard/admin',
    tag: `maintenance-${data.requestId}`,
  }),
  maintenance_request_assigned: (data) => ({
    title: '📋 New Job Assigned',
    body: `You've been assigned to request #${data.requestNumber}`,
    url: '/dashboard/technician',
    tag: `maintenance-${data.requestId}`,
    requireInteraction: true,
  }),
  maintenance_request_confirmed: (data) => ({
    title: '✅ Technician Confirmed',
    body: `Technician confirmed for request #${data.requestNumber}`,
    url: '/dashboard/facility',
    tag: `maintenance-${data.requestId}`,
  }),
  maintenance_quote_submitted: (data) => ({
    title: '💰 Quote Submitted',
    body: `New quote for request #${data.requestNumber}: ${data.amount}`,
    url: '/dashboard/admin',
    tag: `quote-${data.requestId}`,
  }),
  maintenance_quote_approved: (data) => ({
    title: '✅ Quote Approved',
    body: `Your quote for #${data.requestNumber} has been approved`,
    url: '/dashboard/technician',
    tag: `quote-${data.requestId}`,
  }),
  maintenance_quote_rejected: (data) => ({
    title: '❌ Quote Rejected',
    body: `Quote for #${data.requestNumber} was rejected. ${data.reason || ''}`,
    url: '/dashboard/technician',
    tag: `quote-${data.requestId}`,
  }),
  maintenance_quote_accepted: (data) => ({
    title: '🎉 Quote Accepted',
    body: `Facility accepted quote for #${data.requestNumber}`,
    url: '/dashboard/technician',
    tag: `quote-${data.requestId}`,
    requireInteraction: true,
  }),
  maintenance_advance_paid: (data) => ({
    title: '💵 Advance Payment Received',
    body: `Advance payment received for #${data.requestNumber}`,
    url: '/dashboard/technician',
    tag: `payment-${data.requestId}`,
  }),
  maintenance_work_started: (data) => ({
    title: '🔨 Work Started',
    body: `Technician started work on #${data.requestNumber}`,
    url: '/dashboard/facility',
    tag: `maintenance-${data.requestId}`,
  }),
  maintenance_report_submitted: (data) => ({
    title: '📝 Report Submitted',
    body: `Completion report submitted for #${data.requestNumber}`,
    url: '/dashboard/admin',
    tag: `report-${data.requestId}`,
  }),
  maintenance_report_approved: (data) => ({
    title: '✅ Report Approved',
    body: `Report approved for #${data.requestNumber}. Awaiting final payment.`,
    url: '/dashboard/facility',
    tag: `report-${data.requestId}`,
  }),
  maintenance_completed: (data) => ({
    title: '🎉 Maintenance Complete',
    body: `Request #${data.requestNumber} has been completed`,
    url: '/dashboard/facility',
    tag: `maintenance-${data.requestId}`,
  }),
  maintenance_cancelled: (data) => ({
    title: '❌ Request Cancelled',
    body: `Request #${data.requestNumber} has been cancelled`,
    url: '/dashboard',
    tag: `maintenance-${data.requestId}`,
  }),

  // Booking Notifications
  appointment_created: (data) => ({
    title: '📅 New Appointment',
    body: `New appointment booked for ${data.patientName} on ${data.date}`,
    url: '/dashboard/facility/booking',
    tag: `appointment-${data.appointmentId}`,
  }),
  appointment_confirmed: (data) => ({
    title: '✅ Appointment Confirmed',
    body: `Your appointment on ${data.date} has been confirmed`,
    url: `/patient/appointment?id=${data.appointmentId}`,
    tag: `appointment-${data.appointmentId}`,
  }),
  appointment_cancelled: (data) => ({
    title: '❌ Appointment Cancelled',
    body: `Appointment on ${data.date} has been cancelled`,
    url: '/dashboard/facility/booking',
    tag: `appointment-${data.appointmentId}`,
  }),
  appointment_reminder: (data) => ({
    title: '⏰ Appointment Reminder',
    body: `Reminder: You have an appointment on ${data.date} at ${data.time}`,
    url: `/patient/appointment?id=${data.appointmentId}`,
    tag: `reminder-${data.appointmentId}`,
    requireInteraction: true,
  }),

  // Payment Notifications
  payment_received: (data) => ({
    title: '💰 Payment Received',
    body: `Payment of ${data.amount} received successfully`,
    url: '/dashboard/payments',
    tag: `payment-${data.paymentId}`,
  }),
  payment_failed: (data) => ({
    title: '❌ Payment Failed',
    body: `Payment of ${data.amount} failed. Please try again.`,
    url: '/dashboard/payments',
    tag: `payment-${data.paymentId}`,
  }),
  withdrawal_requested: (data) => ({
    title: '💸 Withdrawal Request',
    body: `New withdrawal request of ${data.amount} from ${data.technicianName}`,
    url: '/dashboard/admin/withdrawals',
    tag: `withdrawal-${data.withdrawalId}`,
  }),
  withdrawal_processed: (data) => ({
    title: '✅ Withdrawal Processed',
    body: `Your withdrawal of ${data.amount} has been processed`,
    url: '/dashboard/technician/balance',
    tag: `withdrawal-${data.withdrawalId}`,
  }),

  // Facility Notifications
  facility_invited: (data) => ({
    title: '📧 Invitation Sent',
    body: `Invitation sent to ${data.email}`,
    url: '/dashboard/admin/facilities',
    tag: `invite-${data.facilityId}`,
  }),
  facility_registered: (data) => ({
    title: '🎉 New Facility Registered',
    body: `${data.facilityName} has joined the platform`,
    url: '/dashboard/admin/facilities',
    tag: `facility-${data.facilityId}`,
  }),
  referral_bonus_earned: (data) => ({
    title: '🎁 Referral Bonus!',
    body: `You earned a referral bonus! ${data.referredFacility} joined using your code.`,
    url: '/dashboard/facility/referrals',
    tag: `referral-${data.referralId}`,
  }),

  // Technician Notifications
  technician_invited: (data) => ({
    title: '📧 Technician Invited',
    body: `Invitation sent to ${data.email}`,
    url: '/dashboard/admin/technicians',
    tag: `invite-${data.technicianId}`,
  }),
  technician_registered: (data) => ({
    title: '🎉 New Technician Registered',
    body: `${data.technicianName} has completed registration`,
    url: '/dashboard/admin/technicians',
    tag: `technician-${data.technicianId}`,
  }),
  commission_earned: (data) => ({
    title: '💰 Commission Earned!',
    body: `You earned ${data.amount} commission from request #${data.requestNumber}`,
    url: '/dashboard/technician/balance',
    tag: `commission-${data.requestId}`,
  }),

  // System Notifications
  system_alert: (data) => ({
    title: '⚠️ System Alert',
    body: data.message,
    url: data.url || '/dashboard',
    tag: `alert-${Date.now()}`,
    requireInteraction: true,
  }),
  new_feature_request: (data) => ({
    title: '💡 New Feature Request',
    body: `New feature request: ${data.title}`,
    url: '/dashboard/admin/feature-requests',
    tag: `feature-${data.requestId}`,
  }),
  feedback_received: (data) => ({
    title: '📝 New Feedback',
    body: `New feedback received from ${data.userRole}`,
    url: '/dashboard/facility/booking/feedback',
    tag: `feedback-${data.feedbackId}`,
  }),

  energy_efficiency_alert: (data) => ({
    title: '⚡ Solar performance alert',
    body: `Production ${data.produced} vs ${data.expected} kWh on ${data.date}. Review efficiency and billing context (${data.paymentModel}).`,
    url: '/services/afya-solar?section=energy-efficiency',
    tag: `efficiency-${data.facilityId}-${data.date}`,
    requireInteraction: true,
  }),

  climate_resilience_alert: (data) => ({
    title: '🌦️ Climate resilience update',
    body: data.message || 'Climate or adaptation status changed for your site.',
    url: '/services/afya-solar?section=report',
    tag: `climate-${data.facilityId}-${Date.now()}`,
  }),
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get user ID by email
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  return user?.id || null
}

/**
 * Get all admin user IDs
 */
async function getAdminUserIds(): Promise<string[]> {
  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
  return adminUsers.map(u => u.id)
}

/**
 * Get facility user IDs
 */
async function getFacilityUserIds(facilityId: string): Promise<string[]> {
  const facilityUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.facilityId, facilityId))
  return facilityUsers.map(u => u.id)
}

/**
 * Get technician user ID by technician ID
 */
async function getTechnicianUserId(technicianId: string): Promise<string | null> {
  const [technician] = await db
    .select({ email: technicians.email })
    .from(technicians)
    .where(eq(technicians.id, technicianId))
    .limit(1)

  if (!technician?.email) return null
  return getUserIdByEmail(technician.email)
}

// ============================================
// MAIN NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send notification to specific user
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  data: Record<string, any> = {}
): Promise<boolean> {
  try {
    const config = NOTIFICATION_CONFIGS[type](data)
    const payload: PushNotificationPayload = {
      title: config.title,
      body: config.body,
      icon: config.icon || '/images/services/logo.png',
      tag: config.tag,
      requireInteraction: config.requireInteraction,
      data: {
        url: config.url,
        type,
        ...data,
      },
    }
    
    const result = await sendPushNotification(userId, payload)
    console.log(`[Notification] Sent ${type} to user ${userId}:`, result)
    return result.success > 0
  } catch (error) {
    console.error(`[Notification] Failed to send ${type} to user ${userId}:`, error)
    return false
  }
}

/**
 * Send notification to multiple users
 */
export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  data: Record<string, any> = {}
): Promise<{ success: number; failed: number }> {
  try {
    const config = NOTIFICATION_CONFIGS[type](data)
    const payload: PushNotificationPayload = {
      title: config.title,
      body: config.body,
      icon: config.icon || '/images/services/logo.png',
      tag: config.tag,
      requireInteraction: config.requireInteraction,
      data: {
        url: config.url,
        type,
        ...data,
      },
    }
    
    const result = await sendPushNotificationToUsers(userIds, payload)
    console.log(`[Notification] Sent ${type} to ${userIds.length} users:`, result)
    return result
  } catch (error) {
    console.error(`[Notification] Failed to send ${type}:`, error)
    return { success: 0, failed: userIds.length }
  }
}

/**
 * Notify all admins
 */
export async function notifyAllAdmins(
  type: NotificationType,
  data: Record<string, any> = {}
): Promise<void> {
  const adminIds = await getAdminUserIds()
  if (adminIds.length > 0) {
    await notifyUsers(adminIds, type, data)
  }
}

/**
 * Notify facility users
 */
export async function notifyFacilityUsers(
  facilityId: string,
  type: NotificationType,
  data: Record<string, any> = {}
): Promise<void> {
  const userIds = await getFacilityUserIds(facilityId)
  if (userIds.length > 0) {
    await notifyUsers(userIds, type, data)
  }
}

/**
 * Notify technician by technician ID
 */
export async function notifyTechnicianById(
  technicianId: string,
  type: NotificationType,
  data: Record<string, any> = {}
): Promise<void> {
  const userId = await getTechnicianUserId(technicianId)
  if (userId) {
    await notifyUser(userId, type, data)
  }
}

// ============================================
// CONVENIENCE FUNCTIONS FOR COMMON SCENARIOS
// ============================================

/**
 * Maintenance request created - notify admins
 */
export async function onMaintenanceRequestCreated(data: {
  requestId: string
  requestNumber: string
  facilityName: string
  facilityId: string
}): Promise<void> {
  await notifyAllAdmins('maintenance_request_created', data)
}

/**
 * Technician assigned - notify technician
 */
export async function onTechnicianAssigned(data: {
  requestId: string
  requestNumber: string
  technicianId: string
}): Promise<void> {
  try {
    // Get technician details including phone number
    const [technician] = await db
      .select()
      .from(technicians)
      .where(eq(technicians.id, data.technicianId))
      .limit(1)

    // Get maintenance request details including facility info
    const [request] = await db
      .select({
        facilityName: facilities.name,
        facilityCity: facilities.city,
        facilityRegion: facilities.region,
      })
      .from(maintenanceRequests)
      .leftJoin(facilities, eq(maintenanceRequests.facilityId, facilities.id))
      .where(eq(maintenanceRequests.id, data.requestId))
      .limit(1)

    // If technician has a phone number, send SMS
    if (technician?.phone) {
      const location = [request?.facilityCity, request?.facilityRegion].filter(Boolean).join(', ')
      const message = `New job #${data.requestNumber} assigned to you at ${request?.facilityName || 'a facility'}${location ? ` (${location})` : ''}. Login to view details.`
      
      try {
        const { sendSMS } = await import('@/lib/sms')
        await sendSMS({
          to: technician.phone,
          message,
          sender: 'Afyalink'
        })
      } catch (error) {
        console.error('Failed to send SMS notification:', error)
        // Don't throw error as we still want to send the in-app notification
      }
    }

    // Send in-app notification
    await notifyTechnicianById(data.technicianId, 'maintenance_request_assigned', {
      ...data,
      facilityName: request?.facilityName
    })
  } catch (error) {
    console.error('Error in onTechnicianAssigned:', error)
    // Still try to send the basic notification even if SMS fails
    await notifyTechnicianById(data.technicianId, 'maintenance_request_assigned', data)
  }
}

/**
 * Quote submitted - notify admins
 */
export async function onQuoteSubmitted(data: {
  requestId: string
  requestNumber: string
  amount: string
  technicianId: string
}): Promise<void> {
  await notifyAllAdmins('maintenance_quote_submitted', data)
}

/**
 * Quote approved - notify technician and facility
 */
export async function onQuoteApproved(data: {
  requestId: string
  requestNumber: string
  technicianId: string
  facilityId: string
}): Promise<void> {
  await Promise.all([
    notifyTechnicianById(data.technicianId, 'maintenance_quote_approved', data),
    notifyFacilityUsers(data.facilityId, 'maintenance_quote_approved', data),
  ])
}

/**
 * Quote accepted - notify technician
 */
export async function onQuoteAccepted(data: {
  requestId: string
  requestNumber: string
  technicianId: string
}): Promise<void> {
  await notifyTechnicianById(data.technicianId, 'maintenance_quote_accepted', data)
}

/**
 * Work started - notify facility
 */
export async function onWorkStarted(data: {
  requestId: string
  requestNumber: string
  facilityId: string
}): Promise<void> {
  await notifyFacilityUsers(data.facilityId, 'maintenance_work_started', data)
}

/**
 * Report submitted - notify admins
 */
export async function onReportSubmitted(data: {
  requestId: string
  requestNumber: string
}): Promise<void> {
  await notifyAllAdmins('maintenance_report_submitted', data)
}

/**
 * Report approved - notify facility
 */
export async function onReportApproved(data: {
  requestId: string
  requestNumber: string
  facilityId: string
}): Promise<void> {
  await notifyFacilityUsers(data.facilityId, 'maintenance_report_approved', data)
}

/**
 * Maintenance completed - notify all parties
 */
export async function onMaintenanceCompleted(data: {
  requestId: string
  requestNumber: string
  technicianId: string
  facilityId: string
}): Promise<void> {
  await Promise.all([
    notifyTechnicianById(data.technicianId, 'maintenance_completed', data),
    notifyFacilityUsers(data.facilityId, 'maintenance_completed', data),
  ])
}

/**
 * Appointment created - notify facility
 */
export async function onAppointmentCreated(data: {
  appointmentId: string
  facilityId: string
  patientName: string
  date: string
}): Promise<void> {
  await notifyFacilityUsers(data.facilityId, 'appointment_created', data)
}

/**
 * Payment received - notify relevant user
 */
export async function onPaymentReceived(data: {
  paymentId: string
  amount: string
  userId?: string
  facilityId?: string
}): Promise<void> {
  if (data.userId) {
    await notifyUser(data.userId, 'payment_received', data)
  } else if (data.facilityId) {
    await notifyFacilityUsers(data.facilityId, 'payment_received', data)
  }
}

/**
 * Commission earned - notify technician
 */
export async function onCommissionEarned(data: {
  technicianId: string
  requestId: string
  requestNumber: string
  amount: string
}): Promise<void> {
  await notifyTechnicianById(data.technicianId, 'commission_earned', data)
}

/**
 * Withdrawal processed - notify technician
 */
export async function onWithdrawalProcessed(data: {
  technicianId: string
  withdrawalId: string
  amount: string
}): Promise<void> {
  await notifyTechnicianById(data.technicianId, 'withdrawal_processed', data)
}

