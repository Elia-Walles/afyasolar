import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceHealth, devices, facilities } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/health-summary
 * Get health summary for all devices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all devices with their health data and facility information
    const devicesWithHealth = await db
      .select({
        deviceId: devices.id,
        serialNumber: devices.serialNumber,
        facilityId: devices.facilityId,
        facilityName: facilities.name,
        deviceStatus: devices.status,
        onlineStatus: deviceHealth.onlineStatus,
        uptime: deviceHealth.uptime,
        efficiency: deviceHealth.efficiency,
        batteryHealth: deviceHealth.batteryHealth,
        temperatureAvg: deviceHealth.temperatureAvg,
        lastSeen: deviceHealth.lastSeen,
        errorCount: deviceHealth.errorCount,
        maintenanceDue: deviceHealth.maintenanceDue,
        lastMaintenance: deviceHealth.lastMaintenance
      })
      .from(devices)
      .leftJoin(facilities, eq(devices.facilityId, facilities.id))
      .leftJoin(deviceHealth, eq(devices.id, deviceHealth.deviceId))
      .where(eq(devices.status, 'active'))

    // Transform the data to match the expected format
    const healthSummary = devicesWithHealth.map(device => ({
      deviceId: device.deviceId,
      serialNumber: device.serialNumber,
      facilityName: device.facilityName || `Facility ${device.facilityId}`,
      onlineStatus: device.onlineStatus || 'offline',
      status: device.deviceStatus || 'unknown',
      uptime: parseFloat(device.uptime || '0'),
      efficiency: parseFloat(device.efficiency || '0'),
      batteryLevel: parseFloat(device.batteryHealth || '0'),
      temperature: parseFloat(device.temperatureAvg || '0'),
      lastSeen: device.lastSeen?.toISOString() || new Date().toISOString(),
      activeAlerts: device.errorCount || 0,
      maintenanceDue: device.maintenanceDue || false,
      lastMaintenance: device.lastMaintenance?.toISOString()
    }))

    return NextResponse.json(healthSummary)

  } catch (error) {
    console.error('Error fetching health summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch health summary' },
      { status: 500 }
    )
  }
}
