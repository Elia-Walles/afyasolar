import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { devices } from '@/lib/db/schema'
import { deviceHealth, deviceTelemetry, deviceAlerts } from '@/lib/db/schema-telemetry'
import { eq, and, gte, lte, desc, lt } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

/**
 * POST /api/admin/health-check
 * Automated health monitoring service
 * This endpoint should be called by a cron job every 5 minutes
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Simple authentication for cron jobs (you should use a more secure method)
    if (authHeader !== `Bearer ${process.env.HEALTH_CHECK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting automated health check...')
    
    // Get all active devices
    const allDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.status, 'active'))

    const healthCheckResults = []
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    for (const device of allDevices) {
      try {
        console.log(`Checking health for device: ${device.serialNumber}`)
        
        // Get recent telemetry data
        const recentTelemetry = await db
          .select()
          .from(deviceTelemetry)
          .where(and(
            eq(deviceTelemetry.deviceId, device.id),
            gte(deviceTelemetry.timestamp, oneHourAgo)
          ))
          .orderBy(desc(deviceTelemetry.timestamp))
          .limit(60) // Last hour of data (assuming 1 per minute)

        // Calculate health metrics
        const healthMetrics = calculateDeviceHealth(device.id, recentTelemetry)
        
        // Update device health record
        await updateDeviceHealth(device.id, device.facilityId, healthMetrics)
        
        // Check for alerts and create if needed
        const newAlerts = await checkAndCreateAlerts(device, healthMetrics)
        
        // Check if maintenance is due
        const maintenanceDue = await checkMaintenanceDue(device.id)
        
        healthCheckResults.push({
          deviceId: device.id,
          serialNumber: device.serialNumber,
          facilityId: device.facilityId,
          status: healthMetrics.status,
          onlineStatus: healthMetrics.onlineStatus,
          alertsCreated: newAlerts.length,
          maintenanceDue
        })

      } catch (error) {
        console.error(`Error checking device ${device.id}:`, error)
        healthCheckResults.push({
          deviceId: device.id,
          serialNumber: device.serialNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`Health check completed. Processed ${allDevices.length} devices`)

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      devicesChecked: allDevices.length,
      results: healthCheckResults,
      summary: {
        healthy: healthCheckResults.filter(r => r.status === 'healthy').length,
        warning: healthCheckResults.filter(r => r.status === 'warning').length,
        critical: healthCheckResults.filter(r => r.status === 'critical').length,
        offline: healthCheckResults.filter(r => r.onlineStatus === 'offline').length,
        maintenanceDue: healthCheckResults.filter(r => r.maintenanceDue).length,
        alertsCreated: healthCheckResults.reduce((sum, r) => sum + (r.alertsCreated || 0), 0)
      }
    })

  } catch (error) {
    console.error('Health check service error:', error)
    return NextResponse.json(
      { error: 'Health check service failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/health-check
 * Get health check status and last run information
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (authHeader !== `Bearer ${process.env.HEALTH_CHECK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get health statistics
    const healthStats = await getHealthStatistics()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: healthStats
    })

  } catch (error) {
    console.error('Error getting health check status:', error)
    return NextResponse.json(
      { error: 'Failed to get health check status' },
      { status: 500 }
    )
  }
}

/**
 * Calculate device health metrics from telemetry data
 */
function calculateDeviceHealth(deviceId: string, telemetry: any[]) {
  if (telemetry.length === 0) {
    return {
      onlineStatus: 'offline',
      status: 'offline',
      uptime: 0,
      efficiency: 0,
      batteryLevel: 0,
      temperature: 0,
      lastSeen: null,
      activeAlerts: 0,
      dataPoints: 0
    }
  }

  const latest = telemetry[0]
  const now = new Date()
  const lastTimestamp = new Date(latest.timestamp)
  const minutesSinceLastData = (now.getTime() - lastTimestamp.getTime()) / (1000 * 60)
  
  // Device is online if we received data in the last 10 minutes
  const onlineStatus = minutesSinceLastData <= 10 ? 'online' : 'offline'
  
  // Calculate averages
  const avgEfficiency = telemetry.reduce((sum, t) => sum + (Number(t.efficiency) || 0), 0) / telemetry.length
  const avgBatteryLevel = telemetry.reduce((sum, t) => sum + (Number(t.batteryLevel) || 0), 0) / telemetry.length
  const avgTemperature = telemetry.reduce((sum, t) => sum + (Number(t.temperature) || 0), 0) / telemetry.length

  // Count potential issues
  const activeAlerts = telemetry.filter(t => 
    (Number(t.efficiency) && Number(t.efficiency) < 80) ||
    (Number(t.batteryLevel) && Number(t.batteryLevel) < 20) ||
    (Number(t.temperature) && Number(t.temperature) > 70)
  ).length

  // Calculate uptime based on data points
  const uptime = (telemetry.length / 60) * 100 // Assuming 1 data point per minute

  // Determine overall status
  let status = 'healthy'
  if (onlineStatus === 'offline') {
    status = 'offline'
  } else if (activeAlerts > 5 || avgEfficiency < 50) {
    status = 'critical'
  } else if (activeAlerts > 0 || avgEfficiency < 80) {
    status = 'warning'
  }

  return {
    onlineStatus,
    status,
    uptime: Math.min(uptime, 100),
    efficiency: Math.round(avgEfficiency * 100) / 100,
    batteryLevel: Math.round(avgBatteryLevel * 100) / 100,
    temperature: Math.round(avgTemperature * 100) / 100,
    lastSeen: lastTimestamp,
    activeAlerts,
    dataPoints: telemetry.length
  }
}

/**
 * Update device health record in database
 */
