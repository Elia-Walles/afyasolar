import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceHealth, deviceAlerts } from '@/lib/db/schema-telemetry'
import { devices } from '@/lib/db/schema'
import { eq, and, desc, isNull, gte, count, sum } from 'drizzle-orm'

/**
 * GET /api/facilities/[facilityId]/devices/health
 * Get health overview for all devices in a facility
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { facilityId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { facilityId } = params

    // Check access permissions
    if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all devices for the facility
    const facilityDevices = await db
      .select({
        id: devices.id,
        serialNumber: devices.serialNumber,
        type: devices.type,
        sensorSize: devices.sensorSize,
        ports: devices.ports,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .where(eq(devices.facilityId, facilityId))

    if (facilityDevices.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          facilityId,
          totalDevices: 0,
          onlineDevices: 0,
          offlineDevices: 0,
          devicesWithIssues: 0,
          maintenanceDue: 0,
          devices: [],
          summary: {
            overallStatus: 'no_devices',
            healthScore: 0,
            uptime: 0,
            avgEfficiency: 0,
          }
        }
      })
    }

    const deviceIds = facilityDevices.map(d => d.id)

    // Get health data for all devices
    const healthData = await db
      .select()
      .from(deviceHealth)
      .where(eq(deviceHealth.facilityId, facilityId))

    // Get active alerts for all devices
    const activeAlerts = await db
      .select()
      .from(deviceAlerts)
      .where(and(
        eq(deviceAlerts.facilityId, facilityId),
        eq(deviceAlerts.status, 'active')
      ))
      .orderBy(desc(deviceAlerts.triggeredAt))

    // Combine device info with health and alerts
    const devicesWithHealth = facilityDevices.map(device => {
      const health = healthData.find(h => h.deviceId === device.id)
      const alerts = activeAlerts.filter(a => a.deviceId === device.id)
      
      return {
        ...device,
        health: health || null,
        alerts: alerts,
        status: getDeviceStatus(health, alerts),
        lastSeen: health?.lastSeen || null,
        uptime: health?.uptime || '0',
        efficiency: health?.efficiency || null,
        activeAlerts: alerts.length,
        maintenanceDue: health?.maintenanceDue || false,
        batteryHealth: health?.batteryHealth || null,
      }
    })

    // Calculate facility-wide metrics
    const onlineDevices = devicesWithHealth.filter(d => d.health?.onlineStatus).length
    const offlineDevices = devicesWithHealth.filter(d => !d.health?.onlineStatus).length
    const devicesWithIssues = devicesWithHealth.filter(d => 
      d.status === 'warning' || d.status === 'critical' || d.status === 'error'
    ).length
    const maintenanceDue = devicesWithHealth.filter(d => d.maintenanceDue).length

    // Calculate overall health score
    const healthScore = calculateHealthScore(devicesWithHealth)
    
    // Calculate average uptime and efficiency
    const avgUptime = calculateAverageUptime(devicesWithHealth)
    const avgEfficiency = calculateAverageEfficiency(devicesWithHealth)

    // Get recent critical alerts for summary
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').slice(0, 5)

    const response = {
      success: true,
      data: {
        facilityId,
        totalDevices: facilityDevices.length,
        onlineDevices,
        offlineDevices,
        devicesWithIssues,
        maintenanceDue,
        devices: devicesWithHealth,
        criticalAlerts,
        summary: {
          overallStatus: getOverallFacilityStatus(onlineDevices, offlineDevices, devicesWithIssues),
          healthScore,
          uptime: avgUptime,
          avgEfficiency,
          lastUpdated: new Date().toISOString(),
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching facility device health:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get individual device status
 */
function getDeviceStatus(health: any, alerts: any[]): string {
  if (!health) return 'unknown'
  
  // Check for critical alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  if (criticalAlerts.length > 0) return 'critical'
  
  // Check for high severity alerts
  const highAlerts = alerts.filter(a => a.severity === 'high')
  if (highAlerts.length > 0) return 'warning'
  
  // Check if device is offline
  if (!health.onlineStatus) return 'offline'
  
  // Check maintenance status
  if (health.maintenanceDue) return 'maintenance'
  
  // Check efficiency
  if (health.efficiency && Number(health.efficiency) < 50) return 'warning'
  
  return 'healthy'
}

/**
 * Calculate overall facility health score
 */
function calculateHealthScore(devices: any[]): number {
  if (devices.length === 0) return 0

  let totalScore = 0
  devices.forEach(device => {
    let deviceScore = 100

    // Deduct points for being offline
    if (!device.health?.onlineStatus) deviceScore -= 50

    // Deduct points for active alerts
    device.activeAlerts.forEach((alert: any) => {
      switch (alert.severity) {
        case 'critical': deviceScore -= 30; break
        case 'high': deviceScore -= 20; break
        case 'medium': deviceScore -= 10; break
        case 'low': deviceScore -= 5; break
      }
    })

    // Deduct points for low efficiency
    if (device.efficiency && Number(device.efficiency) < 50) {
      deviceScore -= 20
    }

    // Deduct points for maintenance due
    if (device.maintenanceDue) deviceScore -= 15

    totalScore += Math.max(0, deviceScore)
  })

  return Math.round(totalScore / devices.length)
}

/**
 * Calculate average uptime across all devices
 */
function calculateAverageUptime(devices: any[]): number {
  const devicesWithUptime = devices.filter(d => d.health?.uptime)
  if (devicesWithUptime.length === 0) return 0

  const totalUptime = devicesWithUptime.reduce((sum, device) => {
    return sum + Number(device.health.uptime || 0)
  }, 0)

  return Math.round(totalUptime / devicesWithUptime.length)
}

/**
 * Calculate average efficiency across all devices
 */
function calculateAverageEfficiency(devices: any[]): number {
  const devicesWithEfficiency = devices.filter(d => d.efficiency)
  if (devicesWithEfficiency.length === 0) return 0

  const totalEfficiency = devicesWithEfficiency.reduce((sum, device) => {
    return sum + Number(device.efficiency || 0)
  }, 0)

  return Math.round(totalEfficiency / devicesWithEfficiency.length)
}

/**
 * Get overall facility status
 */
function getOverallFacilityStatus(online: number, offline: number, withIssues: number): string {
  const total = online + offline
  
  if (total === 0) return 'no_devices'
  
  const offlinePercentage = (offline / total) * 100
  const issuesPercentage = (withIssues / total) * 100
  
  if (offlinePercentage > 50) return 'critical'
  if (offlinePercentage > 25 || issuesPercentage > 50) return 'warning'
  if (offlinePercentage > 0 || issuesPercentage > 0) return 'minor_issues'
  
  return 'healthy'
}
