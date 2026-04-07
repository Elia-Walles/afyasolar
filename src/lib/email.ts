/**
 * Email service for sending verification emails
 * Uses nodemailer with SMTP configuration
 */

import nodemailer from 'nodemailer'
import { env } from './env'

// Create transporter (will be null if SMTP not configured)
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter
  }

  // If SMTP is not configured, return null (emails will be logged to console in dev)
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    if (env.NODE_ENV === 'development') {
      console.warn('⚠️  SMTP not configured. Email verification emails will be logged to console.')
    }
    return null
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '587'),
    secure: parseInt(env.SMTP_PORT || '587') === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  })

  return transporter
}

function getAppBaseUrl(): string {
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL.replace(/\/$/, '')
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
  }
  return ''
}

const APP_BASE_URL = getAppBaseUrl()

function renderLogoImage(size = 110, marginBottom = 16) {
  if (!APP_BASE_URL) {
    return ''
  }

  return `<img src="${APP_BASE_URL}/images/services/logo.png" alt="Ubuntu Afya Link" style="max-width: ${size}px; width: ${size}px; height: auto; display: block; margin: 0 auto ${marginBottom}px auto;" />`
}

export interface SendVerificationEmailOptions {
  to: string
  name: string
  verificationToken: string
}

export interface SendVerificationCodeEmailOptions {
  to: string
  code: string
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail({
  to,
  name,
  verificationToken,
}: SendVerificationEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Verify Your Email Address</h2>
          <p>Hello ${name},</p>
          <p>Thank you for registering with Ubuntu Afya Link! Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Verify Email</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Verify Your Email Address - Ubuntu Afya Link
    
    Hello ${name},
    
    Thank you for registering with Ubuntu Afya Link! Please verify your email address by visiting the following link:
    
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, you can safely ignore this email.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to,
    subject: 'Verify Your Email Address - Ubuntu Afya Link',
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    // In development, log the email instead of sending
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Email Verification (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Verification URL: ${verificationUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    // In production without SMTP, fail silently or log error
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending verification email:', error)
    return false
  }
}

/**
 * Send resend verification email
 */
export async function sendResendVerificationEmail({
  to,
  name,
  verificationToken,
}: SendVerificationEmailOptions): Promise<boolean> {
  // Same as sendVerificationEmail, but with different subject
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Verify Your Email Address</h2>
          <p>Hello ${name},</p>
          <p>You requested a new verification email. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Verify Email</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Verify Your Email Address - Ubuntu Afya Link
    
    Hello ${name},
    
    You requested a new verification email. Please verify your email address by visiting the following link:
    
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to,
    subject: 'Verify Your Email Address - Ubuntu Afya Link (Resend)',
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Email Verification Resend (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Verification URL: ${verificationUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending verification email:', error)
    return false
  }
}

/**
 * Send verification code email (6-digit code)
 */
export async function sendVerificationCodeEmail({
  to,
  code,
}: SendVerificationCodeEmailOptions): Promise<boolean> {
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Verify Your Email Address</h2>
          <p>Your verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px; display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px;">
              ${code}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code will expire in 5 minutes.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Verify Your Email Address - Ubuntu Afya Link
    
    Your verification code is: ${code}
    
    This code will expire in 5 minutes.
    
    If you didn't request this code, you can safely ignore this email.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to,
    subject: 'Verify Your Email Address - Ubuntu Afya Link',
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Email Verification Code (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Verification Code: ${code}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending verification code email:', error)
    return false
  }
}

export interface SendAdminInvitationEmailOptions {
  to: string
  name: string
  invitationToken: string
}

/**
 * Send admin invitation email
 */
export async function sendAdminInvitationEmail({
  to,
  name,
  invitationToken,
}: SendAdminInvitationEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const registrationUrl = `${baseUrl}/auth/complete-registration?token=${invitationToken}`
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Admin Registration - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Complete Your Admin Registration</h2>
          <p>Hello ${name},</p>
          <p>You have been invited to become an administrator for Ubuntu Afya Link. To complete your registration, please click the button below to set your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Complete Registration</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${registrationUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This invitation link will expire in 24 hours.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Complete Your Admin Registration - Ubuntu Afya Link
    
    Hello ${name},
    
    You have been invited to become an administrator for Ubuntu Afya Link. To complete your registration, please visit the following link to set your password:
    
    ${registrationUrl}
    
    This invitation link will expire in 24 hours.
    
    If you didn't expect this invitation, you can safely ignore this email.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to,
    subject: 'Complete Your Admin Registration - Ubuntu Afya Link',
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    // In development, log the email instead of sending
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Admin Invitation Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Registration URL: ${registrationUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    // In production without SMTP, fail silently or log error
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return false
  }
}

export interface SendFacilityUserInvitationEmailOptions {
  to: string
  name: string
  invitationToken: string
  role: string
  facilityName: string
}

/**
 * Send facility user invitation email
 */
export async function sendFacilityUserInvitationEmail({
  to,
  name,
  invitationToken,
  role,
  facilityName,
}: SendFacilityUserInvitationEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const registrationUrl = `${baseUrl}/auth/complete-facility-user-registration?token=${invitationToken}`
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Join ${facilityName} - Afya Solar</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Afya Solar</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">You're Invited to Join ${facilityName}</h2>
          <p>Hello ${name},</p>
          <p>You have been invited to join <strong>${facilityName}</strong> as a <strong>${role}</strong> on the Afya Solar platform.</p>
          <p>To complete your registration and set your password, please click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Complete Registration</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${registrationUrl}</p>
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <h3 style="color: #047857; margin-top: 0; font-size: 16px;">About Afya Solar</h3>
            <p style="color: #334155; font-size: 14px; margin: 8px 0;">Afya Solar helps healthcare facilities monitor solar systems, energy use, and installation progress.</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This invitation link will expire in 24 hours.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Join ${facilityName} - Afya Solar
    
    Hello ${name},
    
    You have been invited to join ${facilityName} as a ${role} on the Afya Solar platform.
    
    To complete your registration and set your password, please visit the following link:
    
    ${registrationUrl}
    
    This invitation link will expire in 24 hours.
    
    If you didn't expect this invitation, you can safely ignore this email.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Afya Solar <${env.SMTP_USER}>`,
    to,
    subject: `Join ${facilityName} - Afya Solar Invitation`,
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    // In development, log email instead of sending
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Facility User Invitation Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Registration URL: ${registrationUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    // In production without SMTP, fail silently or log error
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending facility user invitation email:', error)
    return false
  }
}

export interface SendFacilityInvitationEmailOptions {
  to: string
  facilityName: string
  invitationToken: string
  referrerFacilityName?: string // Name of facility that referred this one (for referral program)
  referralCode?: string // Referral code used
}

/**
 * Send facility invitation email
 */
export async function sendFacilityInvitationEmail({
  to,
  facilityName,
  invitationToken,
  referrerFacilityName,
  referralCode,
}: SendFacilityInvitationEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const registrationUrl = referralCode 
    ? `${baseUrl}/auth/accept-invitation?token=${invitationToken}&ref=${referralCode}`
    : `${baseUrl}/auth/accept-invitation?token=${invitationToken}`
  const headerLogo = renderLogoImage(120, 18)
  
  // Referral message section
  const referralMessage = referrerFacilityName 
    ? `
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 8px;">
                      <p style="color: #92400e; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">🎉 Special Referral Invitation!</p>
                      <p style="color: #78350f; font-size: 15px; line-height: 1.6; margin: 0;">
                        You have been invited by <strong style="color: #92400e;">${referrerFacilityName}</strong> to join Ubuntu AfyaLink!
                      </p>
                      ${referralCode ? `<p style="color: #78350f; font-size: 14px; margin: 8px 0 0 0;">Referral Code: <strong style="color: #92400e;">${referralCode}</strong></p>` : ''}
                    </div>
    `
    : ''
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Ubuntu AfyaLink - Exclusive Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                    ${headerLogo}
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Ubuntu AfyaLink</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                      Hello <strong style="color: #059669;">${facilityName}</strong>! Karibu to Ubuntu AfyaLink, the platform built to help your facility increase revenue, cut costs, and operate more sustainably.
                    </p>
                    ${referralMessage}
                    <p style="color: #111827; font-size: 18px; font-weight: 600; line-height: 1.6; margin: 24px 0 16px 0;">
                      This is exclusive invitation for <strong style="color: #059669;">${facilityName}</strong>!
                    </p>
                    
                    <!-- AfyaSolar Section -->
                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 8px;">
                      <h3 style="color: #d97706; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">AfyaSolar — Cut Electrical Costs & Power Your Facility Reliably</h3>
                      <ul style="color: #374151; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px;">Full sustainability & energy efficiency assessment</li>
                        <li style="margin-bottom: 8px;">Solar systems for off-grid and on-grid facilities.</li>
                        <li style="margin-bottom: 8px;">Reduce energy costs by 30–50%</li>
                        <li style="margin-bottom: 8px;">Flexible financing for energy systems AND medical consumables</li>
                      </ul>
                      <div style="margin: 16px 0 0 0; text-align: center;">
                        <p style="color: #d97706; font-size: 15px; margin: 0 0 12px 0; font-weight: 500;">👉Secure reliable power and save money every month.</p>
                        <a href="${registrationUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);">Activate Your Account Now</a>
                      </div>
                    </div>
                    
                    <!-- CTA Section -->
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 32px 24px; margin: 32px 0; border-radius: 12px; text-align: center; border: 2px solid #10b981;">
                      <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 22px; font-weight: 700;">Ready to Elevate Your Facility?</h2>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                        Complete your registration and start using our services today!
                      </p>
                      <a href="${registrationUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); letter-spacing: 0.5px; transition: all 0.3s ease;">
                        🚀 Activate Your Account Now
                      </a>
                      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                        For quick questions, contact us anytime at <span style="color: #059669; font-weight: 600;">+255 656 721 324</span>
                      </p>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 24px 0 0 0; text-align: center; font-weight: 500;">
                      Karibu sana
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Ubuntu AfyaLink. All rights reserved.<br />
                      <span style="color: #d1d5db;">This is an automated email, please do not reply.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const referralTextMessage = referrerFacilityName
    ? `
    
    🎉 Special Referral Invitation!
    You have been invited by ${referrerFacilityName} to join Ubuntu AfyaLink!
    ${referralCode ? `Referral Code: ${referralCode}` : ''}
    `
    : ''

  const text = `
    Hello ${facilityName}! Karibu to Ubuntu AfyaLink, the platform built to help your facility increase revenue, cut costs, and operate more sustainably.
    ${referralTextMessage}
    This is exclusive invitation for ${facilityName}!

    AfyaSolar — Cut Electrical Costs & Power Your Facility Reliably
    • Full sustainability & energy efficiency assessment
    • Solar systems for off-grid and on-grid facilities.
    • Reduce energy costs by 30–50%
    • Flexible financing for energy systems AND medical consumables
    👉Secure reliable power and save money every month.
    Activate your account: ${registrationUrl}

    Ready to Elevate Your Facility?

    🚀 ACTIVATE YOUR ACCOUNT NOW: ${registrationUrl}

    For quick questions, contact us anytime: +255 656 721 324

    Karibu sana

    © ${new Date().getFullYear()} Ubuntu AfyaLink. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu AfyaLink <${env.SMTP_USER}>`,
    to,
    subject: `Welcome to Ubuntu AfyaLink - Exclusive Invitation for ${facilityName}`,
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Facility Invitation Email (Development Mode - SMTP not configured):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Invitation URL: ${registrationUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('⚠️  To actually send emails, configure SMTP settings in .env.local:')
      console.log('   SMTP_HOST=your-smtp-host')
      console.log('   SMTP_PORT=587')
      console.log('   SMTP_USER=your-email@example.com')
      console.log('   SMTP_PASSWORD=your-password')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true // Return true in dev mode so development can continue
    }
    console.error(`❌ Cannot send email to ${to}: SMTP not configured`)
    console.error('Please configure SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)')
    return false
  }

  try {
    const info = await emailTransporter.sendMail(mailOptions)
    console.log(`✅ Facility invitation email sent successfully to ${to}. MessageId: ${info.messageId}`)
    return true
  } catch (error: any) {
    console.error(`❌ Error sending facility invitation email to ${to}:`, error)
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    })
    return false
  }
}

export interface SendBulkFacilityInvitationEmailOptions {
  to: string
  facilityName: string
}

/**
 * Send bulk facility invitation email (redirects to signup page)
 */
export async function sendBulkFacilityInvitationEmail({
  to,
  facilityName,
}: SendBulkFacilityInvitationEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const signupUrl = `${baseUrl}/auth/signup`
  const headerLogo = renderLogoImage(120, 18)
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Ubuntu AfyaLink - Exclusive Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center" style="padding: 20px 0;">
              <table role="presentation" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                    ${headerLogo}
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Ubuntu AfyaLink</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                      Hello <strong style="color: #059669;">${facilityName}</strong>! Karibu to Ubuntu AfyaLink, the platform built to help your facility increase revenue, cut costs, and operate more sustainably.
                    </p>
                    
                    <p style="color: #111827; font-size: 18px; font-weight: 600; line-height: 1.6; margin: 24px 0 16px 0;">
                      This is exclusive invitation for <strong style="color: #059669;">${facilityName}</strong>!
                    </p>
                    
                    <!-- AfyaSolar Section -->
                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 8px;">
                      <h3 style="color: #d97706; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">AfyaSolar — Cut Electrical Costs & Power Your Facility Reliably</h3>
                      <ul style="color: #374151; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 8px;">Full sustainability & energy efficiency assessment</li>
                        <li style="margin-bottom: 8px;">Solar systems for off-grid and on-grid facilities.</li>
                        <li style="margin-bottom: 8px;">Reduce energy costs by 30–50%</li>
                        <li style="margin-bottom: 8px;">Flexible financing for energy systems AND medical consumables</li>
                      </ul>
                      <div style="margin: 16px 0 0 0; text-align: center;">
                        <p style="color: #d97706; font-size: 15px; margin: 0 0 12px 0; font-weight: 500;">👉Secure reliable power and save money every month.</p>
                        <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);">Register Now</a>
                      </div>
                    </div>
                    
