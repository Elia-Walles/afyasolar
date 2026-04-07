import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceHealth, deviceAlerts } from '@/lib/db/schema-telemetry'
import { devices } from '@/lib/db/schema'
import { eq, and, desc, isNull, gte } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

/**
 * GET /api/devices/[deviceId]/health
 * Get health status for a specific device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { deviceId } = params

    // Get device info to verify ownership
    const device = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1)

    if (device.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Check access permissions
    if (session.user.role !== 'admin' && session.user.facilityId !== device[0].facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get device health
    const healthData = await db
      .select()
      .from(deviceHealth)
      .where(eq(deviceHealth.deviceId, deviceId))
      .limit(1)

    // Get recent alerts for this device
    const recentAlerts = await db
      .select()
      .from(deviceAlerts)
      .where(and(
        eq(deviceAlerts.deviceId, deviceId),
        eq(deviceAlerts.status, 'active')
      ))
      .orderBy(desc(deviceAlerts.triggeredAt))
      .limit(10)

    // Get device performance metrics
    const performanceMetrics = await getDevicePerformanceMetrics(deviceId)

    const response = {
      success: true,
      data: {
        device: {
          id: device[0].id,
          serialNumber: device[0].serialNumber,
          type: device[0].type,
          facilityId: device[0].facilityId,
        },
        health: healthData[0] || null,
        alerts: recentAlerts,
        performance: performanceMetrics,
        summary: {
          status: getDeviceStatusSummary(healthData[0], recentAlerts),
          lastSeen: healthData[0]?.lastSeen || null,
          uptime: healthData[0]?.uptime || '0',
          efficiency: healthData[0]?.efficiency || null,
          activeAlerts: recentAlerts.length,
          maintenanceDue: healthData[0]?.maintenanceDue || false,
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching device health:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/devices/[deviceId]/health
 * Update device health status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { deviceId } = params
    const body = await request.json()

    // Get device info to verify ownership
    const device = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1)

    if (device.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Check access permissions
    if (session.user.role !== 'admin' && session.user.facilityId !== device[0].facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update device health
    const updateData = {
      ...body,
      updatedAt: new Date(),
    }

    await db
      .update(deviceHealth)
      .set(updateData)
      .where(eq(deviceHealth.deviceId, deviceId))

    return NextResponse.json({
      success: true,
      message: 'Device health updated successfully',
      data: updateData
    })

  } catch (error) {
    console.error('Error updating device health:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get device performance metrics
 */
async function getDevicePerformanceMetrics(deviceId: string) {
  try {
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Get recent telemetry data for performance calculations
    const { deviceTelemetry } = await import('@/lib/db/schema-telemetry')
    
    const recentData = await db
      .select()
      .from(deviceTelemetry)
      .where(and(
        eq(deviceTelemetry.deviceId, deviceId),
        gte(deviceTelemetry.timestamp, dayAgo)
      ))
      .orderBy(desc(deviceTelemetry.timestamp))
      .limit(100)

    if (recentData.length === 0) {
      return {
        avgPower: 0,
        peakPower: 0,
        avgEfficiency: 0,
        dataPoints: 0,
        uptime: 0,
      }
    }

    // Calculate performance metrics
    const powerValues = recentData
      .map(d => Number(d.power || 0))
      .filter(p => p > 0)
    
    const efficiencyValues = recentData
      .map(d => Number(d.efficiency || 0))
      .filter(e => e > 0)

    const avgPower = powerValues.length > 0 
      ? powerValues.reduce((sum, p) => sum + p, 0) / powerValues.length 
      : 0
    
    const peakPower = powerValues.length > 0 
      ? Math.max(...powerValues) 
      : 0
    
    const avgEfficiency = efficiencyValues.length > 0 
      ? efficiencyValues.reduce((sum, e) => sum + e, 0) / efficiencyValues.length 
      : 0

    return {
      avgPower: Math.round(avgPower * 100) / 100,
      peakPower: Math.round(peakPower * 100) / 100,
      avgEfficiency: Math.round(avgEfficiency * 100) / 100,
      dataPoints: recentData.length,
      uptime: calculateUptime(recentData),
    }

  } catch (error) {
    console.error('Error calculating performance metrics:', error)
    return {
      avgPower: 0,
      peakPower: 0,
      avgEfficiency: 0,
      dataPoints: 0,
      uptime: 0,
    }
  }
}

/**
 * Calculate device uptime based on recent data
 */
function calculateUptime(data: any[]): number {
  if (data.length === 0) return 0

  const now = new Date()
  const oldestTimestamp = new Date(data[data.length - 1].timestamp)
  const totalPeriod = (now.getTime() - oldestTimestamp.getTime()) / (1000 * 60 * 60) // hours

  // Count data points where device was online
  const onlinePoints = data.filter(d => 
    d.deviceStatus !== 'offline' && d.deviceStatus !== 'error'
  ).length

  // Estimate uptime based on data point frequency
  const uptimePercentage = (onlinePoints / data.length) * 100
  return Math.round(uptimePercentage * 100) / 100
}

/**
 * Get device status summary
 */
function getDeviceStatusSummary(health: any, alerts: any[]): string {
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
