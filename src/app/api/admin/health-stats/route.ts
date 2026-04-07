import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceHealth, deviceAlerts } from '@/lib/db/schema-telemetry'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/health-stats
 * Get overall health statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all device health records
    const healthData = await db.select().from(deviceHealth)

    // Get all active alerts
    const alertData = await db
      .select()
      .from(deviceAlerts)
      .where(eq(deviceAlerts.status, 'active'))

    // Calculate statistics
    const totalDevices = healthData.length
    const onlineDevices = healthData.filter(h => h.onlineStatus === true).length
    const offlineDevices = healthData.filter(h => h.onlineStatus === false).length
    const healthyDevices = healthData.filter(h => {
      const efficiency = Number(h.efficiency || 0)
      return efficiency >= 80 && h.onlineStatus === true
    }).length
    const devicesWithAlerts = new Set(alertData.map(a => a.deviceId)).size
    const activeAlerts = alertData.length
    const criticalAlerts = alertData.filter(a => a.severity === 'critical').length
    const maintenanceDue = healthData.filter(h => h.maintenanceDue).length
    
    const averageEfficiency = totalDevices > 0 
      ? healthData.reduce((sum, h) => sum + Number(h.efficiency || 0), 0) / totalDevices 
      : 0

    const stats = {
      totalDevices,
      onlineDevices,
      offlineDevices,
      healthyDevices,
      devicesWithAlerts,
      activeAlerts,
      criticalAlerts,
      maintenanceDue,
      averageEfficiency: Math.round(averageEfficiency * 100) / 100
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching health stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch health statistics' },
      { status: 500 }
    )
  }
}
