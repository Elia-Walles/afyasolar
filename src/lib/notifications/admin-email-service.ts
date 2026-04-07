/**
 * Admin Email Notification Service
 * Handles sending email notifications for admin events to info@ubuntuafyalink.co.tz
 */

import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import { adminNotifications } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

// Email transporter configuration
const createTransport = () => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.titan.email'
  const smtpPort = parseInt(process.env.SMTP_PORT || '465')
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD

  if (!smtpUser || !smtpPassword) {
    console.warn('SMTP credentials not configured. Please check your .env file for SMTP_USER and SMTP_PASSWORD')
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // Use SSL for port 465, TLS for others
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates
      minVersion: 'TLSv1.2', // Specify minimum TLS version
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
    logger: process.env.NODE_ENV === 'development', // Enable logger in development
  })
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

/**
 * Generate admin email template based on notification type
 */
function generateAdminEmailTemplate(
  type: string,
  data: {
    title: string
    message: string
    serviceName?: string
    facilityName?: string
    amount?: string
    actionUrl?: string
    actionLabel?: string
    priority?: string
  }
): EmailTemplate {
  const appName = 'Ubuntu Afya Link Admin'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://afyasolar.ubuntuafyalink.co.tz'
  
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444'
      case 'high': return '#f59e0b'
      case 'normal': return '#3b82f6'
      case 'low': return '#6b7280'
      default: return '#3b82f6'
    }
  }

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '🚨'
      case 'high': return '⚠️'
      case 'normal': return 'ℹ️'
      case 'low': return '📝'
      default: return 'ℹ️'
    }
  }

  const baseStyles = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f8fafc;
  `

  const headerStyles = `
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    color: white;
    padding: 30px;
    text-align: center;
    border-radius: 12px 12px 0 0;
  `

  const contentStyles = `
    background: white;
    padding: 30px;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `

  const buttonStyles = `
    display: inline-block;
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    color: white;
    padding: 14px 28px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin-top: 20px;
  `

  const priorityBadge = `
    display: inline-block;
    background: ${getPriorityColor(data.priority)};
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 15px;
  `

  const subject = `${getPriorityIcon(data.priority)} ${data.title} - ${appName}`

  const content = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 48px;">${getPriorityIcon(data.priority)}</span>
    </div>
    <div style="${priorityBadge}">
      ${data.priority || 'normal'} priority
    </div>
    <h2 style="color: #1e40af; text-align: center; margin-bottom: 20px;">${data.title}</h2>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">${data.message}</p>
    ${data.serviceName ? `<p><strong>Service:</strong> ${data.serviceName}</p>` : ''}
    ${data.facilityName ? `<p><strong>Facility:</strong> ${data.facilityName}</p>` : ''}
    ${data.amount ? `<p><strong>Amount:</strong> TSh ${data.amount}</p>` : ''}
  `

  // Add additional details for invoice requests
  const additionalDetails = type === 'invoice_request' ? `
    <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 8px;">
      <h3 style="color: #0284c7; margin: 0 0 10px 0; font-size: 16px;">📋 Invoice Request Details</h3>
      <p style="color: #334155; font-size: 14px; margin: 8px 0;">Please process this invoice request and send the invoice to the facility. The facility has chosen to pay by invoice instead of online payment.</p>
      ${data.facilityName ? `<p style="color: #334155; font-size: 14px; margin: 4px 0;"><strong>Next Steps:</strong> Prepare and send invoice to facility</p>` : ''}
    </div>
  ` : ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles}">
      <div style="${headerStyles}">
        <h1 style="margin: 0; font-size: 24px;">${appName}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">System Notifications</p>
      </div>
      <div style="${contentStyles}">
        ${content}
        ${additionalDetails}
        ${data.actionUrl ? `
          <div style="text-align: center; margin-top: 30px;">
            <a href="${appUrl}${data.actionUrl}" style="${buttonStyles}">
              ${data.actionLabel || 'View Details'}
            </a>
          </div>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          This is an automated admin notification from ${appName}. 
          Please review and take appropriate action if needed.
        </p>
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `

  const textContent = `
${data.message}

${data.serviceName ? `Service: ${data.serviceName}` : ''}
${data.facilityName ? `Facility: ${data.facilityName}` : ''}
${data.amount ? `Amount: TSh ${data.amount}` : ''}

${type === 'invoice_request' ? `
📋 Invoice Request Details:
Please process this invoice request and send the invoice to the facility. The facility has chosen to pay by invoice instead of online payment.

Next Steps: Prepare and send invoice to facility
` : ''}
`

  const text = `
${appName}

${getPriorityIcon(data.priority)} ${data.title}

${textContent}

${data.actionUrl ? `View Details: ${appUrl}${data.actionUrl}` : ''}

---
This is an automated admin notification from ${appName}.
© ${new Date().getFullYear()} ${appName}. All rights reserved.
  `.trim()

  return { subject, html, text }
}