                    <!-- CTA Section -->
                    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 32px 24px; margin: 32px 0; border-radius: 12px; text-align: center; border: 2px solid #10b981;">
                      <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 22px; font-weight: 700;">Ready to Elevate Your Facility?</h2>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                        Complete your registration and start using our services today!
                      </p>
                      <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); letter-spacing: 0.5px; transition: all 0.3s ease;">
                        🚀 Register Your Facility Now
                      </a>
                      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                        For quick questions, contact us anytime at <span style="color: #059669; font-weight: 600;">+255 656 721 324</span>
                      </p>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 24px 0 0 0; text-align: center; font-weight: 500;">
                      Karibu sana
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">
                      © ${new Date().getFullYear()} Ubuntu AfyaLink. All rights reserved.<br />
                      <span style="color: #d1d5db;">This is an automated email, please do not reply.</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const text = `
    Hello ${facilityName}! Karibu to Ubuntu AfyaLink, the platform built to help your facility increase revenue, cut costs, and operate more sustainably.

    This is exclusive invitation for ${facilityName}!

    AfyaSolar — Cut Electrical Costs & Power Your Facility Reliably
    • Full sustainability & energy efficiency assessment
    • Solar systems for off-grid and on-grid facilities.
    • Reduce energy costs by 30–50%
    • Flexible financing for energy systems AND medical consumables
    👉Secure reliable power and save money every month.
    Register now: ${signupUrl}

    Ready to Elevate Your Facility?

    🚀 REGISTER YOUR FACILITY NOW: ${signupUrl}

    For quick questions, contact us anytime: +255 656 721 324

    Karibu sana

    © ${new Date().getFullYear()} Ubuntu AfyaLink. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu AfyaLink <${env.SMTP_USER}>`,
    to,
    subject: `Welcome to Ubuntu AfyaLink - Exclusive Invitation for ${facilityName}`,
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Bulk Facility Invitation Email (Development Mode - SMTP not configured):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Signup URL: ${signupUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('⚠️  To actually send emails, configure SMTP settings in .env.local:')
      console.log('   SMTP_HOST=your-smtp-host')
      console.log('   SMTP_PORT=587')
      console.log('   SMTP_USER=your-email@example.com')
      console.log('   SMTP_PASSWORD=your-password')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error(`❌ Cannot send email to ${to}: SMTP not configured`)
    console.error('Please configure SMTP settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)')
    return false
  }

  try {
    const info = await emailTransporter.sendMail(mailOptions)
    console.log(`✅ Bulk facility invitation email sent successfully to ${to}. MessageId: ${info.messageId}`)
    return true
  } catch (error: any) {
    console.error(`❌ Error sending bulk facility invitation email to ${to}:`, error)
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    })
    return false
  }
}

