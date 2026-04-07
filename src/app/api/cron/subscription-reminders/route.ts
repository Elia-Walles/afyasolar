import { NextRequest, NextResponse } from 'next/server'
import { processExpiringSubscriptions } from '@/lib/notifications/subscription-reminder'
import { processPendingEmailNotifications } from '@/lib/notifications/email-service'

export const dynamic = "force-dynamic"
export const revalidate = 0

// This can be secured with a secret key in production
const CRON_SECRET = process.env.CRON_SECRET || 'your-cron-secret-key'

/**
 * GET /api/cron/subscription-reminders
 * Process subscription reminders and send notifications
 * 
 * Should be called by a cron job (e.g., Vercel Cron, external cron service)
 * Set CRON_SECRET environment variable for security
 * 
 * Example cron schedule: Daily at 9 AM
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')
    
    // In development, allow without secret
    if (process.env.NODE_ENV === 'production' && providedSecret !== CRON_SECRET) {
      console.warn('Unauthorized cron request attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== STARTING CRON: SUBSCRIPTION REMINDERS ===')
    console.log('Timestamp:', new Date().toISOString())

    // Process expiring subscriptions
    const subscriptionResults = await processExpiringSubscriptions()

    // Process pending email notifications
    const emailResults = await processPendingEmailNotifications()

    console.log('=== CRON COMPLETED ===')
    console.log({
      subscriptions: subscriptionResults,
      emails: emailResults,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        subscriptions: subscriptionResults,
        emails: emailResults,
      },
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/subscription-reminders
 * Alternative method for triggering the cron job
 */
export async function POST(request: NextRequest) {
  return GET(request)
}

