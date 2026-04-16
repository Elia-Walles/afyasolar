import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { carbonCredits, facilityEnergyAssessments } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
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
    if (!deviceId || !period) {
      return NextResponse.json({ 
        error: 'Missing required fields: deviceId, period' 
      }, { status: 400 })
    }

    // For custom windows, startDate/endDate are required.
    if (period === "custom" && (!startDate || !endDate)) {
      return NextResponse.json({ error: "Missing required fields for custom period: startDate, endDate" }, { status: 400 })
    }

    const effectiveFacilityId =
      (session.user.role === 'facility' ? session.user.facilityId : facilityId) || facilityId

    if (!effectiveFacilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    if (session.user.role === 'facility' && session.user.facilityId !== effectiveFacilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculate carbon credits based on the latest saved energy assessment snapshot (DB-driven).
    const [latestEnergy] = await db
      .select()
      .from(facilityEnergyAssessments)
      .where(eq(facilityEnergyAssessments.facilityId, effectiveFacilityId))
      .orderBy(desc(facilityEnergyAssessments.assessmentDate), desc(facilityEnergyAssessments.updatedAt))
      .limit(1)

    const payload = latestEnergy?.payload as any
    // Prefer quoteData (if Design & Finance engine was saved), otherwise estimate from sizing snapshot.
    const dailySolarKwhFromQuote: number = Number(
      payload?.quoteData?.solar_production?.estimated_daily_solar_generation_kwh ?? 0,
    )
    const solarArraySizeKw: number = Number(
      payload?.sizingSummary?.solarArraySize ??
        payload?.calculations?.solarArraySize ??
        payload?.sizingData?.sizingSummary?.solarArraySize ??
        0,
    )
    const facilityTypeRaw: string | null =
      payload?.facilityData?.facilityType ??
      payload?.facilityData?.facility_type ??
      payload?.facilityContext?.facilityType ??
      payload?.facilityContext?.facility_type ??
      null

    const peakSunHoursWorstMonth = 4.5
    const derateFactor =
      facilityTypeRaw && typeof facilityTypeRaw === "string"
        ? facilityTypeRaw.includes("off-grid") || facilityTypeRaw.includes("off_grid")
          ? 0.7
          : facilityTypeRaw.includes("hybrid")
            ? 0.75
            : 0.8
        : 0.8

    const dailySolarKwhEstimate: number = solarArraySizeKw > 0 ? solarArraySizeKw * peakSunHoursWorstMonth * derateFactor : 0
    const dailySolarKwh = dailySolarKwhFromQuote > 0 ? dailySolarKwhFromQuote : dailySolarKwhEstimate

    if (!Number.isFinite(dailySolarKwh) || dailySolarKwh <= 0) {
      return NextResponse.json(
        { error: 'No saved solar generation found in assessment snapshot' },
        { status: 404 }
      )
    }

    const baseEnd = latestEnergy?.assessmentDate ? new Date(latestEnergy.assessmentDate) : new Date()
    const msPerDay = 24 * 60 * 60 * 1000
    const safeBaseEnd = Number.isNaN(baseEnd.getTime()) ? new Date() : baseEnd

    let derivedStart: Date
    let derivedEnd: Date

    if (period === "daily") {
      derivedStart = safeBaseEnd
      derivedEnd = safeBaseEnd
    } else if (period === "weekly") {
      derivedEnd = safeBaseEnd
      derivedStart = new Date(safeBaseEnd.getTime() - 6 * msPerDay)
    } else if (period === "monthly") {
      derivedStart = new Date(safeBaseEnd.getFullYear(), safeBaseEnd.getMonth(), 1)
      derivedEnd = new Date(safeBaseEnd.getFullYear(), safeBaseEnd.getMonth() + 1, 0)
    } else if (period === "yearly") {
      derivedStart = new Date(safeBaseEnd.getFullYear(), 0, 1)
      derivedEnd = new Date(safeBaseEnd.getFullYear(), 11, 31)
    } else if (period === "custom") {
      derivedStart = new Date(startDate)
      derivedEnd = new Date(endDate)
      if (Number.isNaN(derivedStart.getTime()) || Number.isNaN(derivedEnd.getTime()) || derivedEnd.getTime() < derivedStart.getTime()) {
        return NextResponse.json({ error: "Invalid custom startDate/endDate" }, { status: 400 })
      }
    } else {
      // Unknown period => treat as monthly.
      derivedStart = new Date(safeBaseEnd.getFullYear(), safeBaseEnd.getMonth(), 1)
      derivedEnd = new Date(safeBaseEnd.getFullYear(), safeBaseEnd.getMonth() + 1, 0)
    }

    const daysInclusive = Math.floor((derivedEnd.getTime() - derivedStart.getTime()) / msPerDay) + 1

    // Allocate carbon credits to the selected "device" (MEU device) by its share of daily kWh.
    const meuTop = payload?.meuSummary?.topDevices
    const totalDailyLoad = Number(payload?.meuSummary?.totalDailyLoad ?? 0)
    const match = typeof deviceId === "string" ? deviceId.match(/^meu-(\d+)$/) : null
    const idx = match ? Number(match[1]) : null
    const devDailyKwh =
      idx !== null && Array.isArray(meuTop) && meuTop[idx] ? Number(meuTop[idx].dailyKwh ?? 0) : null
    const deviceRatio = totalDailyLoad > 0 && devDailyKwh !== null ? devDailyKwh / totalDailyLoad : 1

    const energyGenerated = dailySolarKwh * Math.max(1, daysInclusive) * Math.max(0, deviceRatio)

    const totalDailyLoadKwh: number = Number(payload?.quoteData?.load_analysis?.total_daily_energy_kwh ?? 0)
    const efficiency = totalDailyLoadKwh > 0 ? (dailySolarKwh / totalDailyLoadKwh) * 100 : 0

    const co2Saved = energyGenerated * gridEmissionFactor // kg CO2
    const creditsEarned = co2Saved / 1000
    const creditValue = 25 // USD per ton
    const totalValue = creditsEarned * creditValue

    const calculation: CarbonCreditCalculation = {
      id: generateId(),
      deviceId,
      facilityId: effectiveFacilityId,
      period,
      startDate: derivedStart.toISOString(),
      endDate: derivedEnd.toISOString(),
      energyGenerated: Math.round(energyGenerated * 100) / 100,
      co2Saved: Math.round(co2Saved * 100) / 100,
      creditsEarned: Math.round(creditsEarned * 100) / 100,
      creditValue,
      totalValue: Math.round(totalValue * 100) / 100,
      verificationStatus: 'pending',
      metadata: {
        efficiency: Math.round(efficiency * 100) / 100,
        operatingHours: 12,
        baselineEmissions: Math.round(co2Saved * 100) / 100,
        gridEmissionFactor,
        calculationMethod: 'assessment-snapshot',
      },
      createdAt: new Date().toISOString(),
    }

    // Prevent duplicated rows when the user clicks "Calculate Credits" multiple times.
    await db
      .delete(carbonCredits)
      .where(
        and(
          eq(carbonCredits.facilityId, effectiveFacilityId),
          eq(carbonCredits.deviceId, deviceId),
          eq(carbonCredits.period, period),
          eq(carbonCredits.startDate, derivedStart),
          eq(carbonCredits.endDate, derivedEnd),
        ),
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

    if (rows.length > 0) {
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
        data: calculations,
      })
    }

    // No persisted rows yet; compute from latest saved assessment snapshot.
    const [latestEnergy] = await db
      .select()
      .from(facilityEnergyAssessments)
      .where(eq(facilityEnergyAssessments.facilityId, facilityId))
      .orderBy(desc(facilityEnergyAssessments.assessmentDate), desc(facilityEnergyAssessments.updatedAt))
      .limit(1)

    const payload = latestEnergy?.payload as any

    // Prefer quoteData (if Design & Finance engine was saved), otherwise estimate from sizing snapshot.
    const dailySolarKwhFromQuote: number = Number(
      payload?.quoteData?.solar_production?.estimated_daily_solar_generation_kwh ?? 0,
    )
    const solarArraySizeKw: number = Number(
      payload?.sizingSummary?.solarArraySize ??
        payload?.calculations?.solarArraySize ??
        payload?.sizingData?.sizingSummary?.solarArraySize ??
        0,
    )
    const facilityTypeRaw: string | null =
      payload?.facilityData?.facilityType ??
      payload?.facilityData?.facility_type ??
      payload?.facilityContext?.facilityType ??
      payload?.facilityContext?.facility_type ??
      null

    const peakSunHoursWorstMonth = 4.5
    const derateFactor =
      facilityTypeRaw && typeof facilityTypeRaw === "string"
        ? facilityTypeRaw.includes("off-grid") || facilityTypeRaw.includes("off_grid")
          ? 0.7
          : facilityTypeRaw.includes("hybrid")
            ? 0.75
            : 0.8
        : 0.8

    const dailySolarKwhEstimate: number =
      solarArraySizeKw > 0 ? solarArraySizeKw * peakSunHoursWorstMonth * derateFactor : 0
    const dailySolarKwh = dailySolarKwhFromQuote > 0 ? dailySolarKwhFromQuote : dailySolarKwhEstimate

    if (!Number.isFinite(dailySolarKwh) || dailySolarKwh <= 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const totalDailyLoadKwh: number =
      Number(payload?.quoteData?.load_analysis?.total_daily_energy_kwh ?? 0) ||
      Number(payload?.meuSummary?.totalDailyLoad ?? payload?.sizingSummary?.totalDailyLoad ?? 0)
    const efficiency = totalDailyLoadKwh > 0 ? (dailySolarKwh / totalDailyLoadKwh) * 100 : 0

    const creditValue = 25 // USD per ton
    const gridFactor = 0.5 // kg CO2 per kWh (default)

    const baseEnd = latestEnergy?.assessmentDate ? new Date(latestEnergy.assessmentDate) : new Date()
    const safeBaseEnd = Number.isNaN(baseEnd.getTime()) ? new Date() : baseEnd

    const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
    const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate()

    // Allocate carbon credits to the selected "device" (MEU device) by share of daily kWh.
    const meuTop = payload?.meuSummary?.topDevices
    const meuTotalDailyLoad = Number(payload?.meuSummary?.totalDailyLoad ?? 0)
    const match = typeof deviceId === "string" ? deviceId.match(/^meu-(\d+)$/) : null
    const idx = match ? Number(match[1]) : null
    const devDailyKwh =
      idx !== null && Array.isArray(meuTop) && meuTop[idx] ? Number(meuTop[idx].dailyKwh ?? 0) : null
    const deviceRatio = meuTotalDailyLoad > 0 && devDailyKwh !== null ? devDailyKwh / meuTotalDailyLoad : 1

    const makeRecord = (p: string, start: Date, end: Date): CarbonCreditCalculation => {
      const msPerDay = 24 * 60 * 60 * 1000
      const daysInclusive = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
      const energyGenerated = dailySolarKwh * Math.max(1, daysInclusive) * Math.max(0, deviceRatio)
      const co2Saved = energyGenerated * gridFactor
      const creditsEarned = co2Saved / 1000
      const totalValue = creditsEarned * creditValue

      return {
        id: generateId(),
        deviceId: deviceId ?? 'facility-solar',
        facilityId,
        period: p,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        energyGenerated: Math.round(energyGenerated * 100) / 100,
        co2Saved: Math.round(co2Saved * 100) / 100,
        creditsEarned: Math.round(creditsEarned * 100) / 100,
        creditValue,
        totalValue: Math.round(totalValue * 100) / 100,
        verificationStatus: 'pending',
        metadata: {
          efficiency: Math.round(Math.max(0, efficiency) * 100) / 100,
          operatingHours: 12,
          baselineEmissions: Math.round(co2Saved * 100) / 100,
          gridEmissionFactor: gridFactor,
          calculationMethod: 'assessment-snapshot',
        },
        createdAt: new Date().toISOString(),
      }
    }

    const periodKey = period || 'monthly'
    const computed: CarbonCreditCalculation[] = []
    for (let i = 0; i < limit; i++) {
      if (periodKey === 'daily') {
        const end = addDays(safeBaseEnd, -i)
        computed.push(makeRecord('daily', end, end))
      } else if (periodKey === 'weekly') {
        const end = addDays(safeBaseEnd, -i * 7)
        const start = addDays(end, -6)
        computed.push(makeRecord('weekly', start, end))
      } else if (periodKey === 'monthly') {
        const y = safeBaseEnd.getFullYear()
        const m0 = safeBaseEnd.getMonth()
        const target = new Date(y, m0 - i, 1)
        const start = new Date(target.getFullYear(), target.getMonth(), 1)
        const end = new Date(target.getFullYear(), target.getMonth(), daysInMonth(target.getFullYear(), target.getMonth()))
        computed.push(makeRecord('monthly', start, end))
      } else if (periodKey === 'yearly') {
        const year = safeBaseEnd.getFullYear() - i
        const start = new Date(year, 0, 1)
        const end = new Date(year, 11, 31)
        computed.push(makeRecord('yearly', start, end))
      } else {
        const target = new Date(safeBaseEnd.getFullYear(), safeBaseEnd.getMonth() - i, 1)
        const start = new Date(target.getFullYear(), target.getMonth(), 1)
        const end = new Date(target.getFullYear(), target.getMonth(), daysInMonth(target.getFullYear(), target.getMonth()))
        computed.push(makeRecord(periodKey, start, end))
      }
    }

    return NextResponse.json({
      success: true,
      data: computed,
    })

  } catch (error) {
    console.error('Error fetching carbon credit calculations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch carbon credit calculations' },
      { status: 500 }
    )
  }
}

