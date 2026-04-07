import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry, deviceHealth } from '@/lib/db/schema-telemetry'
import { facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

interface FacilityPerformance {
  id: string
  name: string
  location: string
  energyGenerated: number
  efficiency: number
  uptime: number
  alerts: number
  lastMaintenance: string
}

/**
 * GET /api/admin/solar/facility-performance?period=7d|30d|90d
 * Fetch facility performance data for a specific time period
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

    // Fetch facility performance data
    const facilityData = await db
      .select({
        facilityId: facilities.id,
        facilityName: facilities.name,
        facilityLocation: facilities.city,
        energyGenerated: sql<number>`SUM(CASE WHEN ${deviceTelemetry.solarGeneration} > 0 THEN ${deviceTelemetry.solarGeneration} ELSE 0 END)`.as('energyGenerated'),
        avgEfficiency: sql<number>`AVG(${deviceTelemetry.power})`.as('avgEfficiency'),
        avgPower: sql<number>`AVG(${deviceTelemetry.power})`.as('avgPower'),
        totalDevices: sql<number>`COUNT(DISTINCT ${deviceTelemetry.deviceId})`.as('totalDevices'),
        onlineDevices: sql<number>`COUNT(DISTINCT CASE WHEN ${deviceTelemetry.deviceStatus} = 'normal' THEN ${deviceTelemetry.deviceId} END)`.as('onlineDevices'),
        alertsCount: sql<number>`COUNT(CASE WHEN ${deviceTelemetry.deviceStatus} IN ('warning', 'error') THEN 1 END)`.as('alertsCount'),
        lastMaintenance: sql<string>`MAX(${deviceHealth.lastSeen})`.as('lastMaintenance'),
        avgUptime: sql<number>`AVG(${deviceTelemetry.batteryLevel})`.as('avgUptime'),
      })
      .from(facilities)
      .leftJoin(
        deviceTelemetry,
        and(
          eq(deviceTelemetry.facilityId, facilities.id),
          gte(deviceTelemetry.timestamp, startDate),
          lte(deviceTelemetry.timestamp, now)
        )
      )
      .leftJoin(
        deviceHealth,
        and(
          eq(deviceHealth.deviceId, deviceTelemetry.deviceId),
          eq(deviceHealth.facilityId, facilities.id)
        )
      )
      .groupBy(facilities.id, facilities.name, facilities.city)
      .orderBy(desc(sql`energyGenerated`))

    // Transform the data
    const transformedData: FacilityPerformance[] = facilityData.map(facility => ({
      id: facility.facilityId,
      name: facility.facilityName || 'Unknown Facility',
      location: facility.facilityLocation || 'Unknown Location',
      energyGenerated: Number(facility.energyGenerated) || 0,
      efficiency: Number(facility.avgEfficiency) || 0,
      uptime: facility.totalDevices > 0 ? (Number(facility.onlineDevices) / Number(facility.totalDevices)) * 100 : 0,
      alerts: Number(facility.alertsCount) || 0,
      lastMaintenance: facility.lastMaintenance ? new Date(facility.lastMaintenance).toISOString().split('T')[0] : 'Never',
    }))

    return NextResponse.json({
      success: true,
      data: transformedData
    })

  } catch (error) {
    console.error('Error fetching facility performance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