export interface SendTechnicianInvitationEmailOptions {
  to: string
  invitationToken: string
}

/**
 * Send technician invitation email
 */
export async function sendTechnicianInvitationEmail({
  to,
  invitationToken,
}: SendTechnicianInvitationEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const registrationUrl = `${baseUrl}/auth/complete-technician-registration?token=${invitationToken}`
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Technician Registration - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Complete Your Technician Registration</h2>
          <p>Hello,</p>
          <p>You have been invited to join Ubuntu Afya Link as a biomedical technician. To complete your registration, please click the button below to set up your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Complete Registration</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${registrationUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This invitation link will expire in 24 hours.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Complete Your Technician Registration - Ubuntu Afya Link
    
    Hello,
    
    You have been invited to join Ubuntu Afya Link as a biomedical technician. To complete your registration, please visit the following link to set up your account:
    
    ${registrationUrl}
    
    This invitation link will expire in 24 hours.
    
    If you didn't expect this invitation, you can safely ignore this email.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to,
    subject: 'Complete Your Technician Registration - Ubuntu Afya Link',
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    // In development, log the email instead of sending
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Technician Invitation Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Registration URL: ${registrationUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    // In production without SMTP, fail silently or log error
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return false
  }
}

export interface SendHelpRequestEmailOptions {
  fromEmail: string
  fromName: string
  subject: string
  message: string
  phone?: string
  facilityId?: string | null
  facilityName?: string | null
}

/**
 * Send help request email to admin
 */
export async function sendHelpRequestEmail({
  fromEmail,
  fromName,
  subject,
  message,
  phone,
  facilityId,
  facilityName,
}: SendHelpRequestEmailOptions): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@afyalink.com'
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@afyalink.com'
  const logoImg = renderLogoImage(100, 12)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Help Request - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">New Help Request</h2>
          <p><strong>From:</strong> ${fromName} (${fromEmail})</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          ${facilityName ? `<p><strong>Facility:</strong> ${facilityName}</p>` : facilityId ? `<p><strong>Facility ID:</strong> ${facilityId}</p>` : ''}
          <p><strong>Subject:</strong> ${subject}</p>
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Please respond to this request as soon as possible.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    New Help Request - Ubuntu Afya Link
    
    From: ${fromName} (${fromEmail})
    ${phone ? `Phone: ${phone}` : ''}
    ${facilityName ? `Facility: ${facilityName}` : facilityId ? `Facility ID: ${facilityId}` : ''}
    Subject: ${subject}
    
    Message:
    ${message}
    
    Please respond to this request as soon as possible.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: supportEmail,
    cc: adminEmail,
    subject: `[Help Request] ${subject} - Ubuntu Afya Link`,
    text,
    html,
    replyTo: fromEmail,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Help Request Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${supportEmail}, ${adminEmail}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`From: ${fromName} (${fromEmail})`)
      if (facilityName) {
        console.log(`Facility: ${facilityName}`)
      } else if (facilityId) {
        console.log(`Facility ID: ${facilityId}`)
      }
      console.log(`Message: ${message}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending help request email:', error)
    return false
  }
}

export interface SendPasswordResetEmailOptions {
  to: string
  name: string
  resetToken: string
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetToken,
}: SendPasswordResetEmailOptions): Promise<boolean> {
  const baseUrl = APP_BASE_URL || env.NEXTAUTH_URL || ''
  const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`
  const logoImg = renderLogoImage()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Reset Your Password</h2>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${resetUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Reset Your Password - Ubuntu Afya Link
    
    Hello ${name},
    
    We received a request to reset your password. Please visit the following link to create a new password:
    
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to,
    subject: 'Reset Your Password - Ubuntu Afya Link',
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Password Reset Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${to}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Reset URL: ${resetUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return false
  }
}

export interface SendDeviceRequestEmailOptions {
  fromEmail: string
  fromName: string
  phone: string
  facilityName: string
  deviceType: string
  quantity: number
  message?: string | null
  facilityId?: string | null
}

/**
 * Send device request email to admin
 */
export interface SendAppointmentNotificationEmailOptions {
  doctorEmail: string
  doctorName: string
  patientName: string
  patientPhone: string
  patientEmail?: string | null
  appointmentNumber: string
  appointmentDate: Date
  appointmentTime: string
  departmentName: string
  facilityName: string
  notes?: string | null
}

export interface SendPatientAppointmentConfirmationEmailOptions {
  patientEmail: string
  patientName: string
  doctorName: string
  departmentName: string
  facilityName: string
  appointmentNumber: string
  appointmentDate: Date
  appointmentTime: string
  accessCode?: string
}

/**
 * Send appointment notification email to doctor
 */
export async function sendAppointmentNotificationEmail({
  doctorEmail,
  doctorName,
  patientName,
  patientPhone,
  patientEmail,
  appointmentNumber,
  appointmentDate,
  appointmentTime,
  departmentName,
  facilityName,
  notes,
}: SendAppointmentNotificationEmailOptions): Promise<boolean> {
  const logoImg = renderLogoImage(100, 12)
  
  // Format date
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Appointment Booking - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">New Appointment Booking</h2>
          <p style="font-size: 16px;">Dear Dr. ${doctorName},</p>
          <p>You have a new appointment booking. Please find the details below:</p>
          
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 40%;">Appointment Number:</td>
                <td style="padding: 8px 0;">${appointmentNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Name:</td>
                <td style="padding: 8px 0;">${patientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Phone:</td>
                <td style="padding: 8px 0;">${patientPhone}</td>
              </tr>
              ${patientEmail ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Email:</td>
                <td style="padding: 8px 0;">${patientEmail}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Department:</td>
                <td style="padding: 8px 0;">${departmentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Facility:</td>
                <td style="padding: 8px 0;">${facilityName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                <td style="padding: 8px 0;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Time:</td>
                <td style="padding: 8px 0;">${appointmentTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0;"><span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Pending</span></td>
              </tr>
            </table>
          </div>
          
          ${notes ? `
            <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e40af;">Patient Notes:</p>
              <p style="margin: 0; white-space: pre-wrap; color: #1e3a8a;">${notes}</p>
            </div>
          ` : ''}
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Please review this appointment in your dashboard and confirm or make any necessary adjustments.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    New Appointment Booking - Ubuntu Afya Link
    
    Dear Dr. ${doctorName},
    
    You have a new appointment booking. Please find the details below:
    
    Appointment Number: ${appointmentNumber}
    Patient Name: ${patientName}
    Patient Phone: ${patientPhone}
    ${patientEmail ? `Patient Email: ${patientEmail}` : ''}
    Department: ${departmentName}
    Facility: ${facilityName}
    Date: ${formattedDate}
    Time: ${appointmentTime}
    Status: Pending
    
    ${notes ? `Patient Notes:\n${notes}` : ''}
    
    Please review this appointment in your dashboard and confirm or make any necessary adjustments.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: doctorEmail,
    subject: `New Appointment Booking - ${appointmentNumber} - Ubuntu Afya Link`,
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Appointment Notification Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${doctorEmail}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Doctor: Dr. ${doctorName}`)
      console.log(`Patient: ${patientName} (${patientPhone})`)
      console.log(`Appointment: ${appointmentNumber}`)
      console.log(`Date: ${formattedDate}`)
      console.log(`Time: ${appointmentTime}`)
      console.log(`Department: ${departmentName}`)
      console.log(`Facility: ${facilityName}`)
      if (notes) {
        console.log(`Notes: ${notes}`)
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending appointment notification email:', error)
    return false
  }
}

/**
 * Send appointment confirmation email to patient
 */
export async function sendPatientAppointmentConfirmationEmail({
  patientEmail,
  patientName,
  doctorName,
  departmentName,
  facilityName,
  appointmentNumber,
  appointmentDate,
  appointmentTime,
  accessCode,
}: SendPatientAppointmentConfirmationEmailOptions): Promise<boolean> {
  const logoImg = renderLogoImage(100, 12)
  
  // Format date
  const formattedDate = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmed - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Appointment Confirmed! ✅</h2>
          <p style="font-size: 16px;">Dear ${patientName},</p>
          <p>Your appointment has been successfully confirmed. Please find the details below:</p>
          
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 40%;">Appointment Number:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 16px; color: #059669;">${appointmentNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Doctor:</td>
                <td style="padding: 8px 0;">Dr. ${doctorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Department:</td>
                <td style="padding: 8px 0;">${departmentName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Facility:</td>
                <td style="padding: 8px 0;">${facilityName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                <td style="padding: 8px 0;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Time:</td>
                <td style="padding: 8px 0;">${appointmentTime}</td>
              </tr>
              ${accessCode ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Access Code:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 16px; color: #059669; font-weight: bold;">${accessCode}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          ${accessCode ? `
            <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e40af;">📱 Access Your Appointment Online</p>
              <p style="margin: 0; color: #1e3a8a;">Use your access code <strong>${accessCode}</strong> to view and manage your appointment online.</p>
            </div>
          ` : ''}
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e; font-weight: bold;">⏰ Important Reminder</p>
            <p style="margin: 8px 0 0 0; color: #78350f;">Please arrive 10 minutes early for your appointment.</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you need to reschedule or cancel your appointment, please contact ${facilityName} as soon as possible.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    Appointment Confirmed - Ubuntu Afya Link
    
    Dear ${patientName},
    
    Your appointment has been successfully confirmed. Please find the details below:
    
    Appointment Number: ${appointmentNumber}
    Doctor: Dr. ${doctorName}
    Department: ${departmentName}
    Facility: ${facilityName}
    Date: ${formattedDate}
    Time: ${appointmentTime}
    ${accessCode ? `Access Code: ${accessCode}` : ''}
    
    ${accessCode ? `\nUse your access code ${accessCode} to view and manage your appointment online.\n` : ''}
    
    Important Reminder: Please arrive 10 minutes early for your appointment.
    
    If you need to reschedule or cancel your appointment, please contact ${facilityName} as soon as possible.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: patientEmail,
    subject: `Appointment Confirmed - ${appointmentNumber} - ${facilityName}`,
    text,
    html,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Patient Appointment Confirmation Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${patientEmail}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Patient: ${patientName}`)
      console.log(`Doctor: Dr. ${doctorName}`)
      console.log(`Appointment: ${appointmentNumber}`)
      console.log(`Date: ${formattedDate}`)
      console.log(`Time: ${appointmentTime}`)
      console.log(`Department: ${departmentName}`)
      console.log(`Facility: ${facilityName}`)
      if (accessCode) {
        console.log(`Access Code: ${accessCode}`)
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending patient appointment confirmation email:', error)
    return false
  }
}

export async function sendDeviceRequestEmail({
  fromEmail,
  fromName,
  phone,
  facilityName,
  deviceType,
  quantity,
  message,
  facilityId,
}: SendDeviceRequestEmailOptions): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'info@ubuntuafyalink.co.tz'
  const supportEmail = process.env.SUPPORT_EMAIL || 'info@ubuntuafyalink.co.tz'
  const logoImg = renderLogoImage(100, 12)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Device Request - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">New Device Request</h2>
          <p><strong>From:</strong> ${fromName} (${fromEmail})</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Facility:</strong> ${facilityName}</p>
          ${facilityId ? `<p><strong>Facility ID:</strong> ${facilityId}</p>` : ''}
          <p><strong>Device Type:</strong> ${deviceType}</p>
          <p><strong>Quantity:</strong> ${quantity}</p>
          ${message ? `
            <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
          ` : ''}
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Please review and process this device request.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    New Device Request - Ubuntu Afya Link
    
    From: ${fromName} (${fromEmail})
    Phone: ${phone}
    Facility: ${facilityName}
    ${facilityId ? `Facility ID: ${facilityId}` : ''}
    Device Type: ${deviceType}
    Quantity: ${quantity}
    
    ${message ? `Message:\n${message}` : ''}
    
    Please review and process this device request.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: supportEmail,
    cc: adminEmail,
    subject: `[Device Request] ${quantity} ${deviceType}(s) - ${facilityName} - Ubuntu Afya Link`,
    text,
    html,
    replyTo: fromEmail,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Device Request Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${supportEmail}, ${adminEmail}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`From: ${fromName} (${fromEmail})`)
      console.log(`Facility: ${facilityName}`)
      console.log(`Device: ${quantity} ${deviceType}(s)`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Error sending device request email:', error)
    return false
  }
}

export interface SendFeatureRequestEmailOptions {
  facilityName: string
  facilityEmail: string
  serviceName: string
  title: string
  description: string
  priority: string
  requestId: string
}

/**
 * Send feature request notification email to admin
 */
export async function sendFeatureRequestEmail({
  facilityName,
  facilityEmail,
  serviceName,
  title,
  description,
  priority,
  requestId,
}: SendFeatureRequestEmailOptions): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@afyalink.com'
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@afyalink.com'
  const baseUrl = getAppBaseUrl()
  const adminDashboardUrl = `${baseUrl}/dashboard/admin`
  const logoImg = renderLogoImage(100, 12)

  const serviceDisplayNames: Record<string, string> = {
    'afya-solar': 'Afya Solar',
  }

  const priorityColors: Record<string, string> = {
    low: '#6b7280',
    medium: '#f59e0b',
    high: '#ef4444',
  }

  const serviceDisplayName = serviceDisplayNames[serviceName] || serviceName

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Feature Request - Ubuntu Afya Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">New Feature Request</h2>
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0;"><strong>Service:</strong> ${serviceDisplayName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Title:</strong> ${title}</p>
            <p style="margin: 0 0 10px 0;"><strong>Priority:</strong> <span style="color: ${priorityColors[priority] || '#6b7280'}; font-weight: bold; text-transform: uppercase;">${priority}</span></p>
            <p style="margin: 0 0 10px 0;"><strong>Facility:</strong> ${facilityName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility Email:</strong> ${facilityEmail}</p>
            <p style="margin: 0 0 10px 0;"><strong>Request ID:</strong> ${requestId}</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Description:</p>
            <p style="margin: 0; white-space: pre-wrap;">${description}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${adminDashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Admin Dashboard</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Please review this feature request in the admin dashboard.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
    New Feature Request - Ubuntu Afya Link
    
    Service: ${serviceDisplayName}
    Title: ${title}
    Priority: ${priority.toUpperCase()}
    Facility: ${facilityName}
    Facility Email: ${facilityEmail}
    Request ID: ${requestId}
    
    Description:
    ${description}
    
    View in Admin Dashboard: ${adminDashboardUrl}
    
    Please review this feature request in the admin dashboard.
    
    © ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: supportEmail,
    cc: adminEmail,
    subject: `[Feature Request] ${serviceDisplayName} - ${title} - ${facilityName}`,
    text,
    html,
    replyTo: facilityEmail,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Feature Request Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${supportEmail}, ${adminEmail}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`From: ${facilityName} (${facilityEmail})`)
      console.log(`Service: ${serviceDisplayName}`)
      console.log(`Title: ${title}`)
      console.log(`Priority: ${priority}`)
      console.log(`Request ID: ${requestId}`)
      console.log(`Description: ${description}`)
      console.log(`Admin Dashboard: ${adminDashboardUrl}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    console.log(`✅ Feature request email sent successfully to ${supportEmail}, ${adminEmail}`)
    return true
  } catch (error) {
    console.error('Error sending feature request email:', error)
    return false
  }
}

const COMPANY_EMAIL = 'info@ubuntuafyalink.co.tz'

export interface SendAfyaSolarInvoiceRequestEmailOptions {
  facilityName: string
  facilityEmail: string | null
  facilityPhone: string | null
  packageName: string
  packageId: string
  paymentPlan: string
  amount: string
  currency: string
  packageMetadata?: Record<string, unknown>
  requestId: string
}

/**
 * Send Afya Solar invoice request notification to company emails (info@ubuntuafyalink.co.tz and account@ubuntuafyalink.co.tz)
 */
export async function sendAfyaSolarInvoiceRequestEmail({
  facilityName,
  facilityEmail,
  facilityPhone,
  packageName,
  packageId,
  paymentPlan,
  amount,
  currency,
  packageMetadata,
  requestId,
}: SendAfyaSolarInvoiceRequestEmailOptions): Promise<boolean> {
  const logoImg = renderLogoImage(100, 12)

  const metadataRows = packageMetadata && Object.keys(packageMetadata).length > 0
    ? Object.entries(packageMetadata)
        .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;">${k}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>`)
        .join('')
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Afya Solar - Invoice Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Afya Solar – Pay By Invoice Request</h2>
          <p>A facility has requested to pay by invoice for an Afya Solar package.</p>
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility:</strong> ${facilityName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility Email:</strong> ${facilityEmail || '—'}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility Phone:</strong> ${facilityPhone || '—'}</p>
            <p style="margin: 0 0 10px 0;"><strong>Package:</strong> ${packageName} (ID: ${packageId})</p>
            <p style="margin: 0 0 10px 0;"><strong>Payment Plan:</strong> ${paymentPlan}</p>
            <p style="margin: 0 0 10px 0;"><strong>Amount:</strong> ${currency} ${amount}</p>
          </div>
          ${metadataRows ? `
          <div style="background: white; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Package details</p>
            <table style="width:100%; border-collapse: collapse; font-size: 14px;">
              ${metadataRows}
            </table>
          </div>
          ` : ''}
          <p style="color: #6b7280; font-size: 14px;">Please process this invoice request and send the invoice to the facility.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
Afya Solar – Pay By Invoice Request

Request ID: ${requestId}
Facility: ${facilityName}
Facility Email: ${facilityEmail || '—'}
Facility Phone: ${facilityPhone || '—'}
Package: ${packageName} (ID: ${packageId})
Payment Plan: ${paymentPlan}
Amount: ${currency} ${amount}

Please process this invoice request and send the invoice to the facility.

© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `.trim()

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: `${COMPANY_EMAIL}, account@ubuntuafyalink.co.tz`,
    subject: `[Afya Solar] Invoice Request – ${facilityName} – ${packageName} – ${currency} ${amount}`,
    text,
    html,
    replyTo: facilityEmail || undefined,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Afya Solar Invoice Request Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${COMPANY_EMAIL}, account@ubuntuafyalink.co.tz`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Request ID: ${requestId}`)
      console.log(`Facility: ${facilityName}`)
      console.log(`Package: ${packageName}, Amount: ${currency} ${amount}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    console.log(`✅ Afya Solar invoice request email sent to ${COMPANY_EMAIL} and account@ubuntuafyalink.co.tz`)
    return true
  } catch (error) {
    console.error('Error sending Afya Solar invoice request email:', error)
    return false
  }
}

export interface SendLegacyInvoiceRequestEmailOptions {
  facilityName: string
  facilityEmail: string | null
  facilityPhone: string | null
  packageName: string
  packageCode: string
  billingCycle: string
  amount: string
  currency: string
  packageMetadata?: Record<string, unknown>
  requestId: string
}

/**
 * Send legacy invoice request notification to company emails.
 */
export async function sendLegacyInvoiceRequestEmail({
  facilityName,
  facilityEmail,
  facilityPhone,
  packageName,
  packageCode,
  billingCycle,
  amount,
  currency,
  packageMetadata,
  requestId,
}: SendLegacyInvoiceRequestEmailOptions): Promise<boolean> {
  const logoImg = renderLogoImage(100, 12)

  const metadataRows = packageMetadata && Object.keys(packageMetadata).length > 0
    ? Object.entries(packageMetadata)
        .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;">${k}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>`)
        .join('')
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Pay By Invoice Request</h2>
          <p>A facility has requested to pay by invoice.</p>
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility:</strong> ${facilityName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility Email:</strong> ${facilityEmail || '—'}</p>
            <p style="margin: 0 0 10px 0;"><strong>Facility Phone:</strong> ${facilityPhone || '—'}</p>
            <p style="margin: 0 0 10px 0;"><strong>Package:</strong> ${packageName} (${packageCode})</p>
            <p style="margin: 0 0 10px 0;"><strong>Billing Cycle:</strong> ${billingCycle}</p>
            <p style="margin: 0 0 10px 0;"><strong>Amount:</strong> ${currency} ${amount}</p>
          </div>
          ${metadataRows ? `
          <div style="background: white; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Package details</p>
            <table style="width:100%; border-collapse: collapse; font-size: 14px;">
              ${metadataRows}
            </table>
          </div>
          ` : ''}
          <p style="color: #6b7280; font-size: 14px;">Please process this invoice request and send the invoice to the facility.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
Pay By Invoice Request

Request ID: ${requestId}
Facility: ${facilityName}
Facility Email: ${facilityEmail || '—'}
Facility Phone: ${facilityPhone || '—'}
Package: ${packageName} (${packageCode})
Billing Cycle: ${billingCycle}
Amount: ${currency} ${amount}

Please process this invoice request and send the invoice to the facility.

© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.
  `.trim()

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: `${COMPANY_EMAIL}, account@ubuntuafyalink.co.tz`,
    subject: `[Invoice] Request – ${facilityName} – ${packageName} – ${currency} ${amount}`,
    text,
    html,
    replyTo: facilityEmail || undefined,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Invoice Request Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${COMPANY_EMAIL}, account@ubuntuafyalink.co.tz`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Request ID: ${requestId}`)
      console.log(`Facility: ${facilityName}`)
      console.log(`Package: ${packageName}, Amount: ${currency} ${amount}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    console.log(`✅ Invoice request email sent to ${COMPANY_EMAIL} and account@ubuntuafyalink.co.tz`)
    return true
  } catch (error) {
    console.error('Error sending invoice request email:', error)
    return false
  }
}

interface MeuDeviceSummaryLike {
  name: string
  dailyKwh: number
  shareOfTotal: number
}

interface MeuSummaryLike {
  totalDailyLoad: number
  topDevices: MeuDeviceSummaryLike[]
  potentialInefficiencies: MeuDeviceSummaryLike[]
}

export interface SendAfyaSolarDesignReportEmailOptions {
  facilityName: string | null
  facilityId: string | null
  facilityEmail?: string | null
  reportId: number
  summary: {
    pvSizeKw: number | null
    batteryKwh: number | null
    grossMonthlySavings: number | null
    totalDailyEnergyKwh?: number | null
    adjustedDailyEnergyKwh?: number | null
    numPanels?: number | null
  }
  meuSummary?: MeuSummaryLike | null
  costs?: {
    baselineGridMonthly: number | null
    baselineDieselMonthly: number | null
    baselineTotalMonthly: number | null
    afterGridMonthly: number | null
    afterDieselMonthly: number | null
    afterTotalMonthly: number | null
    grossMonthlySavings: number | null
  }
  financing?: {
    cashPriceTzs: number | null
    cashPaybackMonths: number | null
    installmentUpfrontTzs: number | null
    installmentMonthlyTzs: number | null
    installmentTermMonths: number | null
    installmentNetSavingsTzs: number | null
    installmentBreakevenMonths: number | null
    eaasMonthlyTzs: number | null
    eaasTermMonths: number | null
    eaasNetSavingsTzs: number | null
  }
}

/**
 * Send Afya Solar Design & Finance assessment summary to company email (info@ubuntuafyalink.co.tz).
 */
export async function sendAfyaSolarDesignReportEmail({
  facilityName,
  facilityId,
  facilityEmail,
  reportId,
  summary,
  meuSummary,
  costs,
  financing,
}: SendAfyaSolarDesignReportEmailOptions): Promise<boolean> {
  const logoImg = renderLogoImage(100, 12)
  const toEmail = COMPANY_EMAIL

  const recipients = facilityEmail
    ? [toEmail, facilityEmail].filter(Boolean)
    : [toEmail]

  const safeFacilityName = facilityName || 'Unknown facility'

  const formatTzs = (value: number | null | undefined): string =>
    value != null ? 'TZS ' + Number(value).toLocaleString('en-TZ') : '—'

  const formatNumber = (value: number | null | undefined, digits = 1): string =>
    value != null ? value.toFixed(digits) : '—'

  const hasMeu =
    !!meuSummary && meuSummary.totalDailyLoad > 0 && meuSummary.topDevices?.length > 0

  const hasCosts =
    !!costs &&
    (costs.baselineGridMonthly != null ||
      costs.baselineDieselMonthly != null ||
      costs.afterGridMonthly != null ||
      costs.afterDieselMonthly != null)

  const hasFinancing =
    !!financing &&
    (financing.cashPriceTzs != null ||
      financing.installmentMonthlyTzs != null ||
      financing.eaasMonthlyTzs != null)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Afya Solar – Design & Finance Assessment</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 640px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          ${logoImg}
          <h1 style="color: white; margin: 0;">Ubuntu Afya Link</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px 24px 28px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Afya Solar – Design & Finance Assessment</h2>
          <p style="margin: 4px 0 12px 0;">
            A facility has completed the Afya Solar Design &amp; Finance engine. Below is a quick summary; full details are available in the admin dashboard.
          </p>

          <div style="background: #ffffff; border-radius: 6px; padding: 16px 18px; border-left: 4px solid #10b981; margin-bottom: 16px;">
            <p style="margin: 0 0 6px 0;"><strong>Facility:</strong> ${safeFacilityName}</p>
            <p style="margin: 0;"><strong>Report ID:</strong> ${reportId}</p>
          </div>

          <div style="background: #ffffff; border-radius: 6px; padding: 16px 18px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">System design summary</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 14px;">
              <li>PV size: ${summary.pvSizeKw != null ? summary.pvSizeKw.toFixed(2) + ' kW' : '—'}</li>
              <li>Battery energy: ${summary.batteryKwh != null ? summary.batteryKwh.toFixed(1) + ' kWh' : '—'}</li>
              <li>Panels: ${summary.numPanels != null ? summary.numPanels + ' x 620 W' : '—'}</li>
              <li>Total daily energy (kWh/day): ${
                summary.totalDailyEnergyKwh != null ? summary.totalDailyEnergyKwh.toFixed(1) : '—'
              }</li>
              <li>Adjusted daily energy (kWh/day): ${
                summary.adjustedDailyEnergyKwh != null ? summary.adjustedDailyEnergyKwh.toFixed(1) : '—'
              }</li>
            </ul>
          </div>

          <div style="background: #ffffff; border-radius: 6px; padding: 16px 18px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">Financial snapshot</p>
            <p style="margin: 0;">
              <strong>Estimated gross monthly savings:</strong>
              ${formatTzs(summary.grossMonthlySavings ?? null)}
            </p>
          </div>

          ${
            hasMeu
              ? `
          <div style="background: #ffffff; border-radius: 6px; padding: 16px 18px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">Major Energy Uses (MEU) summary</p>
            <p style="margin: 0 0 8px 0; font-size: 14px;">
              Total estimated daily load from listed devices: <strong>${formatNumber(
                meuSummary!.totalDailyLoad,
              )} kWh/day</strong>
            </p>
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600;">Top devices by daily consumption</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">Device</th>
                  <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">kWh/day</th>
                  <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">Share</th>
                </tr>
              </thead>
              <tbody>
                ${meuSummary!.topDevices
                  .map(
                    (d) => `
                <tr>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6;">${d.name}</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatNumber(
                    d.dailyKwh,
                  )}</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatNumber(
                    d.shareOfTotal,
                  )}%</td>
                </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
            ${
              meuSummary!.potentialInefficiencies.length
                ? `
            <p style="margin: 8px 0 4px 0; font-size: 13px; font-weight: 600;">Potential inefficiencies to investigate</p>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px;">
              ${meuSummary!.potentialInefficiencies
                .map(
                  (d) =>
                    `<li>${d.name} – ${formatNumber(d.dailyKwh)} kWh/day (${formatNumber(
                      d.shareOfTotal,
                    )}% of MEU load)</li>`,
                )
                .join('')}
            </ul>
            `
                : ''
            }
          </div>
          `
              : ''
          }

          ${
            hasCosts
              ? `
          <div style="background: #ffffff; border-radius: 6px; padding: 16px 18px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">Monthly cost comparison</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;"></th>
                  <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">Before solar</th>
                  <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">After solar</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6;">Grid (TANESCO)</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatTzs(
                    costs!.baselineGridMonthly,
                  )}</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatTzs(
                    costs!.afterGridMonthly,
                  )}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6;">Diesel generator</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatTzs(
                    costs!.baselineDieselMonthly,
                  )}</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatTzs(
                    costs!.afterDieselMonthly,
                  )}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 6px; border-top: 1px solid #e5e7eb; font-weight: 600;">Total monthly energy cost</td>
                  <td style="padding: 4px 6px; border-top: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatTzs(
                    costs!.baselineTotalMonthly,
                  )}</td>
                  <td style="padding: 4px 6px; border-top: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatTzs(
                    costs!.afterTotalMonthly,
                  )}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin: 10px 0 0 0; font-size: 13px;">
              <strong>Estimated gross monthly savings:</strong> ${formatTzs(
                costs!.grossMonthlySavings ?? summary.grossMonthlySavings ?? null,
              )}
            </p>
          </div>
          `
              : ''
          }

          ${
            hasFinancing
              ? `
          <div style="background: #ffffff; border-radius: 6px; padding: 16px 18px; border: 1px solid #e5e7eb; margin-bottom: 8px;">
            <p style="margin: 0 0 8px 0; font-weight: bold;">Financing comparison</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">Option</th>
                  <th style="text-align: right; padding: 4px 6px; border-bottom: 1px solid #e5e7eb;">Key metrics</th>
                </tr>
              </thead>
              <tbody>
                ${
                  financing!.cashPriceTzs != null
                    ? `
                <tr>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6;">Cash</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    Upfront: ${formatTzs(financing!.cashPriceTzs)}${
                        financing!.cashPaybackMonths != null
                          ? `<br/>Payback: ${formatNumber(financing!.cashPaybackMonths, 1)} months`
                          : ''
                      }
                  </td>
                </tr>
                `
                    : ''
                }
                ${
                  financing!.installmentMonthlyTzs != null
                    ? `
                <tr>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6;">Installment</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    Upfront: ${formatTzs(financing!.installmentUpfrontTzs)}<br/>
                    Monthly: ${formatTzs(financing!.installmentMonthlyTzs)}${
                        financing!.installmentTermMonths != null
                          ? `<br/>Term: ${financing!.installmentTermMonths} months`
                          : ''
                      }${
                        financing!.installmentNetSavingsTzs != null
                          ? `<br/>Net monthly savings (after installment): ${formatTzs(
                              financing!.installmentNetSavingsTzs,
                            )}`
                          : ''
                      }${
                        financing!.installmentBreakevenMonths != null
                          ? `<br/>Breakeven: ${formatNumber(
                              financing!.installmentBreakevenMonths,
                              1,
                            )} months`
                          : ''
                      }
                  </td>
                </tr>
                `
                    : ''
                }
                ${
                  financing!.eaasMonthlyTzs != null
                    ? `
                <tr>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6;">Energy-as-a-Service (EaaS)</td>
                  <td style="padding: 4px 6px; border-bottom: 1px solid #f3f4f6; text-align: right;">
                    Monthly fee: ${formatTzs(financing!.eaasMonthlyTzs)}${
                        financing!.eaasTermMonths != null
                          ? `<br/>Term: ${financing!.eaasTermMonths} months`
                          : ''
                      }${
                        financing!.eaasNetSavingsTzs != null
                          ? `<br/>Net monthly savings (after EaaS fee): ${formatTzs(
                              financing!.eaasNetSavingsTzs,
                            )}`
                          : ''
                      }
                  </td>
                </tr>
                `
                    : ''
                }
              </tbody>
            </table>
          </div>
          `
              : ''
          }

          <p style="margin: 18px 0 0 0; font-size: 14px; color: #6b7280;">
            Please log into the Afya Solar admin dashboard to review the full assessment, including detailed cost breakdown and financing comparison.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} Ubuntu Afya Link. All rights reserved.</p>
        </div>
      </body>
    </html>
  `

  const text = `
Afya Solar – Design & Finance Assessment

Facility: ${safeFacilityName}
Report ID: ${reportId}

System design:
- PV size: ${summary.pvSizeKw != null ? summary.pvSizeKw.toFixed(2) + ' kW' : '—'}
- Battery energy: ${summary.batteryKwh != null ? summary.batteryKwh.toFixed(1) + ' kWh' : '—'}
- Panels: ${summary.numPanels != null ? summary.numPanels + ' x 620 W' : '—'}
- Total daily energy: ${summary.totalDailyEnergyKwh != null ? summary.totalDailyEnergyKwh.toFixed(1) + ' kWh/day' : '—'}
- Adjusted daily energy: ${
    summary.adjustedDailyEnergyKwh != null ? summary.adjustedDailyEnergyKwh.toFixed(1) + ' kWh/day' : '—'
  }

Financial snapshot:
-- Estimated gross monthly savings: ${formatTzs(
    costs?.grossMonthlySavings ?? summary.grossMonthlySavings ?? null,
  )}

${hasMeu ? `Major Energy Uses (MEU):
- Total daily MEU load: ${formatNumber(meuSummary!.totalDailyLoad)} kWh/day
- Top devices:
${meuSummary!.topDevices
  .map(
    (d) =>
      `  • ${d.name}: ${formatNumber(d.dailyKwh)} kWh/day (${formatNumber(
        d.shareOfTotal,
      )}% of MEU load)`,
  )
  .join('\n')}
