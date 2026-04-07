import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deviceAlerts, deviceHealth, devices, facilities } from '@/lib/db/schema'
import { eq, and, desc, lt, gte } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

interface NotificationRequest {
  alertId: string
  channel: 'email' | 'sms' | 'in-app' | 'webhook'
  recipient: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata?: any
}

/**
 * POST /api/admin/alert-system/notify
 * Process and send alert notifications
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Simple authentication for automated systems
    if (authHeader !== `Bearer ${process.env.ALERT_SYSTEM_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { alertIds, channels, forceSend = false } = body

    console.log(`Processing notifications for ${alertIds?.length || 0} alerts`)

    const results = []

    for (const alertId of alertIds) {
      try {
        // Get alert details
        const alert = await db
          .select()
          .from(deviceAlerts)
          .where(eq(deviceAlerts.id, alertId))
          .limit(1)

        if (alert.length === 0) {
          results.push({
            alertId,
            success: false,
            error: 'Alert not found'
          })
          continue
        }

        const alertData = alert[0]

        // Check if notification was already sent recently
        if (!forceSend && await wasNotificationRecentlySent(alertId, channels)) {
          results.push({
            alertId,
            success: false,
            error: 'Notification already sent recently'
          })
          continue
        }

        // Get device and facility information
        const deviceInfo = await db
          .select({
            device: devices,
            facility: facilities
          })
          .from(devices)
          .leftJoin(facilities, eq(devices.facilityId, facilities.id))
          .where(eq(devices.id, alertData.deviceId))
          .limit(1)

        if (deviceInfo.length === 0) {
          results.push({
            alertId,
            success: false,
            error: 'Device information not found'
          })
          continue
        }

        const { device, facility } = deviceInfo[0]

        // Send notifications through specified channels
        const notificationResults = []
        for (const channel of channels) {
          try {
            const result = await sendNotification({
              alertId,
              channel,
              recipient: await getRecipient(channel, alertData, device, facility),
              message: buildNotificationMessage(alertData, device, facility, channel),
              severity: alertData.severity as 'low' | 'medium' | 'high' | 'critical',
              metadata: {
                alert: alertData,
                device,
                facility
              }
            })

            notificationResults.push({
              channel,
              success: true,
              result
            })

            // Log notification
            await logNotification(alertId, channel, result)

          } catch (error) {
            console.error(`Failed to send ${channel} notification:`, error)
            throw new Error(error instanceof Error ? error.message : `Failed to send ${channel} notification`)
          }
          notificationResults.push({
            channel,
            success: false,
            error: Error instanceof Error ? Error.message : 'Unknown error'
          })
        }

        results.push({
          alertId,
          success: notificationResults.some(r => r.success),
          channels: notificationResults
        })

      } catch (error) {
        console.error(`Error processing notifications for alert ${alertId}:`, error)
        results.push({
          alertId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: alertIds.length,
      results
    })

  } catch (error) {
    console.error('Notification processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process notifications' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/alert-system/notify
 * Get notification queue and status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (authHeader !== `Bearer ${process.env.ALERT_SYSTEM_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pending notifications
    const pendingNotifications = await getPendingNotifications()

    // Get notification statistics
    const stats = await getNotificationStats()

    return NextResponse.json({
      success: true,
      pending: pendingNotifications,
      stats
    })

  } catch (error) {
    console.error('Error fetching notification status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notification status' },
      { status: 500 }
    )
  }
}

/**
 * Send notification through specific channel
 */
