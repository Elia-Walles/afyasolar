import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { devices, facilities } from '@/lib/db/schema'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

interface CarbonCredit {
  id: string
  deviceId: string
  facilityId: string
  facilityName: string
  deviceSerial: string
  period: string
  startDate: string
  endDate: string
  energyGenerated: number // kWh
  co2Saved: number // kg
  creditsEarned: number // tons
  creditValue: number // USD per ton
  totalValue: number // USD
  verificationStatus: 'pending' | 'verified' | 'certified' | 'rejected'
  certificateId?: string
  verifiedAt?: string
  verifiedBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
  metadata: {
    efficiency: number
    operatingHours: number
    baselineEmissions: number
    gridEmissionFactor: number
    calculationMethod: string
    verificationDocuments?: string[]
  }
}

/**
 * GET /api/admin/carbon-credits
 * Get all carbon credits with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId')
    const deviceId = searchParams.get('deviceId')
    const status = searchParams.get('status')
    const period = searchParams.get('period')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // In a real implementation, fetch from carbon_credits table
    const carbonCredits = await getCarbonCredits(facilityId, deviceId, status, period, limit, offset)
    const totalCount = await getCarbonCreditsCount(facilityId, deviceId, status, period)

    return NextResponse.json({
      success: true,
      data: carbonCredits,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching carbon credits:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch carbon credits' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/carbon-credits
 * Create a new carbon credit record
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
      energyGenerated,
      co2Saved,
      creditsEarned,
      creditValue,
      totalValue,
      metadata
    } = body

    // Validate required fields
    if (!deviceId || !facilityId || !period || !startDate || !endDate) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Get device and facility information
    const deviceInfo = await db
      .select({
        device: devices,
        facility: facilities
      })
      .from(devices)
      .leftJoin(facilities, eq(devices.facilityId, facilities.id))
      .where(eq(devices.id, deviceId))
      .limit(1)

    if (deviceInfo.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    const { device, facility } = deviceInfo[0]

    // Create carbon credit record
    const carbonCredit: CarbonCredit = {
      id: generateId(),
      deviceId,
      facilityId,
      facilityName: facility?.name || 'Unknown Facility',
      deviceSerial: device?.serialNumber || 'Unknown Device',
      period,
      startDate,
      endDate,
      energyGenerated,
      co2Saved,
      creditsEarned,
      creditValue,
      totalValue,
      verificationStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        efficiency: metadata?.efficiency || 0,
        operatingHours: metadata?.operatingHours || 0,
        baselineEmissions: metadata?.baselineEmissions || 0,
        gridEmissionFactor: metadata?.gridEmissionFactor || 0.5,
        calculationMethod: metadata?.calculationMethod || 'ACM0002',
        verificationDocuments: metadata?.verificationDocuments || []
      }
    }

    // In a real implementation, save to database
    console.log('Creating carbon credit:', carbonCredit)

    return NextResponse.json({
      success: true,
      data: carbonCredit,
      message: 'Carbon credit created successfully'
    })

  } catch (error) {
    console.error('Error creating carbon credit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create carbon credit' },
      { status: 500 }
    )
  }
}

/**
 * Mock function to get carbon credits
 */
async function getCarbonCredits(
  facilityId?: string | null,
  deviceId?: string | null,
  status?: string | null,
  period?: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<CarbonCredit[]> {
  // Mock data - in real implementation, fetch from database
  const mockCredits: CarbonCredit[] = [
    {
      id: 'credit-1',
      deviceId: 'device-1',
      facilityId: 'fac-1',
      facilityName: 'Kigali Central Hospital',
      deviceSerial: 'SN-001-AFYA',
      period: '2024-01',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      energyGenerated: 1240.5,
      co2Saved: 620.25,
      creditsEarned: 0.62,
      creditValue: 25,
      totalValue: 15.5,
      verificationStatus: 'certified',
      certificateId: 'CC-2024-001',
      verifiedAt: '2024-02-15T10:30:00Z',
      verifiedBy: 'admin@afyalink.com',
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-15T10:30:00Z',
      metadata: {
        efficiency: 94.5,
        operatingHours: 720,
        baselineEmissions: 620.25,
        gridEmissionFactor: 0.5,
        calculationMethod: 'ACM0002',
        verificationDocuments: ['doc1.pdf', 'doc2.pdf']
      }
    },
    {
      id: 'credit-2',
      deviceId: 'device-2',
      facilityId: 'fac-2',
      facilityName: 'Muhanga Health Center',
      deviceSerial: 'SN-002-AFYA',
      period: '2024-01',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      energyGenerated: 980.2,
      co2Saved: 490.1,
      creditsEarned: 0.49,
      creditValue: 25,
      totalValue: 12.25,
      verificationStatus: 'verified',
      verifiedAt: '2024-02-10T14:20:00Z',
      verifiedBy: 'admin@afyalink.com',
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-10T14:20:00Z',
      metadata: {
        efficiency: 91.2,
        operatingHours: 680,
        baselineEmissions: 490.1,
        gridEmissionFactor: 0.5,
        calculationMethod: 'ACM0002',
        verificationDocuments: ['doc3.pdf']
      }
    }
  ]

  // Apply filters
  let filteredCredits = mockCredits

  if (facilityId) {
    filteredCredits = filteredCredits.filter(credit => credit.facilityId === facilityId)
  }

  if (deviceId) {
    filteredCredits = filteredCredits.filter(credit => credit.deviceId === deviceId)
  }

  if (status) {
    filteredCredits = filteredCredits.filter(credit => credit.verificationStatus === status)
  }

  if (period) {
    filteredCredits = filteredCredits.filter(credit => credit.period === period)
  }

  return filteredCredits.slice(offset, offset + limit)
}

/**
 * Mock function to get carbon credits count
 */
async function getCarbonCreditsCount(
  facilityId?: string | null,
  deviceId?: string | null,
  status?: string | null,
  period?: string | null
): Promise<number> {
  // In real implementation, use COUNT query
  const credits = await getCarbonCredits(facilityId, deviceId, status, period, 1000, 0)
  return credits.length
}
