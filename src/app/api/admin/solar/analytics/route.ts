import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry, deviceHealth, devicePerformanceAnalytics } from '@/lib/db/schema-telemetry'
import { facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/solar/analytics?period=7d|30d|90d
 * Fetch solar analytics data for a specific time period
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    
    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Fetch analytics data from database
    const [analyticsData] = await db
      .select({
        totalEnergy: sql<number>`SUM(CASE WHEN ${deviceTelemetry.solarGeneration} > 0 THEN ${deviceTelemetry.solarGeneration} ELSE 0 END)`.as('totalEnergy'),
        avgEfficiency: sql<number>`AVG(${deviceTelemetry.power})`.as('avgEfficiency'),
        peakPower: sql<number>`MAX(${deviceTelemetry.power})`.as('peakPower'),
        avgPower: sql<number>`AVG(${deviceTelemetry.power})`.as('avgPower'),
        totalDevices: sql<number>`COUNT(DISTINCT ${deviceTelemetry.deviceId})`.as('totalDevices'),
        onlineDevices: sql<number>`COUNT(DISTINCT CASE WHEN ${deviceTelemetry.deviceStatus} = 'normal' THEN ${deviceTelemetry.deviceId} END)`.as('onlineDevices'),
        alertsCount: sql<number>`COUNT(CASE WHEN ${deviceTelemetry.deviceStatus} IN ('warning', 'error') THEN 1 END)`.as('alertsCount'),
        avgTemperature: sql<number>`AVG(${deviceTelemetry.temperature})`.as('avgTemperature'),
        avgBatteryLevel: sql<number>`AVG(${deviceTelemetry.batteryLevel})`.as('avgBatteryLevel'),
      })
      .from(deviceTelemetry)
      .where(
        and(
          gte(deviceTelemetry.timestamp, startDate),
          lte(deviceTelemetry.timestamp, now)
        )
      )

    // Fetch device health data for uptime calculation
    const [healthData] = await db
      .select({
        totalDevices: sql<number>`COUNT(DISTINCT ${deviceHealth.deviceId})`.as('totalDevices'),
        onlineDevices: sql<number>`COUNT(DISTINCT CASE WHEN ${deviceHealth.onlineStatus} = true THEN ${deviceHealth.deviceId} END)`.as('onlineDevices'),
        avgUptime: sql<number>`AVG(${deviceHealth.efficiency})`.as('avgUptime'),
      })
      .from(deviceHealth)
      .where(
        gte(deviceHealth.lastSeen, startDate)
      )

    // Calculate derived metrics
    const totalEnergy = Number(analyticsData.totalEnergy) || 0
    const avgEfficiency = Number(analyticsData.avgEfficiency) || 0
    const peakPower = Number(analyticsData.peakPower) || 0
    const onlineDevices = Number(healthData.onlineDevices) || 0
    const totalDevices = Number(healthData.totalDevices) || 1
    const avgUptime = Number(healthData.avgUptime) || 0
    const alertsCount = Number(analyticsData.alertsCount) || 0

    // Calculate CO2 saved (approximate: 0.5 kg CO2 per kWh)
    const co2Saved = totalEnergy * 0.5
    
    // Calculate cost savings (approximate: TZS 150 per kWh saved)
    const costSavings = totalEnergy * 150
    
    // Calculate uptime percentage
    const uptime = totalDevices > 0 ? (onlineDevices / totalDevices) * 100 : 0

    const result = {
      period,
      totalEnergy,
      avgEfficiency,
      peakPower,
      co2Saved,
      costSavings,
      uptime,
      devicesOnline: onlineDevices,
      alertsCount,
      totalDevices,
      avgTemperature: Number(analyticsData.avgTemperature) || 0,
      avgBatteryLevel: Number(analyticsData.avgBatteryLevel) || 0,
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error fetching solar analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
