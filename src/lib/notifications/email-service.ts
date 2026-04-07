/**
 * Email Notification Service
 * Handles sending email notifications for payment and subscription events
 */

import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import { facilityNotifications, facilities, users } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.titan.email',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // Use SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

/**
 * Generate email template based on notification type
 */
function generateEmailTemplate(
  type: string,
  data: {
    facilityName: string
    serviceName?: string
    amount?: number
    message: string
    actionUrl?: string
    actionLabel?: string
    expiryDate?: Date
  }
): EmailTemplate {
  const appName = 'Ubuntu Afya Link'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://afyasolar.ubuntuafyalink.co.tz'
  
  const formatAmount = (amount: number) => `TZS ${amount.toLocaleString()}`
  const formatDate = (date: Date) => new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const baseStyles = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f8fafc;
  `

  const headerStyles = `
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 14px 28px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin-top: 20px;
  `

  let subject = ''
  let content = ''

  switch (type) {
    case 'payment_completed':
      subject = `✅ Payment Successful - ${data.serviceName}`
      content = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 64px;">✅</span>
        </div>
        <h2 style="color: #10b981; text-align: center; margin-bottom: 20px;">Payment Successful!</h2>
        <p>Dear ${data.facilityName},</p>
        <p>${data.message}</p>
        ${data.amount ? `<p style="font-size: 24px; font-weight: bold; color: #10b981; text-align: center;">${formatAmount(data.amount)}</p>` : ''}
        <p>Your subscription is now active. You can access the ${data.serviceName} dashboard immediately.</p>
      `
      break

    case 'payment_failed':
      subject = `❌ Payment Failed - ${data.serviceName}`
      content = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 64px;">❌</span>
        </div>
        <h2 style="color: #ef4444; text-align: center; margin-bottom: 20px;">Payment Failed</h2>
        <p>Dear ${data.facilityName},</p>
        <p>${data.message}</p>
        <p>Please try again or contact support if you continue to experience issues.</p>
      `
      break

    case 'subscription_expiring':
      subject = `⚠️ Subscription Expiring Soon - ${data.serviceName}`
      content = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 64px;">⏰</span>
        </div>
        <h2 style="color: #f59e0b; text-align: center; margin-bottom: 20px;">Subscription Expiring Soon</h2>
        <p>Dear ${data.facilityName},</p>
        <p>${data.message}</p>
        ${data.expiryDate ? `<p style="font-weight: bold;">Expiry Date: ${formatDate(data.expiryDate)}</p>` : ''}
        <p>Please renew your subscription to continue enjoying uninterrupted access to ${data.serviceName}.</p>
      `
      break

    case 'subscription_expired':
      subject = `🔒 Subscription Expired - ${data.serviceName}`
      content = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 64px;">🔒</span>
        </div>
        <h2 style="color: #ef4444; text-align: center; margin-bottom: 20px;">Subscription Expired</h2>
        <p>Dear ${data.facilityName},</p>
        <p>${data.message}</p>
        <p>Your access to ${data.serviceName} has been restricted. Please renew your subscription to regain access.</p>
      `
      break

    case 'access_restricted':
      subject = `🔒 Access Restricted - ${data.serviceName}`
      content = `
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 64px;">🔒</span>
        </div>
        <h2 style="color: #ef4444; text-align: center; margin-bottom: 20px;">Access Restricted</h2>
        <p>Dear ${data.facilityName},</p>
        <p>${data.message}</p>
        <p>Please complete payment to restore your access.</p>
      `
      break

    default:
      subject = `${appName} Notification`
      content = `
        <p>Dear ${data.facilityName},</p>
        <p>${data.message}</p>
      `
  }

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
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Healthcare Solutions</p>
      </div>
      <div style="${contentStyles}">
        ${content}
        ${data.actionUrl ? `
          <div style="text-align: center; margin-top: 30px;">
            <a href="${appUrl}${data.actionUrl}" style="${buttonStyles}">
              ${data.actionLabel || 'Go to Dashboard'}
            </a>
          </div>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          This email was sent by ${appName}. If you have any questions, please contact support.
        </p>
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </p>
      </div>
    </body>
    </html>
  `

  const text = `
${appName}

Dear ${data.facilityName},

${data.message}

${data.actionUrl ? `Visit: ${appUrl}${data.actionUrl}` : ''}

---
This email was sent by ${appName}.
© ${new Date().getFullYear()} ${appName}. All rights reserved.
  `.trim()

  return { subject, html, text }
}

/**
 * Send email notification
 */
export async function sendEmailNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get notification details
    const [notification] = await db
      .select()
      .from(facilityNotifications)
      .where(eq(facilityNotifications.id, notificationId))
      .limit(1)

    if (!notification) {
      return { success: false, error: 'Notification not found' }
    }

    if (!notification.sendEmail) {
      return { success: false, error: 'Email not enabled for this notification' }
    }

    // Get facility details
    const [facility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, notification.facilityId))
      .limit(1)

    if (!facility || !facility.email) {
      return { success: false, error: 'Facility email not found' }
    }

    // Generate email template
    const template = generateEmailTemplate(notification.type, {
      facilityName: facility.name,
      serviceName: notification.serviceName || undefined,
      message: notification.message,
      actionUrl: notification.actionUrl || undefined,
      actionLabel: notification.actionLabel || undefined,
    })

    // Send email
    const transporter = createTransporter()
    
    await transporter.sendMail({
      from: `"Ubuntu Afya Link" <${process.env.SMTP_USER}>`,
      to: facility.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    })

    // Update notification with email sent timestamp
    await db
      .update(facilityNotifications)
      .set({
        emailSentAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(facilityNotifications.id, notificationId))

    console.log(`✅ Email sent successfully to ${facility.email} for notification ${notificationId}`)
    
    return { success: true }
  } catch (error: any) {
    console.error('Error sending email notification:', error)

    // Update notification with error
    await db
      .update(facilityNotifications)
      .set({
        emailError: error.message || 'Failed to send email',
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(facilityNotifications.id, notificationId))

    return { success: false, error: error.message }
  }
}

/**
 * Process pending email notifications
 * Can be called by a cron job
 */
export async function processPendingEmailNotifications(): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  // Get notifications that need email sending
  const pendingNotifications = await db
    .select()
    .from(facilityNotifications)
    .where(
      and(
        eq(facilityNotifications.sendEmail, true),
        sql`${facilityNotifications.emailSentAt} IS NULL`,
        sql`${facilityNotifications.emailError} IS NULL`
      )
    )
    .limit(50) // Process in batches

  let successful = 0
  let failed = 0

  for (const notification of pendingNotifications) {
    const result = await sendEmailNotification(notification.id)
    if (result.success) {
      successful++
    } else {
      failed++
    }
    
    // Add small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return {
    processed: pendingNotifications.length,
    successful,
    failed,
  }
}

