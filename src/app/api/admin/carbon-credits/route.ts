import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { carbonCredits, devices, facilities } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

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

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/admin/carbon-credits
 * DB-backed carbon credits list with filters/pagination.
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

    const conditions: any[] = []
    if (facilityId) conditions.push(eq(carbonCredits.facilityId, facilityId))
    if (deviceId) conditions.push(eq(carbonCredits.deviceId, deviceId))
    if (status) conditions.push(eq(carbonCredits.verificationStatus, status))
    if (period) conditions.push(eq(carbonCredits.period, period))
    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await db
      .select({
        credit: carbonCredits,
        facilityName: facilities.name,
        deviceSerial: devices.serialNumber,
      })
      .from(carbonCredits)
      .leftJoin(facilities, eq(carbonCredits.facilityId, facilities.id))
      .leftJoin(devices, eq(carbonCredits.deviceId, devices.id))
      .where(whereClause as any)
      .orderBy(desc(carbonCredits.createdAt))
      .limit(limit)
      .offset(offset)

    const out: CarbonCredit[] = rows.map((r: any) => ({
      id: r.credit.id,
      deviceId: r.credit.deviceId,
      facilityId: r.credit.facilityId,
      facilityName: r.facilityName || 'Unknown Facility',
      deviceSerial: r.deviceSerial || 'Unknown Device',
      period: r.credit.period,
      startDate: new Date(r.credit.startDate).toISOString(),
      endDate: new Date(r.credit.endDate).toISOString(),
      energyGenerated: Number(r.credit.energyGeneratedKwh ?? 0),
      co2Saved: Number(r.credit.co2SavedKg ?? 0),
      creditsEarned: Number(r.credit.creditsEarnedTons ?? 0),
      creditValue: Number(r.credit.creditValueUsd ?? 0),
      totalValue: Number(r.credit.totalValueUsd ?? 0),
      verificationStatus: r.credit.verificationStatus,
      certificateId: r.credit.certificateId ?? undefined,
      verifiedAt: r.credit.verifiedAt ? new Date(r.credit.verifiedAt).toISOString() : undefined,
      verifiedBy: r.credit.verifiedBy ?? undefined,
      notes: r.credit.notes ?? undefined,
      createdAt: new Date(r.credit.createdAt).toISOString(),
      updatedAt: new Date(r.credit.updatedAt).toISOString(),
      metadata: (r.credit.metadata ?? {}) as any,
    }))

    // Basic total count (keeps compatibility with existing UI pagination)
    const totalRows = await db.select().from(carbonCredits).where(whereClause as any)
    const total = Array.isArray(totalRows) ? totalRows.length : 0

    return NextResponse.json({
      success: true,
      data: out,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
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
 * Create a carbon credit record (manual entry).
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
      metadata,
    } = body

    if (!deviceId || !facilityId || !period || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const deviceInfo = await db
      .select({
        device: devices,
        facility: facilities,
      })
      .from(devices)
      .leftJoin(facilities, eq(devices.facilityId, facilities.id))
      .where(eq(devices.id, deviceId))
      .limit(1)

    if (deviceInfo.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    const { device, facility } = deviceInfo[0]

    const id = generateId()
    await db.insert(carbonCredits).values({
      id,
      deviceId,
      facilityId,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      energyGeneratedKwh: (Number(energyGenerated) || 0).toString(),
      co2SavedKg: (Number(co2Saved) || 0).toString(),
      creditsEarnedTons: (Number(creditsEarned) || 0).toString(),
      creditValueUsd: (Number(creditValue) || 0).toString(),
      totalValueUsd: (Number(totalValue) || 0).toString(),
      verificationStatus: 'pending',
      metadata: {
        efficiency: metadata?.efficiency || 0,
        operatingHours: metadata?.operatingHours || 0,
        baselineEmissions: metadata?.baselineEmissions || 0,
        gridEmissionFactor: metadata?.gridEmissionFactor || 0.5,
        calculationMethod: metadata?.calculationMethod || 'ACM0002',
        verificationDocuments: metadata?.verificationDocuments || [],
      } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const out: CarbonCredit = {
      id,
      deviceId,
      facilityId,
      facilityName: facility?.name || 'Unknown Facility',
      deviceSerial: device?.serialNumber || 'Unknown Device',
      period,
      startDate,
      endDate,
      energyGenerated: Number(energyGenerated) || 0,
      co2Saved: Number(co2Saved) || 0,
      creditsEarned: Number(creditsEarned) || 0,
      creditValue: Number(creditValue) || 0,
      totalValue: Number(totalValue) || 0,
      verificationStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        efficiency: metadata?.efficiency || 0,
        operatingHours: metadata?.operatingHours || 0,
        baselineEmissions: metadata?.baselineEmissions || 0,
        gridEmissionFactor: metadata?.gridEmissionFactor || 0.5,
        calculationMethod: metadata?.calculationMethod || 'ACM0002',
        verificationDocuments: metadata?.verificationDocuments || [],
      },
    }

    return NextResponse.json({ success: true, data: out, message: 'Carbon credit created successfully' })
  } catch (error) {
    console.error('Error creating carbon credit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create carbon credit' },
      { status: 500 }
    )
  }
}
