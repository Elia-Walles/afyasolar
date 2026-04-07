import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { devices, facilities } from '@/lib/db/schema'
import { deviceHealth, deviceTelemetry } from '@/lib/db/schema-telemetry'
import { eq, desc, and, isNotNull } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

interface DeviceWithHealth {
  id: string
  serialNumber: string
  type: string
  facilityId: string
  facilityName: string
  status: 'online' | 'offline' | 'maintenance' | 'error'
  lastSeen: string
  efficiency: number
  batteryLevel: number
  temperature: number
  powerOutput: number
  location: string
  installDate: string
  firmwareVersion: string
  alerts: number
}

/**
 * GET /api/admin/solar/devices
 * Fetch all solar devices with their latest health and telemetry data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const facilityId = searchParams.get('facilityId')

    // Build query conditions
    let whereConditions = []
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push(eq(deviceHealth.onlineStatus, statusFilter === 'online'))
    }
    if (facilityId) {
      whereConditions.push(eq(devices.facilityId, facilityId))
    }

    // Fetch devices with their latest health and telemetry data
    const devicesData = await db
      .select({
        // Device info
        id: devices.id,
        serialNumber: devices.serialNumber,
        type: devices.type,
        facilityId: devices.facilityId,
        facilityName: facilities.name,
        status: devices.status,
        lastUpdate: devices.lastUpdate,
        createdAt: devices.createdAt,
        
        // Health info
        onlineStatus: deviceHealth.onlineStatus,
        lastSeen: deviceHealth.lastSeen,
        efficiency: deviceHealth.efficiency,
        batteryHealth: deviceHealth.batteryHealth,
        temperatureAvg: deviceHealth.temperatureAvg,
        errorCount: deviceHealth.errorCount,
        warningCount: deviceHealth.warningCount,
        firmwareVersion: deviceHealth.firmwareVersion,
        
        // Latest telemetry
        power: deviceTelemetry.power,
        batteryLevel: deviceTelemetry.batteryLevel,
        temperature: deviceTelemetry.temperature,
        location: deviceTelemetry.location,
      })
      .from(devices)
      .leftJoin(facilities, eq(devices.facilityId, facilities.id))
      .leftJoin(deviceHealth, eq(devices.id, deviceHealth.deviceId))
      .leftJoin(
        deviceTelemetry,
        and(
          eq(deviceTelemetry.deviceId, devices.id),
          // Get the latest telemetry record for each device
          // This is a simplified approach - in production, you might want a more sophisticated query
        )
      )
      .where(
        whereConditions.length > 0 ? and(...whereConditions) : undefined
      )
      .orderBy(desc(deviceHealth.lastSeen))

    // Transform the data to match the expected interface
    const transformedDevices: DeviceWithHealth[] = devicesData.map(device => ({
      id: device.id,
      serialNumber: device.serialNumber,
      type: device.type || 'Smart Meter',
      facilityId: device.facilityId,
      facilityName: device.facilityName || 'Unknown Facility',
      status: device.onlineStatus ? 'online' : 'offline',
      lastSeen: device.lastSeen?.toISOString() || new Date().toISOString(),
      efficiency: Number(device.efficiency) || 0,
      batteryLevel: Number(device.batteryHealth || device.batteryLevel) || 0,
      temperature: Number(device.temperatureAvg || device.temperature) || 0,
      powerOutput: Number(device.power) || 0,
      location: device.location || 'Unknown',
      installDate: device.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      firmwareVersion: device.firmwareVersion || 'Unknown',
      alerts: (device.errorCount || 0) + (device.warningCount || 0)
    }))

    return NextResponse.json({
      success: true,
      data: transformedDevices,
      count: transformedDevices.length
    })

  } catch (error) {
    console.error('Error fetching solar devices:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
