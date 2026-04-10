import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { carbonCredits, deviceTelemetry, devices } from '@/lib/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

interface CarbonCreditCalculation {
  id: string
  deviceId: string
  facilityId: string
  period: string
  startDate: string
  endDate: string
  energyGenerated: number // kWh
  co2Saved: number // kg
  creditsEarned: number // tons
  creditValue: number // USD per ton
  totalValue: number // USD
  verificationStatus: 'pending' | 'verified' | 'certified' | 'rejected'
  metadata: {
    efficiency: number
    operatingHours: number
    baselineEmissions: number
    gridEmissionFactor: number
    calculationMethod: string
  }
  createdAt: string
}

/**
 * POST /api/facility/carbon-credits/calculate
 * Calculate carbon credits for a specific period
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'facility' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      deviceId, 
      facilityId, 
      period, 
      startDate, 
      endDate,
      gridEmissionFactor = 0.5 // kg CO2 per kWh (Rwanda grid average)
    } = body

    // Validate input
    if (!deviceId || !period || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Missing required fields: deviceId, period, startDate, endDate' 
      }, { status: 400 })
    }

    const effectiveFacilityId =
      (session.user.role === 'facility' ? session.user.facilityId : facilityId) || facilityId

    if (!effectiveFacilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    if (session.user.role === 'facility' && session.user.facilityId !== effectiveFacilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [deviceRow] = await db
      .select({ id: devices.id, facilityId: devices.facilityId })
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1)

    if (!deviceRow) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }
    if (deviceRow.facilityId !== effectiveFacilityId) {
      return NextResponse.json({ error: 'Device does not belong to facility' }, { status: 403 })
    }

    // Get telemetry data for the period
    const telemetryData = await db
      .select()
      .from(deviceTelemetry)
      .where(and(
        eq(deviceTelemetry.deviceId, deviceId),
        gte(deviceTelemetry.timestamp, new Date(startDate)),
        lte(deviceTelemetry.timestamp, new Date(endDate))
      ))
      .orderBy(desc(deviceTelemetry.timestamp))

    if (telemetryData.length === 0) {
      return NextResponse.json({ 
        error: 'No telemetry data found for the specified period' 
      }, { status: 404 })
    }

    // Calculate carbon credits
    const calculation = calculateCarbonCredits(
      deviceId,
      effectiveFacilityId,
      period, 
      startDate, 
      endDate, 
      telemetryData, 
      gridEmissionFactor
    )

    await db.insert(carbonCredits).values({
      id: calculation.id,
      deviceId: calculation.deviceId,
      facilityId: calculation.facilityId,
      period: calculation.period,
      startDate: new Date(calculation.startDate),
      endDate: new Date(calculation.endDate),
      energyGeneratedKwh: calculation.energyGenerated.toString(),
      co2SavedKg: calculation.co2Saved.toString(),
      creditsEarnedTons: calculation.creditsEarned.toString(),
      creditValueUsd: calculation.creditValue.toString(),
      totalValueUsd: calculation.totalValue.toString(),
      verificationStatus: calculation.verificationStatus,
      metadata: calculation.metadata as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      data: calculation
    })

  } catch (error) {
    console.error('Error calculating carbon credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate carbon credits' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/facility/carbon-credits/calculate
 * Get persisted carbon credit calculations for a facility or device
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'facility' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')
    const facilityIdParam = searchParams.get('facilityId')
    const period = searchParams.get('period') || 'monthly'
    const limit = parseInt(searchParams.get('limit') || '12')

    const facilityId =
      (session.user.role === 'facility' ? session.user.facilityId : facilityIdParam) || facilityIdParam

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }
    if (session.user.role === 'facility' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conditions = [eq(carbonCredits.facilityId, facilityId)]
    if (deviceId) conditions.push(eq(carbonCredits.deviceId, deviceId))
    if (period && period !== 'all') conditions.push(eq(carbonCredits.period, period))

    const rows = await db
      .select()
      .from(carbonCredits)
      .where(and(...conditions))
      .orderBy(desc(carbonCredits.createdAt))
      .limit(limit)

    const calculations: CarbonCreditCalculation[] = rows.map((r: any) => ({
      id: r.id,
      deviceId: r.deviceId,
      facilityId: r.facilityId,
      period: r.period,
      startDate: new Date(r.startDate).toISOString(),
      endDate: new Date(r.endDate).toISOString(),
      energyGenerated: Number(r.energyGeneratedKwh ?? 0),
      co2Saved: Number(r.co2SavedKg ?? 0),
      creditsEarned: Number(r.creditsEarnedTons ?? 0),
      creditValue: Number(r.creditValueUsd ?? 0),
      totalValue: Number(r.totalValueUsd ?? 0),
      verificationStatus: r.verificationStatus,
      metadata: (r.metadata ?? {}) as any,
      createdAt: new Date(r.createdAt).toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: calculations
    })

  } catch (error) {
    console.error('Error fetching carbon credit calculations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch carbon credit calculations' },
      { status: 500 }
    )
  }
}

/**
 * Calculate carbon credits based on telemetry data
 */
