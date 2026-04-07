import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceAlerts, devices, facilities } from '@/lib/db/schema'
import { eq, and, desc, gte } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

interface NotificationChannel {
  type: 'email' | 'sms' | 'in-app' | 'webhook'
  enabled: boolean
  config: {
    recipients?: string[]
    template?: string
    webhookUrl?: string
    apiKey?: string
  }
}

interface AlertRule {
  id: string
  name: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  condition: string
  threshold: number
  channels: string[]
  escalationRules: {
    delay: number // minutes
    action: string
    channels: string[]
  }[]
  enabled: boolean
}

/**
 * GET /api/admin/alert-system/config
 * Get alert system configuration
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get notification channels configuration
    const notificationChannels: NotificationChannel[] = [
      {
        type: 'email',
        enabled: true,
        config: {
          recipients: ['admin@afyalink.com', 'support@afyalink.com'],
          template: 'solar-alert'
        }
      },
      {
        type: 'sms',
        enabled: false,
        config: {
          recipients: []
        }
      },
      {
        type: 'in-app',
        enabled: true,
        config: {}
      },
      {
        type: 'webhook',
        enabled: false,
        config: {
          webhookUrl: '',
          apiKey: ''
        }
      }
    ]

    // Get alert rules
    const alertRules: AlertRule[] = [
      {
        id: 'efficiency-low',
        name: 'Low Efficiency Alert',
        type: 'efficiency',
        severity: 'medium',
        condition: 'less_than',
        threshold: 80,
        channels: ['email', 'in-app'],
        escalationRules: [
          {
            delay: 30,
            action: 'escalate',
            channels: ['sms']
          }
        ],
        enabled: true
      },
      {
        id: 'device-offline',
        name: 'Device Offline Alert',
        type: 'offline',
        severity: 'critical',
        condition: 'equals',
        threshold: 1,
        channels: ['email', 'sms', 'in-app'],
        escalationRules: [
          {
            delay: 15,
            action: 'escalate',
            channels: ['webhook']
          }
        ],
        enabled: true
      },
      {
        id: 'battery-low',
        name: 'Low Battery Alert',
        type: 'battery',
        severity: 'high',
        condition: 'less_than',
        threshold: 20,
        channels: ['email', 'in-app'],
        escalationRules: [],
        enabled: true
      },
      {
        id: 'temperature-high',
        name: 'High Temperature Alert',
        type: 'temperature',
        severity: 'high',
        condition: 'greater_than',
        threshold: 70,
        channels: ['email', 'in-app'],
        escalationRules: [],
        enabled: true
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        notificationChannels,
        alertRules,
        stats: await getAlertSystemStats()
      }
    })

  } catch (error) {
    console.error('Error fetching alert system config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert system configuration' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/alert-system/config
 * Update alert system configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationChannels, alertRules } = body

    // In a real implementation, you would save these to a database table
    // For now, we'll just return success
    
    console.log('Updated alert system configuration:', {
      notificationChannels,
      alertRules
    })

    return NextResponse.json({
      success: true,
      message: 'Alert system configuration updated successfully'
    })

  } catch (error) {
    console.error('Error updating alert system config:', error)
    return NextResponse.json(
      { error: 'Failed to update alert system configuration' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/alert-system/test
 * Test alert notification
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { channel, message, severity = 'medium' } = body

    // Send test notification
    const result = await sendTestNotification(channel, message, severity)

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      result
    })

  } catch (error) {
    console.error('Error sending test notification:', error)
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}

/**
 * Get alert system statistics
 */
async function getAlertSystemStats() {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Get recent alerts
  const recentAlerts = await db
    .select()
    .from(deviceAlerts)
    .where(gte(deviceAlerts.triggeredAt, weekAgo))
    .orderBy(desc(deviceAlerts.triggeredAt))

  const stats = {
    totalAlerts: recentAlerts.length,
    activeAlerts: recentAlerts.filter(a => a.status === 'active').length,
    resolvedAlerts: recentAlerts.filter(a => a.status === 'resolved').length,
    criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
    alertsToday: recentAlerts.filter(a => new Date(a.triggeredAt) > dayAgo).length,
    alertsByType: {
      efficiency: recentAlerts.filter(a => a.alertType === 'efficiency').length,
      offline: recentAlerts.filter(a => a.alertType === 'offline').length,
      battery: recentAlerts.filter(a => a.alertType === 'battery').length,
      temperature: recentAlerts.filter(a => a.alertType === 'temperature').length
    },
    alertsBySeverity: {
      low: recentAlerts.filter(a => a.severity === 'low').length,
      medium: recentAlerts.filter(a => a.severity === 'medium').length,
      high: recentAlerts.filter(a => a.severity === 'high').length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length
    }
  }

  return stats
}

/**
 * Send test notification
 */
async function sendTestNotification(channel: string, message: string, severity: string) {
  console.log(`Sending test ${channel} notification:`, message)
  
  // Mock implementation - replace with actual notification services
  switch (channel) {
    case 'email':
      // Send email using your email service
      return { success: true, channel: 'email', sentAt: new Date().toISOString() }
    
    case 'sms':
      // Send SMS using your SMS service
      return { success: true, channel: 'sms', sentAt: new Date().toISOString() }
    
    case 'in-app':
      // Create in-app notification
      return { success: true, channel: 'in-app', sentAt: new Date().toISOString() }
    
    case 'webhook':
      // Send webhook notification
      return { success: true, channel: 'webhook', sentAt: new Date().toISOString() }
    
    default:
      throw new Error(`Unknown notification channel: ${channel}`)
  }
}
