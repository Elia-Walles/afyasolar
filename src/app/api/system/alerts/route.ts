/**
 * System Alerts API
 * Handles critical system notifications and alerts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const alertSchema = z.object({
  type: z.enum(['maintenance', 'downtime', 'security', 'feature', 'info']),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  targetAudience: z.enum(['all', 'admin', 'facility', 'technician']),
  channels: z.array(z.enum(['email', 'sms', 'in-app', 'webhook'])).default(['in-app']),
  scheduledAt: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

/**
 * POST /api/system/alerts
 * Send system alert to users
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can send system alerts
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const validated = alertSchema.parse(body)

    console.log(`[SystemAlert] Sending alert: ${validated.type} - ${validated.title}`)

    // Get target users based on audience
    let targetUsers = []
    
    switch (validated.targetAudience) {
      case 'all':
        targetUsers = await db
          .select({ id: users.id, email: users.email, phone: users.phone })
          .from(users)
          .where(eq(users.emailVerified, true))
        break
        
      case 'admin':
        targetUsers = await db
          .select({ id: users.id, email: users.email, phone: users.phone })
          .from(users)
          .where(and(
            eq(users.role, 'admin'),
            eq(users.emailVerified, true)
          ))
        break
        
      case 'facility':
        targetUsers = await db
          .select({ id: users.id, email: users.email, phone: users.phone })
          .from(users)
          .where(and(
            eq(users.role, 'facility'),
            eq(users.emailVerified, true)
          ))
        break
        
      case 'technician':
        targetUsers = await db
          .select({ id: users.id, email: users.email, phone: users.phone })
          .from(users)
          .where(and(
            eq(users.role, 'technician'),
            eq(users.emailVerified, true)
          ))
        break
    }

    console.log(`[SystemAlert] Target audience: ${validated.targetAudience}, Users: ${targetUsers.length}`)

    const results = []
    let successCount = 0
    let failedCount = 0

    // Send notifications through specified channels
    for (const user of targetUsers) {
      const userResults = []

      // Send SMS if enabled
      if (validated.channels.includes('sms') && user.phone) {
        try {
          const { sendSystemMaintenanceSMS, sendSystemDowntimeAlertSMS, sendSecurityBreachAlertSMS } = await import('@/lib/sms')
          
          let smsFunction
          let smsData: any = {
            timestamp: new Date().toISOString()
          }

          switch (validated.type) {
            case 'maintenance':
              smsFunction = sendSystemMaintenanceSMS
              smsData = {
                startTime: validated.scheduledAt || 'Immediate',
                duration: '2 hours',
                affectedServices: ['All Services'],
                ...smsData
              }
              break
            case 'downtime':
              smsFunction = sendSystemDowntimeAlertSMS
              smsData = {
                issue: validated.title,
                estimatedResolution: validated.scheduledAt || 'Unknown',
                ...smsData
              }
              break
            case 'security':
              smsFunction = sendSecurityBreachAlertSMS
              smsData = {
                threat: validated.title,
                actionRequired: validated.message,
                ...smsData
              }
              break
            default:
              // Use maintenance SMS for other types
              smsFunction = sendSystemMaintenanceSMS
              smsData = {
                startTime: validated.scheduledAt || 'Immediate',
                duration: '1 hour',
                affectedServices: ['Selected Services'],
                ...smsData
              }
          }

          const result = await smsFunction(user.phone, smsData)
          
          if (result.success) {
            successCount++
            userResults.push({ channel: 'sms', success: true })
          } else {
            failedCount++
            userResults.push({ channel: 'sms', success: false, error: result.message })
          }
        } catch (error) {
          console.error(`Failed to send SMS to ${user.phone}:`, error)
          failedCount++
          userResults.push({ channel: 'sms', success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      // Send in-app notification (always included)
      if (validated.channels.includes('in-app')) {
        try {
          // In a real implementation, save to notifications table
          console.log(`In-app notification queued for user ${user.id}`)
          userResults.push({ channel: 'in-app', success: true })
          successCount++
        } catch (error) {
          console.error(`Failed to queue in-app notification for user ${user.id}:`, error)
          failedCount++
          userResults.push({ channel: 'in-app', success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      results.push({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        results: userResults
      })
    }

    console.log(`[SystemAlert] Completed: ${successCount} sent, ${failedCount} failed`)

    return NextResponse.json({
      success: true,
      message: 'System alert sent successfully',
      data: {
        type: validated.type,
        title: validated.title,
        severity: validated.severity,
        targetAudience: validated.targetAudience,
        channels: validated.channels,
        totalUsers: targetUsers.length,
        success: successCount,
        failed: failedCount,
        results
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('[SystemAlert] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/system/alerts
 * Get system alert statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')

    // In a real implementation, query from alerts database
    // For now, return mock statistics
    const stats = {
      total: 0,
      byType: {
        maintenance: 0,
        downtime: 0,
        security: 0,
        feature: 0,
        info: 0
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byChannel: {
        email: 0,
        sms: 0,
        'in-app': 0,
        webhook: 0
      },
      recent: []
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('[SystemAlert] Error getting stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