async function updateDeviceHealth(deviceId: string, facilityId: string, metrics: any) {
  const healthRecord = {
    id: generateId(),
    deviceId,
    facilityId,
    onlineStatus: metrics.onlineStatus,
    lastSeen: metrics.lastSeen,
    uptime: metrics.uptime.toString(),
    efficiency: metrics.efficiency.toString(),
    batteryLevel: metrics.batteryLevel.toString(),
    temperature: metrics.temperature.toString(),
    alerts: metrics.activeAlerts,
    maintenanceDue: false, // Would be calculated separately
    lastMaintenance: null, // Would be fetched from maintenance records
    updatedAt: new Date()
  }

  // Use upsert (update or insert)
  await db
    .insert(deviceHealth)
    .values(healthRecord)
    .onDuplicateKeyUpdate({
      set: healthRecord
    })
}

/**
 * Check for alerts and create new ones if needed
 */
async function checkAndCreateAlerts(device: any, metrics: any) {
  const newAlerts = []
  const now = new Date()

  // Check for offline alert
  if (metrics.onlineStatus === 'offline') {
    const existingOfflineAlert = await db
      .select()
      .from(deviceAlerts)
      .where(and(
        eq(deviceAlerts.deviceId, device.id),
        eq(deviceAlerts.alertType, 'offline'),
        eq(deviceAlerts.status, 'active')
      ))
      .limit(1)

    if (existingOfflineAlert.length === 0) {
      await db.insert(deviceAlerts).values({
        id: generateId(),
        deviceId: device.id,
        facilityId: device.facilityId,
        alertType: 'offline',
        severity: 'critical',
        code: 'DEVICE_OFFLINE',
        title: 'Device Offline',
        message: `Device ${device.serialNumber} has gone offline`,
        status: 'active',
        triggeredAt: now,
        alertData: JSON.stringify({
          lastSeen: metrics.lastSeen,
          serialNumber: device.serialNumber
        })
      })
      newAlerts.push('offline')
    }
  }

  // Check for low efficiency alert
  if (metrics.efficiency < 80 && metrics.efficiency > 0) {
    const existingEfficiencyAlert = await db
      .select()
      .from(deviceAlerts)
      .where(and(
        eq(deviceAlerts.deviceId, device.id),
        eq(deviceAlerts.alertType, 'efficiency'),
        eq(deviceAlerts.status, 'active')
      ))
      .limit(1)

    if (existingEfficiencyAlert.length === 0) {
      await db.insert(deviceAlerts).values({
        id: generateId(),
        deviceId: device.id,
        facilityId: device.facilityId,
        alertType: 'efficiency',
        severity: 'medium',
        code: 'LOW_EFFICIENCY',
        title: 'Low Efficiency',
        message: `Device ${device.serialNumber} efficiency is ${metrics.efficiency}%`,
        status: 'active',
        triggeredAt: now,
        alertData: JSON.stringify({
          efficiency: metrics.efficiency,
          serialNumber: device.serialNumber
        })
      })
      newAlerts.push('efficiency')
    }
  }

  // Check for low battery alert
  if (metrics.batteryLevel < 20 && metrics.batteryLevel > 0) {
    const existingBatteryAlert = await db
      .select()
      .from(deviceAlerts)
      .where(and(
        eq(deviceAlerts.deviceId, device.id),
        eq(deviceAlerts.alertType, 'battery'),
        eq(deviceAlerts.status, 'active')
      ))
      .limit(1)

    if (existingBatteryAlert.length === 0) {
      await db.insert(deviceAlerts).values({
        id: generateId(),
        deviceId: device.id,
        facilityId: device.facilityId,
        alertType: 'battery',
        severity: 'high',
        code: 'LOW_BATTERY',
        title: 'Low Battery',
        message: `Device ${device.serialNumber} battery level is ${metrics.batteryLevel}%`,
        status: 'active',
        triggeredAt: now,
        alertData: JSON.stringify({
          batteryLevel: metrics.batteryLevel,
          serialNumber: device.serialNumber
        })
      })
      newAlerts.push('battery')
    }
  }

  return newAlerts
}

/**
 * Check if maintenance is due for a device
 */
async function checkMaintenanceDue(deviceId: string): Promise<boolean> {
  // This would typically check against maintenance schedule
  // For now, implement a simple check based on last maintenance date
  const health = await db
    .select()
    .from(deviceHealth)
    .where(eq(deviceHealth.deviceId, deviceId))
    .limit(1)

  if (health.length === 0 || !health[0].lastMaintenance) {
    return true // No maintenance record, assume due
  }

  const lastMaintenance = new Date(health[0].lastMaintenance)
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  
  return lastMaintenance < threeMonthsAgo
}

/**
 * Get overall health statistics
 */
async function getHealthStatistics() {
  const healthData = await db
    .select()
    .from(deviceHealth)

  const alertData = await db
    .select()
    .from(deviceAlerts)
    .where(eq(deviceAlerts.status, 'active'))

  return {
    totalDevices: healthData.length,
    onlineDevices: healthData.filter(h => h.onlineStatus === true).length,
    offlineDevices: healthData.filter(h => h.onlineStatus === false).length,
    healthyDevices: healthData.filter(h => h.efficiency && Number(h.efficiency) >= 80).length,
    devicesWithAlerts: new Set(alertData.map(a => a.deviceId)).size,
    activeAlerts: alertData.length,
    criticalAlerts: alertData.filter(a => a.severity === 'critical').length,
    maintenanceDue: healthData.filter(h => h.maintenanceDue).length,
    averageEfficiency: healthData.length > 0 
      ? healthData.reduce((sum, h) => sum + Number(h.efficiency || 0), 0) / healthData.length 
      : 0
  }
}