function calculateCarbonCredits(
  deviceId: string,
  facilityId: string,
  period: string,
  startDate: string,
  endDate: string,
  telemetryData: any[],
  gridEmissionFactor: number
): CarbonCreditCalculation {
  const timestamps = telemetryData
    .map((t) => (t?.timestamp ? new Date(t.timestamp).getTime() : NaN))
    .filter((n: number) => Number.isFinite(n))
  const minTs = timestamps.length ? Math.min(...timestamps) : NaN
  const maxTs = timestamps.length ? Math.max(...timestamps) : NaN

  // Prefer solarGeneration (kWh), fallback to energy (kWh)
  const energyGenerated = telemetryData.reduce((sum, data) => {
    const v = data?.solarGeneration ?? data?.energy ?? 0
    return sum + Number(v || 0)
  }, 0)

  // Calculate CO2 savings
  // Formula: Energy Generated × Grid Emission Factor
  const co2Saved = energyGenerated * gridEmissionFactor // kg CO2

  // Convert to tons (1 ton = 1000 kg)
  const creditsEarned = co2Saved / 1000

  // Market value of carbon credits (varies by market)
  const creditValue = 25 // USD per ton (average market price)
  const totalValue = creditsEarned * creditValue

  // Calculate average efficiency
  const efficiency =
    telemetryData.length > 0
      ? telemetryData.reduce((sum, data) => sum + (Number(data.efficiency) || 0), 0) / telemetryData.length
      : 0

  // Calculate operating hours
  const operatingHours = Number.isFinite(minTs) && Number.isFinite(maxTs) ? Math.max(0, (maxTs - minTs) / 36e5) : 0

  // Baseline emissions (what would have been emitted without solar)
  const baselineEmissions = energyGenerated * gridEmissionFactor

  const calculation: CarbonCreditCalculation = {
    id: generateId(),
    deviceId,
    facilityId,
    period,
    startDate,
    endDate,
    energyGenerated: Math.round(energyGenerated * 100) / 100,
    co2Saved: Math.round(co2Saved * 100) / 100,
    creditsEarned: Math.round(creditsEarned * 100) / 100,
    creditValue,
    totalValue: Math.round(totalValue * 100) / 100,
    verificationStatus: 'pending',
    metadata: {
      efficiency: Math.round(efficiency * 100) / 100,
      operatingHours: Math.round(operatingHours * 100) / 100,
      baselineEmissions: Math.round(baselineEmissions * 100) / 100,
      gridEmissionFactor,
      calculationMethod: 'ACM0002' // Approved Carbon Methodology
    },
    createdAt: new Date().toISOString(),
  }

  return calculation
}
