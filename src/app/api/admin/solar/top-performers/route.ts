import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry, deviceHealth } from '@/lib/db/schema-telemetry'
import { facilities, devices } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

interface TopPerformer {
  id: string
  serialNumber: string
  facilityName: string
  metric: string
  value: number
  change: number
  trend: 'up' | 'down'
  status: 'online' | 'offline'
}

/**
 * GET /api/admin/solar/top-performers?metric=energy|efficiency|uptime
 * Fetch top performing devices based on specified metric
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') || 'energy'
    
    // Calculate date ranges for comparison (current vs previous period)
    const now = new Date()
    const currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const previousPeriodEnd = currentPeriodStart
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - 30 * 24 * 60 * 60 * 1000)

    let currentData, previousData

    switch (metric) {
      case 'energy':
        currentData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            facilityId: deviceTelemetry.facilityId,
            facilityName: facilities.name,
            serialNumber: devices.serialNumber,
            metricValue: sql<number>`SUM(${deviceTelemetry.solarGeneration})`.as('metricValue'),
            deviceStatus: deviceTelemetry.deviceStatus,
          })
          .from(deviceTelemetry)
          .leftJoin(facilities, eq(deviceTelemetry.facilityId, facilities.id))
          .leftJoin(devices, eq(deviceTelemetry.deviceId, devices.id))
          .where(
            and(
              gte(deviceTelemetry.timestamp, currentPeriodStart),
              lte(deviceTelemetry.timestamp, now)
            )
          )
          .groupBy(deviceTelemetry.deviceId, deviceTelemetry.facilityId, facilities.name, devices.serialNumber)
          .orderBy(desc(sql`metricValue`))
          .limit(10)

        previousData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            metricValue: sql<number>`SUM(${deviceTelemetry.solarGeneration})`.as('metricValue'),
          })
          .from(deviceTelemetry)
          .where(
            and(
              gte(deviceTelemetry.timestamp, previousPeriodStart),
              lte(deviceTelemetry.timestamp, previousPeriodEnd)
            )
          )
          .groupBy(deviceTelemetry.deviceId)
        break

      case 'efficiency':
        currentData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            facilityId: deviceTelemetry.facilityId,
            facilityName: facilities.name,
            serialNumber: devices.serialNumber,
            metricValue: sql<number>`AVG(${deviceTelemetry.power})`.as('metricValue'),
            deviceStatus: deviceTelemetry.deviceStatus,
          })
          .from(deviceTelemetry)
          .leftJoin(facilities, eq(deviceTelemetry.facilityId, facilities.id))
          .leftJoin(devices, eq(deviceTelemetry.deviceId, devices.id))
          .where(
            and(
              gte(deviceTelemetry.timestamp, currentPeriodStart),
              lte(deviceTelemetry.timestamp, now)
            )
          )
          .groupBy(deviceTelemetry.deviceId, deviceTelemetry.facilityId, facilities.name, devices.serialNumber)
          .orderBy(desc(sql`metricValue`))
          .limit(10)

        previousData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            metricValue: sql<number>`AVG(${deviceTelemetry.power})`.as('metricValue'),
          })
          .from(deviceTelemetry)
          .where(
            and(
              gte(deviceTelemetry.timestamp, previousPeriodStart),
              lte(deviceTelemetry.timestamp, previousPeriodEnd)
            )
          )
          .groupBy(deviceTelemetry.deviceId)
        break

      case 'uptime':
        currentData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            facilityId: deviceTelemetry.facilityId,
            facilityName: facilities.name,
            serialNumber: devices.serialNumber,
            metricValue: sql<number>`COUNT(*)`.as('metricValue'),
            deviceStatus: deviceTelemetry.deviceStatus,
          })
          .from(deviceTelemetry)
          .leftJoin(facilities, eq(deviceTelemetry.facilityId, facilities.id))
          .leftJoin(devices, eq(deviceTelemetry.deviceId, devices.id))
          .where(
            and(
              gte(deviceTelemetry.timestamp, currentPeriodStart),
              lte(deviceTelemetry.timestamp, now),
              eq(deviceTelemetry.deviceStatus, 'normal')
            )
          )
          .groupBy(deviceTelemetry.deviceId, deviceTelemetry.facilityId, facilities.name, devices.serialNumber)
          .orderBy(desc(sql`metricValue`))
          .limit(10)

        previousData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            metricValue: sql<number>`COUNT(*)`.as('metricValue'),
          })
          .from(deviceTelemetry)
          .where(
            and(
              gte(deviceTelemetry.timestamp, previousPeriodStart),
              lte(deviceTelemetry.timestamp, previousPeriodEnd),
              eq(deviceTelemetry.deviceStatus, 'normal')
            )
          )
          .groupBy(deviceTelemetry.deviceId)
        break

      default:
        // Default to energy
        currentData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            facilityId: deviceTelemetry.facilityId,
            facilityName: facilities.name,
            serialNumber: devices.serialNumber,
            metricValue: sql<number>`SUM(${deviceTelemetry.solarGeneration})`.as('metricValue'),
            deviceStatus: deviceTelemetry.deviceStatus,
          })
          .from(deviceTelemetry)
          .leftJoin(facilities, eq(deviceTelemetry.facilityId, facilities.id))
          .leftJoin(devices, eq(deviceTelemetry.deviceId, devices.id))
          .where(
            and(
              gte(deviceTelemetry.timestamp, currentPeriodStart),
              lte(deviceTelemetry.timestamp, now)
            )
          )
          .groupBy(deviceTelemetry.deviceId, deviceTelemetry.facilityId, facilities.name, devices.serialNumber)
          .orderBy(desc(sql`metricValue`))
          .limit(10)

        previousData = await db
          .select({
            deviceId: deviceTelemetry.deviceId,
            metricValue: sql<number>`SUM(${deviceTelemetry.solarGeneration})`.as('metricValue'),
          })
          .from(deviceTelemetry)
          .where(
            and(
              gte(deviceTelemetry.timestamp, previousPeriodStart),
              lte(deviceTelemetry.timestamp, previousPeriodEnd)
            )
          )
          .groupBy(deviceTelemetry.deviceId)
    }

    // Transform data and calculate trends
    const transformedData: TopPerformer[] = currentData.map(current => {
      const previous = previousData.find(prev => prev.deviceId === current.deviceId)
      const currentValue = Number(current.metricValue) || 0
      const previousValue = Number(previous?.metricValue) || 0
      
      const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0
      const trend = change >= 0 ? 'up' : 'down'
      
      return {
        id: current.deviceId,
        serialNumber: current.serialNumber || `Device-${current.deviceId}`,
        facilityName: current.facilityName || 'Unknown Facility',
        metric,
        value: currentValue,
        change: Math.round(change * 10) / 10, // Round to 1 decimal place
        trend,
        status: current.deviceStatus === 'normal' ? 'online' : 'offline'
      }
    })

    return NextResponse.json({
      success: true,
      data: transformedData
    })

  } catch (error) {
    console.error('Error fetching top performers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