/**
 * Send admin email notification
 */
export async function sendAdminEmailNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get notification details
    const [notification] = await db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.id, notificationId))
      .limit(1)

    if (!notification) {
      return { success: false, error: 'Notification not found' }
    }

    if (!notification.sendEmail) {
      return { success: false, error: 'Email not enabled for this notification' }
    }

    // Extract facility name from metadata if available
    const facilityName = (notification.metadata as any)?.facility?.name || 
                      (notification.metadata as any)?.user?.name ||
                      'System'

    // Generate email template
    const template = generateAdminEmailTemplate(notification.type, {
      title: notification.title,
      message: notification.message,
      serviceName: notification.serviceName || undefined,
      facilityName: facilityName,
      amount: (notification.metadata as any)?.amount || undefined,
      actionUrl: notification.actionUrl || undefined,
      actionLabel: notification.actionLabel || undefined,
      priority: notification.priority,
    })

    // Send email to admin(s)
    const transporter = createTransport()
    
    if (!transporter) {
      return { success: false, error: 'SMTP not configured' }
    }

    // Determine recipients based on notification type
    let recipients = ['info@ubuntuafyalink.co.tz']
    
    // For invoice requests, also send to account@ubuntuafyalink.co.tz
    if (notification.type === 'invoice_request') {
      recipients.push('account@ubuntuafyalink.co.tz')
    }
    
    // Set reply-to for invoice requests to facility email
    const replyTo = notification.type === 'invoice_request' 
      ? (notification.metadata as any)?.facility?.email || undefined
      : undefined
    
    // Get SMTP config for logging and sending
    const smtpHost = process.env.SMTP_HOST || 'smtp.titan.email'
    const smtpPort = parseInt(process.env.SMTP_PORT || '465')
    const smtpUser = process.env.SMTP_USER

    console.log('📧 Attempting to send admin email notification...')
    console.log(`📧 SMTP Config: Host=${smtpHost}, Port=${smtpPort}, User=${smtpUser}`)
    
    try {
      await transporter.sendMail({
        from: `"Ubuntu Afya Link System" <${smtpUser}>`,
        to: recipients.join(', '),
        subject: template.subject,
        text: template.text,
        html: template.html,
        replyTo,
      })
      
      console.log(`✅ Admin email sent successfully to ${recipients.join(', ')} for notification ${notificationId}`)
    } catch (emailError) {
      console.error('❌ Failed to send email:', emailError)
      throw emailError
    }

    // Update notification with email sent timestamp
    await db
      .update(adminNotifications)
      .set({
        emailSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminNotifications.id, notificationId))

    console.log(`✅ Admin email sent successfully to info@ubuntuafyalink.co.tz for notification ${notificationId}`)
    
    return { success: true }
  } catch (error: any) {
    console.error('Error sending admin email notification:', error)

    // Update notification with error
    await db
      .update(adminNotifications)
      .set({
        emailError: error.message || 'Failed to send email',
        updatedAt: new Date(),
      })
      .where(eq(adminNotifications.id, notificationId))

    return { success: false, error: error.message }
  }
}

/**
 * Process pending admin email notifications
 * Can be called by a cron job
 */
export async function processPendingAdminEmailNotifications(): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  // Get notifications that need email sending
  const pendingNotifications = await db
    .select()
    .from(adminNotifications)
    .where(eq(adminNotifications.sendEmail, true))
    .limit(50) // Process in batches

  let successful = 0
  let failed = 0

  for (const notification of pendingNotifications) {
      // Only send if email hasn't been sent yet and there's no error
      if (!notification.emailSentAt && !notification.emailError) {
      const result = await sendAdminEmailNotification(notification.id)
      if (result.success) {
        successful++
      } else {
        failed++
      }
      
      // Add small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return {
    processed: pendingNotifications.length,
    successful,
    failed,
  }
}