async function sendNotification(request: NotificationRequest) {
  const { channel, recipient, message, severity, metadata } = request

  console.log(`Sending ${channel} notification to ${recipient}:`, message)

  switch (channel) {
    case 'email':
      return await sendEmailNotification(recipient, message, severity, metadata)
    
    case 'sms':
      return await sendSMSNotification(recipient, message, severity, metadata)
    
    case 'in-app':
      return await sendInAppNotification(recipient, message, severity, metadata)
    
    case 'webhook':
      return await sendWebhookNotification(recipient, message, severity, metadata)
    
    default:
      throw new Error(`Unsupported notification channel: ${channel}`)
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(recipient: string, message: string, severity: string, metadata: any) {
  // Mock email sending - replace with your email service
  console.log(`📧 Email sent to ${recipient}`)
  console.log(`Subject: Solar Alert - ${severity.toUpperCase()}`)
  console.log(`Body: ${message}`)
  
  return {
    channel: 'email',
    recipient,
    sentAt: new Date().toISOString(),
    messageId: generateId(),
    status: 'sent'
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(recipient: string, message: string, severity: string, metadata: any) {
  // Mock SMS sending - replace with your SMS service
  console.log(`📱 SMS sent to ${recipient}`)
  console.log(`Message: ${message}`)
  
  return {
    channel: 'sms',
    recipient,
    sentAt: new Date().toISOString(),
    messageId: generateId(),
    status: 'sent'
  }
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(recipient: string, message: string, severity: string, metadata: any) {
  // Store in-app notification in database
  const notificationId = generateId()
  
  // In a real implementation, you would save this to a notifications table
  console.log(`🔔 In-app notification created for ${recipient}`)
  console.log(`Message: ${message}`)
  
  return {
    channel: 'in-app',
    recipient,
    notificationId,
    sentAt: new Date().toISOString(),
    status: 'delivered'
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(recipient: string, message: string, severity: string, metadata: any) {
  // Mock webhook call - replace with actual webhook implementation
  console.log(`🔗 Webhook sent to ${recipient}`)
  console.log(`Payload:`, {
    alert: metadata.alert,
    message,
    severity,
    timestamp: new Date().toISOString()
  })
  
  return {
    channel: 'webhook',
    recipient,
    sentAt: new Date().toISOString(),
    messageId: generateId(),
    status: 'sent'
  }
}

/**
 * Get recipient for notification channel
 */
async function getRecipient(channel: string, alert: any, device: any, facility: any) {
  switch (channel) {
    case 'email':
      return facility?.email || 'admin@afyalink.com'
    
    case 'sms':
      return facility?.phone || '+250000000000'
    
    case 'in-app':
      return facility?.id || 'system'
    
    case 'webhook':
      return process.env.ALERT_WEBHOOK_URL || 'https://api.example.com/webhooks/alerts'
    
    default:
      return 'unknown'
  }
}

/**
 * Build notification message based on channel
 */
function buildNotificationMessage(alert: any, device: any, facility: any, channel: string): string {
  const facilityName = facility?.name || 'Unknown Facility'
  const deviceSerial = device?.serialNumber || 'Unknown Device'
  
  switch (channel) {
    case 'email':
      return `
        <h2>Solar Device Alert</h2>
        <p><strong>Facility:</strong> ${facilityName}</p>
        <p><strong>Device:</strong> ${deviceSerial}</p>
        <p><strong>Alert Type:</strong> ${alert.type}</p>
        <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        <p><strong>Time:</strong> ${new Date(alert.triggeredAt).toLocaleString()}</p>
        <hr>
        <p><small>This is an automated alert from the Afya Solar monitoring system.</small></p>
      `.trim()
    
    case 'sms':
      return `ALERT: ${alert.title} at ${facilityName}. Device: ${deviceSerial}. ${alert.message}. Severity: ${alert.severity.toUpperCase()}`
    
    case 'in-app':
      return `${alert.title} - ${alert.message}`
    
    case 'webhook':
      return JSON.stringify({
        alert,
        device,
        facility,
        timestamp: new Date().toISOString()
      })
    
    default:
      return alert.message
  }
}

/**
 * Check if notification was recently sent
 */
async function wasNotificationRecentlySent(alertId: string, channels: string[]): Promise<boolean> {
  // In a real implementation, you would check a notification log table
  // For now, return false to allow all notifications
  return false
}

/**
 * Log notification
 */
async function logNotification(alertId: string, channel: string, result: any) {
  // In a real implementation, you would save this to a notification log table
  console.log(`Notification logged: Alert ${alertId}, Channel ${channel}, Result:`, result)
}

/**
 * Get pending notifications
 */
async function getPendingNotifications() {
  // In a real implementation, you would fetch from a notification queue table
  return []
}

/**
 * Get notification statistics
 */
async function getNotificationStats() {
  // In a real implementation, you would calculate from notification logs
  return {
    totalSent: 0,
    sentToday: 0,
    sentByChannel: {
      email: 0,
      sms: 0,
      'in-app': 0,
      webhook: 0
    },
    failedNotifications: 0,
    averageDeliveryTime: 0
  }
}
