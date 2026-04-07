import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceTelemetry, deviceHealth, devices, facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, avg, sum, inArray } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns'

interface EfficiencyScore {
  deviceId: string
  facilityId: string
  facilityName: string
  deviceSerial: string
  period: string
  startDate: string
  endDate: string
  overallScore: number // 0-100
  efficiencyScore: number // 0-100
  reliabilityScore: number // 0-100
  performanceScore: number // 0-100
  maintenanceScore: number // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  trend: 'improving' | 'stable' | 'declining'
  recommendations: string[]
  metadata: {
    avgEfficiency: number
    uptime: number
    energyGenerated: number
    alertsCount: number
    maintenanceEvents: number
    operatingHours: number
    benchmarkScore: number
  }
}

/**
 * POST /api/admin/analytics/efficiency/score
 * Calculate efficiency score for a device or facility
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
      includeRecommendations = true,
      benchmarkAgainst = 'industry' // 'industry', 'facility', 'regional'
    } = body

    // Validate input
    if (!deviceId && !facilityId) {
      return NextResponse.json({ 
        error: 'Either deviceId or facilityId is required' 
      }, { status: 400 })
    }

    if (!period || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Missing required fields: period, startDate, endDate' 
      }, { status: 400 })
    }

    // Calculate efficiency score
    const score = await calculateEfficiencyScore(
      deviceId, 
      facilityId, 
      period, 
      startDate, 
      endDate, 
      includeRecommendations,
      benchmarkAgainst
    )

    return NextResponse.json({
      success: true,
      data: score
    })

  } catch (error) {
    console.error('Error calculating efficiency score:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate efficiency score' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/analytics/efficiency/score
 * Get efficiency scores for devices or facilities
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

    // Get efficiency scores
    const scores = await getEfficiencyScores(deviceId, facilityId, period, limit)

    return NextResponse.json({
      success: true,
      data: scores
    })

  } catch (error) {
    console.error('Error fetching efficiency scores:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch efficiency scores' },
      { status: 500 }
    )
  }
}

/**
 * Calculate comprehensive efficiency score
 */
async function calculateEfficiencyScore(
  deviceId: string | null,
  facilityId: string | null,
  period: string,
  startDate: string,
  endDate: string,
  includeRecommendations: boolean = true,
  benchmarkAgainst: string = 'industry'
): Promise<EfficiencyScore> {
  // Resolve device IDs for the scope (single device or all devices in a facility)
  let scopedDeviceIds: string[] = []

  if (deviceId) {
    scopedDeviceIds = [deviceId]
  } else if (facilityId) {
    const facilityDevices = await db
      .select({ id: devices.id })
      .from(devices)
      .where(eq(devices.facilityId, facilityId))

    scopedDeviceIds = facilityDevices.map((d) => d.id)
  }

  if (!scopedDeviceIds.length) {
    throw new Error('No devices found for the specified scope')
  }

  // Get telemetry data for the period, scoped to the resolved device IDs
  const telemetryData = await db
    .select()
    .from(deviceTelemetry)
    .where(
      and(
        inArray(deviceTelemetry.deviceId, scopedDeviceIds),
        gte(deviceTelemetry.timestamp, new Date(startDate)),
        lte(deviceTelemetry.timestamp, new Date(endDate))
      )
    )
    .orderBy(desc(deviceTelemetry.timestamp))

  if (telemetryData.length === 0) {
    throw new Error('No telemetry data found for the specified period')
  }

  // Get device and facility information
  const deviceInfo = await db
    .select({
      device: devices,
      facility: facilities
    })
    .from(devices)
    .leftJoin(facilities, eq(devices.facilityId, facilities.id))
    .where(deviceId ? eq(devices.id, deviceId) : eq(devices.facilityId, facilityId!))
    .limit(1)

  if (deviceInfo.length === 0) {
    throw new Error('Device or facility not found')
  }

  const { device, facility } = deviceInfo[0]

  // Calculate individual scores
  const efficiencyScore = calculateEfficiencyComponent(telemetryData)
  const reliabilityScore = calculateReliabilityComponent(telemetryData)
  const performanceScore = calculatePerformanceComponent(telemetryData)
  const maintenanceScore = await calculateMaintenanceComponent(deviceId || device.id, startDate, endDate)

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    (efficiencyScore * 0.4) + 
    (reliabilityScore * 0.3) + 
    (performanceScore * 0.2) + 
    (maintenanceScore * 0.1)
  )

  // Get benchmark score
  const benchmarkScore = await getBenchmarkScore(overallScore, benchmarkAgainst)

  // Determine grade
  const grade = getGrade(overallScore)

  // Calculate trend (compare with previous period)
  const trend = await calculateTrend(deviceId || device.id, period, startDate)

  // Generate recommendations
  const recommendations = includeRecommendations 
    ? generateRecommendations(overallScore, efficiencyScore, reliabilityScore, performanceScore, maintenanceScore)
    : []

  // Calculate metadata
  const metadata = {
    avgEfficiency: telemetryData.reduce((sum, d) => sum + (Number(d.efficiency) || 0), 0) / telemetryData.length,
    uptime: calculateUptime(telemetryData),
    energyGenerated: telemetryData.reduce((sum, d) => sum + (Number(d.power || 0) * 5) / 1000, 0), // Assuming 5-minute intervals
    alertsCount: await getAlertsCount(deviceId || device.id, startDate, endDate),
    maintenanceEvents: await getMaintenanceEventsCount(deviceId || device.id, startDate, endDate),
    operatingHours: telemetryData.length * 5 / 60, // Assuming 5-minute intervals
    benchmarkScore
  }

  return {
    deviceId: deviceId || device.id,
    facilityId: facilityId || facility?.id || 'unknown',
    facilityName: facility?.name || 'Unknown Facility',
    deviceSerial: device?.serialNumber || 'Unknown Device',
    period,
    startDate,
    endDate,
    overallScore,
    efficiencyScore,
    reliabilityScore,
    performanceScore,
    maintenanceScore,
    grade,
    trend,
    recommendations,
    metadata
  }
}

