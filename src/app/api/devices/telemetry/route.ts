import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry, deviceHealth } from '@/lib/db/schema-telemetry'
import { deviceAlerts } from '@/lib/db/schema-telemetry'
import { devices } from '@/lib/db/schema'
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm'
import { telemetrySchema } from '@/lib/validations/telemetry'
import { generateId } from '@/lib/utils'

/**
 * GET /api/devices/telemetry
 * Get telemetry data for devices
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')
    const facilityId = searchParams.get('facilityId') || session.user.facilityId
    const limit = parseInt(searchParams.get('limit') || '100')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const deviceStatus = searchParams.get('deviceStatus')

    if (!facilityId && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Check access permissions
    if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = db.select().from(deviceTelemetry)

    // Apply filters
    const conditions = []
    
    if (deviceId) {
      conditions.push(eq(deviceTelemetry.deviceId, deviceId))
    } else if (facilityId) {
      // Get devices for facility first
      const facilityDevices = await db
        .select({ id: devices.id })
        .from(devices)
        .where(eq(devices.facilityId, facilityId))

      const deviceIds = facilityDevices.map((d) => d.id)
      if (deviceIds.length === 0) {
        return NextResponse.json({ success: true, data: [] })
      }
      conditions.push(inArray(deviceTelemetry.deviceId, deviceIds))
    }

    if (startDate) {
      conditions.push(gte(deviceTelemetry.timestamp, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(deviceTelemetry.timestamp, new Date(endDate)))
    }

    if (deviceStatus) {
      conditions.push(eq(deviceTelemetry.deviceStatus, deviceStatus))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    // Order by timestamp descending and limit
    const telemetryData = await query
      .orderBy(desc(deviceTelemetry.timestamp))
      .limit(limit)

    return NextResponse.json({ 
      success: true, 
      data: telemetryData,
      count: telemetryData.length
    })

  } catch (error) {
    console.error('Error fetching telemetry data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/devices/telemetry
 * Receive telemetry data from devices
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate telemetry data
    const validatedData = telemetrySchema.parse(body)

    // Get device info to verify ownership
    const device = await db
      .select()
      .from(devices)
      .where(eq(devices.id, validatedData.deviceId))
      .limit(1)

    if (device.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Check access permissions
    if (session.user.role !== 'admin' && session.user.facilityId !== device[0].facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create telemetry entry
    const telemetryEntry = {
      id: generateId(),
      deviceId: validatedData.deviceId,
      facilityId: device[0].facilityId,
      timestamp: new Date(validatedData.timestamp),
      voltage: validatedData.voltage?.toString(),
      current: validatedData.current?.toString(),
      power: validatedData.power?.toString(),
      energy: validatedData.energy?.toString(),
      frequency: validatedData.frequency?.toString(),
      solarGeneration: validatedData.solarGeneration?.toString(),
      batteryLevel: validatedData.batteryLevel?.toString(),
      batteryVoltage: validatedData.batteryVoltage?.toString(),
      temperature: validatedData.temperature?.toString(),
      gridStatus: validatedData.gridStatus || 'connected',
      deviceStatus: validatedData.deviceStatus || 'normal',
      signalStrength: validatedData.signalStrength,
      uptime: validatedData.uptime?.toString(),
      efficiency: validatedData.efficiency?.toString(),
      powerFactor: validatedData.powerFactor?.toString(),
      alertCode: validatedData.alertCode,
      alertMessage: validatedData.alertMessage,
      firmwareVersion: validatedData.firmwareVersion,
      location: validatedData.location,
    }

    // Insert telemetry data
    await db.insert(deviceTelemetry).values(telemetryEntry)

    // Update device health
    await updateDeviceHealth(validatedData.deviceId, device[0].facilityId, validatedData)

    // Check for alerts and create if needed
    await checkAndCreateAlerts(validatedData.deviceId, device[0].facilityId, validatedData)

    return NextResponse.json({ 
      success: true, 
      message: 'Telemetry data received successfully',
      id: telemetryEntry.id
    })

  } catch (error) {
    console.error('Error processing telemetry data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Update device health based on latest telemetry
 */
async function updateDeviceHealth(deviceId: string, facilityId: string, telemetryData: any) {
  try {
    // Check if device health record exists
    const existingHealth = await db
      .select()
      .from(deviceHealth)
      .where(eq(deviceHealth.deviceId, deviceId))
      .limit(1)

    const now = new Date()
    
    const healthData = {
      deviceId,
      facilityId,
      onlineStatus: true,
      lastSeen: now,
      lastDataReceived: now,
      efficiency: telemetryData.efficiency?.toString(),
      temperatureAvg: telemetryData.temperature?.toString(),
      batteryHealth: telemetryData.batteryLevel?.toString(),
      firmwareVersion: telemetryData.firmwareVersion,
      updatedAt: now,
    }

    if (existingHealth.length > 0) {
      // Update existing record
      await db
        .update(deviceHealth)
        .set(healthData)
        .where(eq(deviceHealth.deviceId, deviceId))
    } else {
      // Create new record
      await db.insert(deviceHealth).values({
        id: generateId(),
        ...healthData,
        createdAt: now,
        uptime: '0',
        downtime: '0',
        errorCount: 0,
        warningCount: 0,
        maintenanceDue: false,
      })
    }

  } catch (error) {
    console.error('Error updating device health:', error)
  }
}

/**
 * Check for alerts and create them if thresholds are exceeded
 */
async function checkAndCreateAlerts(deviceId: string, facilityId: string, telemetryData: any) {
  try {
    const alerts = []

    // Check battery level
    if (telemetryData.batteryLevel && telemetryData.batteryLevel < 20) {
      alerts.push({
        id: generateId(),
        deviceId,
        facilityId,
        alertType: 'warning',
        severity: 'high',
        code: 'LOW_BATTERY',
        title: 'Low Battery Level',
        message: `Battery level is critically low at ${telemetryData.batteryLevel}%`,
        actualValue: telemetryData.batteryLevel.toString(),
        threshold: '20',
        triggeredAt: new Date(),
        status: 'active',
      })
    }

    // Check temperature
    if (telemetryData.temperature && telemetryData.temperature > 60) {
      alerts.push({
        id: generateId(),
        deviceId,
        facilityId,
        alertType: 'error',
        severity: 'critical',
        code: 'HIGH_TEMPERATURE',
        title: 'High Temperature Alert',
        message: `Device temperature is dangerously high at ${telemetryData.temperature}°C`,
        actualValue: telemetryData.temperature.toString(),
        threshold: '60',
        triggeredAt: new Date(),
        status: 'active',
      })
    }

    // Check efficiency
    if (telemetryData.efficiency && telemetryData.efficiency < 50) {
      alerts.push({
        id: generateId(),
        deviceId,
        facilityId,
        alertType: 'warning',
        severity: 'medium',
        code: 'LOW_EFFICIENCY',
        title: 'Low Efficiency Alert',
        message: `System efficiency is low at ${telemetryData.efficiency}%`,
        actualValue: telemetryData.efficiency.toString(),
        threshold: '50',
        triggeredAt: new Date(),
        status: 'active',
      })
    }

    // Insert alerts if any
    if (alerts.length > 0) {
      await db.insert(deviceAlerts).values(alerts)
    }

  } catch (error) {
    console.error('Error checking alerts:', error)
  }
}