${
  meuSummary!.potentialInefficiencies.length
    ? `- Potential inefficiencies:\n${meuSummary!.potentialInefficiencies
        .map(
          (d) =>
            `  • ${d.name}: ${formatNumber(d.dailyKwh)} kWh/day (${formatNumber(
              d.shareOfTotal,
            )}% of MEU load)`,
        )
        .join('\n')}`
    : ''
}
` : ''}

${hasCosts ? `Monthly cost comparison:
- Grid before / after: ${formatTzs(costs!.baselineGridMonthly)} → ${formatTzs(
    costs!.afterGridMonthly,
  )}
- Diesel before / after: ${formatTzs(costs!.baselineDieselMonthly)} → ${formatTzs(
    costs!.afterDieselMonthly,
  )}
- Total energy cost before / after: ${formatTzs(costs!.baselineTotalMonthly)} → ${formatTzs(
    costs!.afterTotalMonthly,
  )}
` : ''}

${hasFinancing ? `Financing comparison:
${
  financing!.cashPriceTzs != null
    ? `- Cash: Upfront ${formatTzs(financing!.cashPriceTzs)}${
        financing!.cashPaybackMonths != null
          ? `, Payback ${formatNumber(financing!.cashPaybackMonths, 1)} months`
          : ''
      }`
    : ''
}
${
  financing!.installmentMonthlyTzs != null
    ? `- Installment: Upfront ${formatTzs(
        financing!.installmentUpfrontTzs,
      )}, Monthly ${formatTzs(financing!.installmentMonthlyTzs)}${
        financing!.installmentTermMonths != null
          ? `, Term ${financing!.installmentTermMonths} months`
          : ''
      }${
        financing!.installmentNetSavingsTzs != null
          ? `, Net monthly savings ${formatTzs(financing!.installmentNetSavingsTzs)}`
          : ''
      }${
        financing!.installmentBreakevenMonths != null
          ? `, Breakeven ${formatNumber(financing!.installmentBreakevenMonths, 1)} months`
          : ''
      }`
    : ''
}
${
  financing!.eaasMonthlyTzs != null
    ? `- EaaS: Monthly fee ${formatTzs(financing!.eaasMonthlyTzs)}${
        financing!.eaasTermMonths != null ? `, Term ${financing!.eaasTermMonths} months` : ''
      }${
        financing!.eaasNetSavingsTzs != null
          ? `, Net monthly savings ${formatTzs(financing!.eaasNetSavingsTzs)}`
          : ''
      }`
    : ''
}
` : ''}

Please log into the Afya Solar admin dashboard to review full details.
`.trim()

  const mailOptions = {
    from: `Ubuntu Afya Link <${env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `[Afya Solar] Design & Finance Assessment – ${safeFacilityName}`,
    text,
    html,
    replyTo: facilityEmail || undefined,
  }

  const emailTransporter = getTransporter()

  if (!emailTransporter) {
    if (env.NODE_ENV === 'development') {
      console.log('\n📧 Afya Solar Design & Finance Report Email (Development Mode):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${recipients.join(', ')}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(text)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return true
    }
    console.error('❌ Cannot send email: SMTP not configured')
    return false
  }

  try {
    await emailTransporter.sendMail(mailOptions)
    console.log(`✅ Afya Solar Design & Finance report email sent to ${toEmail}`)
    return true
  } catch (error) {
    console.error('Error sending Afya Solar Design & Finance report email:', error)
    return false
  }
}