/**
 * Calculate efficiency component score
 */
function calculateEfficiencyComponent(telemetryData: any[]): number {
  const efficiencyValues = telemetryData
    .map(d => Number(d.efficiency) || 0)
    .filter(e => e > 0)

  if (efficiencyValues.length === 0) return 0

  const avgEfficiency = efficiencyValues.reduce((sum, e) => sum + e, 0) / efficiencyValues.length
  
  // Score based on efficiency percentage
  if (avgEfficiency >= 95) return 100
  if (avgEfficiency >= 90) return 90
  if (avgEfficiency >= 85) return 80
  if (avgEfficiency >= 80) return 70
  if (avgEfficiency >= 75) return 60
  if (avgEfficiency >= 70) return 50
  if (avgEfficiency >= 60) return 40
  if (avgEfficiency >= 50) return 30
  return 20
}

/**
 * Calculate reliability component score
 */
function calculateReliabilityComponent(telemetryData: any[]): number {
  const uptime = calculateUptime(telemetryData)
  
  // Score based on uptime percentage
  if (uptime >= 99) return 100
  if (uptime >= 98) return 90
  if (uptime >= 95) return 80
  if (uptime >= 90) return 70
  if (uptime >= 85) return 60
  if (uptime >= 80) return 50
  if (uptime >= 70) return 40
  if (uptime >= 60) return 30
  return 20
}

/**
 * Calculate performance component score
 */
function calculatePerformanceComponent(telemetryData: any[]): number {
  const powerValues = telemetryData
    .map(d => Number(d.power || 0))
    .filter(p => p > 0)

  if (powerValues.length === 0) return 0

  const avgPower = powerValues.reduce((sum, p) => sum + p, 0) / powerValues.length
  const maxPower = Math.max(...powerValues)
  const consistency = 1 - (Math.max(...powerValues) - Math.min(...powerValues)) / maxPower

  // Score based on average power output and consistency
  const powerScore = Math.min((avgPower / 5000) * 100, 100) // Assuming 5kW as max
  const consistencyScore = consistency * 100

  return Math.round((powerScore * 0.7) + (consistencyScore * 0.3))
}

/**
 * Calculate maintenance component score
 */
