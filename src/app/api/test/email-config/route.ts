/**
 * Test API to verify email configuration
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'Not configured',
    port: process.env.SMTP_PORT || 'Not configured',
    user: process.env.SMTP_USER ? 'Configured' : 'Not configured',
    password: process.env.SMTP_PASSWORD ? 'Configured' : 'Not configured',
  }

  const isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)

  return NextResponse.json({
    success: true,
    smtpConfig,
    isConfigured,
    message: isConfigured 
      ? 'Email configuration is properly set up' 
      : 'Email configuration is missing. Please check your .env file',
  })
}
