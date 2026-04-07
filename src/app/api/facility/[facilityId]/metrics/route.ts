import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { devices, energyData } from '@/lib/db/schema'
import { eq, and, desc, gte } from 'drizzle-orm'

/**
 * GET /api/facility/[facilityId]/metrics
 * Get facility metrics including energy consumption, efficiency, and carbon credits
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { facilityId } = await params

    // Users can only see their own facility metrics, admins can see any
    if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get time range from query params (default to last 30 days)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Fetch devices for the facility
    const deviceRecords = await db
      .select()
      .from(devices)
      .where(eq(devices.facilityId, facilityId))

    const deviceIds = deviceRecords.map((d) => d.id)

    // If there are no devices, return empty metrics early
    if (deviceIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalConsumption: 0,
          maxPower: 0,
          totalSolarGeneration: 0,
          avgBatteryLevel: 0,
          solarPercentage: 0,
          efficiency: 0,
          costSavings: 0,
          carbonCreditEarned: 0,
          energyEfficiencyScore: 0,
          deviceCount: 0,
          dataPoints: 0,
          period: `${days} days`,
        },
      })
    }

    // Fetch energy data for all devices belonging to this facility
    const energyRecords = await db
      .select()
      .from(energyData)
      .where(
        and(
          // deviceId is the foreign key; scope by this facility's devices
          energyData.deviceId.in(deviceIds),
          gte(energyData.timestamp, startDate)
        )
      )
      .orderBy(desc(energyData.timestamp))

    // Calculate metrics
    let totalConsumption = 0
    let maxPower = 0
    let totalSolarGeneration = 0
    let batteryLevelSum = 0
    let batteryLevelCount = 0

    energyRecords.forEach(record => {
      const power = Number(record.power) || 0
      const energy = Number(record.energy) || 0
      const solarGeneration = Number(record.solarGeneration) || 0
      const batteryLevel = Number(record.batteryLevel)

      totalConsumption += energy
      totalSolarGeneration += solarGeneration
      maxPower = Math.max(maxPower, power)

      if (batteryLevel > 0) {
        batteryLevelSum += batteryLevel
        batteryLevelCount++
      }
    })

    // Calculate averages and percentages
    const avgBatteryLevel = batteryLevelCount > 0 ? batteryLevelSum / batteryLevelCount : 0
    const solarPercentage = totalConsumption > 0 ? (totalSolarGeneration / totalConsumption) * 100 : 0
    const efficiency = totalConsumption > 0 ? (totalSolarGeneration / totalConsumption) * 100 : 0

    // Calculate cost savings (assuming 357.14285 TSh per kWh and 40% savings with solar)
    const ratePerKwh = 357.14285
    const gridConsumption = Math.max(0, totalConsumption - totalSolarGeneration)
    const gridCost = gridConsumption * ratePerKwh
    const costSavings = gridCost * 0.4 * (solarPercentage / 100)

    // Calculate carbon credits (simplified: 1 credit per 1000 kWh of solar generation)
    const carbonCreditEarned = Math.floor(totalSolarGeneration / 1000)

    // Calculate energy efficiency score (0-100) as a simple blend of solar share and battery health
    const energyEfficiencyScore = Math.min(
      100,
      Math.round(
        (solarPercentage * 0.5) + // Solar contribution (50% weight)
        (avgBatteryLevel * 0.5) // Battery health (50% weight)
      )
    )

    const metrics = {
      totalConsumption: Math.round(totalConsumption * 100) / 100,
      maxPower: Math.round(maxPower * 100) / 100,
      totalSolarGeneration: Math.round(totalSolarGeneration * 100) / 100,
      avgBatteryLevel: Math.round(avgBatteryLevel * 100) / 100,
      solarPercentage: Math.round(solarPercentage * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      costSavings: Math.round(costSavings * 100) / 100,
      carbonCreditEarned,
      energyEfficiencyScore,
      deviceCount: deviceRecords.length,
      dataPoints: energyRecords.length,
      period: `${days} days`
    }

    return NextResponse.json({
      success: true,
      data: metrics
    })

  } catch (error) {
    console.error('Error fetching facility metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
