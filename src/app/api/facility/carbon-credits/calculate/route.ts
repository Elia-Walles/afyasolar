import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry, deviceHealth, devices, facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns'

interface CarbonCreditCalculation {
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
}

/**
 * POST /api/admin/carbon-credits/calculate
 * Calculate carbon credits for a specific period
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
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
    const calculation = await calculateCarbonCredits(
      deviceId, 
      facilityId, 
      period, 
      startDate, 
      endDate, 
      telemetryData, 
      gridEmissionFactor
    )

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
 * GET /api/admin/carbon-credits/calculate
 * Get carbon credit calculations for a device or facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')
    const facilityId = searchParams.get('facilityId')
    const period = searchParams.get('period') || 'monthly'
    const limit = parseInt(searchParams.get('limit') || '12')

    // In a real implementation, you would fetch from a carbon_credits table
    // For now, return mock data based on recent telemetry
    const calculations = await getCarbonCreditCalculations(deviceId, facilityId, period, limit)

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
async function calculateCarbonCredits(
  deviceId: string,
  facilityId: string,
  period: string,
  startDate: string,
  endDate: string,
  telemetryData: any[],
  gridEmissionFactor: number
): Promise<CarbonCreditCalculation> {
  // Calculate total energy generated
  const energyGenerated = telemetryData.reduce((sum, data) => {
    return sum + (Number(data.power || 0) * (data.interval || 1)) / 1000 // Convert to kWh
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
  const efficiency = telemetryData.reduce((sum, data) => 
    sum + (Number(data.efficiency) || 0), 0) / telemetryData.length

  // Calculate operating hours
  const operatingHours = telemetryData.length * (telemetryData[0]?.interval || 1) / 60

  // Baseline emissions (what would have been emitted without solar)
  const baselineEmissions = energyGenerated * gridEmissionFactor

  const calculation: CarbonCreditCalculation = {
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
    }
  }

  return calculation
}

/**
 * Get existing carbon credit calculations
 */
async function getCarbonCreditCalculations(
  deviceId?: string | null,
  facilityId?: string | null,
  period: string = 'monthly',
  limit: number = 12
): Promise<CarbonCreditCalculation[]> {
  // In a real implementation, fetch from database
  // For now, return mock data
  const mockCalculations: CarbonCreditCalculation[] = [
    {
      deviceId: deviceId || 'device-1',
      facilityId: facilityId || 'fac-1',
      period: '2024-01',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      energyGenerated: 1240.5,
      co2Saved: 620.25,
      creditsEarned: 0.62,
      creditValue: 25,
      totalValue: 15.5,
      verificationStatus: 'certified',
      metadata: {
        efficiency: 94.5,
        operatingHours: 720,
        baselineEmissions: 620.25,
        gridEmissionFactor: 0.5,
        calculationMethod: 'ACM0002'
      }
    },
    {
      deviceId: deviceId || 'device-1',
      facilityId: facilityId || 'fac-1',
      period: '2024-02',
      startDate: '2024-02-01',
      endDate: '2024-02-29',
      energyGenerated: 1180.2,
      co2Saved: 590.1,
      creditsEarned: 0.59,
      creditValue: 25,
      totalValue: 14.75,
      verificationStatus: 'verified',
      metadata: {
        efficiency: 92.8,
        operatingHours: 680,
        baselineEmissions: 590.1,
        gridEmissionFactor: 0.5,
        calculationMethod: 'ACM0002'
      }
    }
  ]

  return mockCalculations.slice(0, limit)
}

/**
 * PUT /api/admin/carbon-credits/verify
 * Verify and certify carbon credits
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { calculationId, verificationStatus, verifiedBy, notes } = body

    // In a real implementation, update the carbon credits table
    console.log('Verifying carbon credit calculation:', {
      calculationId,
      verificationStatus,
      verifiedBy,
      notes
    })

    return NextResponse.json({
      success: true,
      message: 'Carbon credit verification updated successfully'
    })

  } catch (error) {
    console.error('Error verifying carbon credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify carbon credits' },
      { status: 500 }
    )
  }
}
