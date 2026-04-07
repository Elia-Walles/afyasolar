import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry } from '@/lib/db/schema-telemetry'
import { facilities } from '@/lib/db/schema'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/energy
 * Get energy telemetry data for a facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryFacilityId = searchParams.get('facilityId')
    const facilityId = queryFacilityId || session.user.facilityId
    
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const metric = searchParams.get('metric') // 'power', 'voltage', 'current', 'energy', etc.

    // Build query conditions
    const conditions = [eq(deviceTelemetry.facilityId, facilityId)]
    
    if (startDate) {
      conditions.push(gte(deviceTelemetry.timestamp, new Date(startDate)))
    }
    
    if (endDate) {
      conditions.push(lte(deviceTelemetry.timestamp, new Date(endDate)))
    }

    // Get telemetry data
    const telemetryData = await db
      .select()
      .from(deviceTelemetry)
      .where(and(...conditions))
      .orderBy(desc(deviceTelemetry.timestamp))
      .limit(limit)
      .offset(offset)

    // Get total count
    const totalCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deviceTelemetry)
      .where(and(...conditions))

    // Calculate daily energy summary
    const dateExpr = sql`DATE(${deviceTelemetry.timestamp})`.as('date')
    const dailySummaryQuery = db
      .select({
        date: dateExpr,
        totalEnergy: sql`SUM(COALESCE(${deviceTelemetry.energy}, 0))`.as('totalEnergy'),
        avgPower: sql`AVG(COALESCE(${deviceTelemetry.power}, 0))`.as('avgPower'),
        peakPower: sql`MAX(COALESCE(${deviceTelemetry.power}, 0))`.as('peakPower'),
        minBattery: sql`MIN(COALESCE(${deviceTelemetry.batteryLevel}, 0))`.as('minBattery'),
        maxBattery: sql`MAX(COALESCE(${deviceTelemetry.batteryLevel}, 0))`.as('maxBattery'),
        totalSolarGeneration: sql`SUM(COALESCE(${deviceTelemetry.solarGeneration}, 0))`.as('totalSolarGeneration'),
        avgVoltage: sql`AVG(COALESCE(${deviceTelemetry.voltage}, 0))`.as('avgVoltage')
      })
      .from(deviceTelemetry)
      .where(and(
        eq(deviceTelemetry.facilityId, facilityId),
        gte(deviceTelemetry.timestamp, sql`DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)`)
      ))
      .groupBy(dateExpr)
      .orderBy(desc(dateExpr))
      .limit(30)

    const dailySummary = await dailySummaryQuery

    // Ensure we always have valid data structure
    const safeDailySummary = Array.isArray(dailySummary) ? dailySummary : []
    const safeTelemetryData = Array.isArray(telemetryData) ? telemetryData : []

    return NextResponse.json({
      telemetry: safeTelemetryData,
      pagination: {
        total: Number(totalCount[0]?.count || 0),
        limit,
        offset,
        hasMore: (offset + limit) < Number(totalCount[0]?.count || 0)
      },
      summary: {
        daily: safeDailySummary,
        last30Days: {
          totalEnergy: safeDailySummary.reduce((sum, day) => sum + Number(day.totalEnergy || 0), 0),
          avgPower: safeDailySummary.length > 0 ? safeDailySummary.reduce((sum, day) => sum + Number(day.avgPower || 0), 0) / safeDailySummary.length : 0,
          peakPower: safeDailySummary.length > 0 ? Math.max(...safeDailySummary.map(day => Number(day.peakPower || 0))) : 0,
          minBattery: safeDailySummary.length > 0 ? Math.min(...safeDailySummary.map(day => Number(day.minBattery || 0))) : 0,
          maxBattery: safeDailySummary.length > 0 ? Math.max(...safeDailySummary.map(day => Number(day.maxBattery || 0))) : 0,
          totalSolarGeneration: safeDailySummary.reduce((sum, day) => sum + Number(day.totalSolarGeneration || 0), 0)
        }
      }
    })

  } catch (error) {
    console.error('Error fetching energy data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/energy
 * Store energy telemetry data (from inverter/gateway)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryFacilityId = searchParams.get('facilityId')
    const facilityId = queryFacilityId || session.user.facilityId
    
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { 
      deviceId,
      voltage,
      current,
      power,
      energy,
      frequency,
      solarGeneration,
      batteryLevel,
      batteryVoltage,
      temperature,
      gridStatus,
      deviceStatus,
      signalStrength,
      uptime,
      efficiency,
      powerFactor,
      alertCode,
      alertMessage,
      firmwareVersion,
      location,
      timestamp 
    } = body

    // Validate required timestamp
    if (!timestamp) {
      return NextResponse.json(
        { error: 'Missing required field: timestamp' },
        { status: 400 }
      )
    }

    // Get facility to verify device belongs to facility
    const [facility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Store telemetry data
    await db.insert(deviceTelemetry).values({
      id: generateId(),
      facilityId,
      deviceId: deviceId || generateId(),
      timestamp: new Date(timestamp),
      voltage: voltage ? voltage.toString() : null,
      current: current ? current.toString() : null,
      power: power ? power.toString() : null,
      energy: energy ? energy.toString() : null,
      frequency: frequency ? frequency.toString() : null,
      solarGeneration: solarGeneration ? solarGeneration.toString() : null,
      batteryLevel: batteryLevel ? batteryLevel.toString() : null,
      batteryVoltage: batteryVoltage ? batteryVoltage.toString() : null,
      temperature: temperature ? temperature.toString() : null,
      gridStatus: gridStatus || 'connected',
      deviceStatus: deviceStatus || 'normal',
      signalStrength: signalStrength || null,
      uptime: uptime ? uptime.toString() : null,
      efficiency: efficiency ? efficiency.toString() : null,
      powerFactor: powerFactor ? powerFactor.toString() : null,
      alertCode: alertCode || null,
      alertMessage: alertMessage || null,
      firmwareVersion: firmwareVersion || null,
      location: location || null
    })

    return NextResponse.json({
      success: true,
      message: 'Telemetry data stored successfully'
    })

  } catch (error) {
    console.error('Error storing energy data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