async function calculateMaintenanceComponent(deviceId: string, startDate: string, endDate: string): Promise<number> {
  const alertsCount = await getAlertsCount(deviceId, startDate, endDate)
  const maintenanceEvents = await getMaintenanceEventsCount(deviceId, startDate, endDate)

  // Score based on low alerts and proper maintenance
  const alertScore = Math.max(100 - (alertsCount * 10), 0)
  const maintenanceScore = maintenanceEvents > 0 ? 80 : 100 // Some maintenance is good

  return Math.round((alertScore * 0.6) + (maintenanceScore * 0.4))
}

/**
 * Calculate uptime percentage
 */
function calculateUptime(telemetryData: any[]): number {
  if (telemetryData.length === 0) return 0

  const onlinePoints = telemetryData.filter(d => 
    d.deviceStatus !== 'offline' && d.deviceStatus !== 'error'
  ).length

  return (onlinePoints / telemetryData.length) * 100
}

/**
 * Get benchmark score
 */
async function getBenchmarkScore(score: number, benchmarkAgainst: string): Promise<number> {
  // Mock benchmark data - in real implementation, fetch from benchmarks table
  const industryAverages = {
    industry: 75,
    facility: 80,
    regional: 72
  }

  const benchmark = industryAverages[benchmarkAgainst as keyof typeof industryAverages] || 75
  return Math.round((score / benchmark) * 100)
}

/**
 * Get grade based on score
 */
function getGrade(score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
  if (score >= 97) return 'A+'
  if (score >= 93) return 'A'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 67) return 'D'
  return 'F'
}

/**
 * Calculate trend
 */
async function calculateTrend(deviceId: string, period: string, startDate: string): Promise<'improving' | 'stable' | 'declining'> {
  // Mock trend calculation - in real implementation, compare with previous period
  return 'stable'
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  overallScore: number,
  efficiencyScore: number,
  reliabilityScore: number,
  performanceScore: number,
  maintenanceScore: number
): string[] {
  const recommendations: string[] = []

  if (efficiencyScore < 70) {
    recommendations.push('Consider cleaning solar panels to improve efficiency')
    recommendations.push('Check for shading issues that may reduce performance')
  }

  if (reliabilityScore < 80) {
    recommendations.push('Schedule regular maintenance to improve uptime')
    recommendations.push('Monitor for potential hardware issues')
  }

  if (performanceScore < 70) {
    recommendations.push('Check inverter performance and settings')
    recommendations.push('Verify proper system configuration')
  }

  if (maintenanceScore < 70) {
    recommendations.push('Address active alerts to prevent downtime')
    recommendations.push('Implement preventive maintenance schedule')
  }

  if (overallScore < 60) {
    recommendations.push('Consider system upgrade or replacement')
    recommendations.push('Comprehensive performance audit recommended')
  }

  return recommendations
}

/**
 * Get alerts count for a device
 */
async function getAlertsCount(deviceId: string, startDate: string, endDate: string): Promise<number> {
  // Placeholder implementation - in real implementation, query alerts table
  return 0
}

/**
 * Get maintenance events count for a device
 */
async function getMaintenanceEventsCount(deviceId: string, startDate: string, endDate: string): Promise<number> {
  // Placeholder implementation - in real implementation, query maintenance table
  return 0
}

/**
 * Get efficiency scores
 */
async function getEfficiencyScores(
  deviceId?: string | null,
  facilityId?: string | null,
  period: string = 'monthly',
  limit: number = 12
): Promise<EfficiencyScore[]> {
  // Mock data - in real implementation, fetch from efficiency_scores table
  const mockScores: EfficiencyScore[] = [
    {
      deviceId: deviceId || 'device-1',
      facilityId: facilityId || 'fac-1',
      facilityName: 'Kigali Central Hospital',
      deviceSerial: 'SN-001-AFYA',
      period: '2024-01',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      overallScore: 92,
      efficiencyScore: 94,
      reliabilityScore: 98,
      performanceScore: 85,
      maintenanceScore: 88,
      grade: 'A',
      trend: 'stable',
      recommendations: ['Continue regular maintenance schedule'],
      metadata: {
        avgEfficiency: 94.5,
        uptime: 98.5,
        energyGenerated: 1240.5,
        alertsCount: 2,
        maintenanceEvents: 1,
        operatingHours: 720,
        benchmarkScore: 115
      }
    }
  ]

  return mockScores.slice(0, limit)
}
