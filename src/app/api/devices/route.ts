import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { devices } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { deviceClaimSchema } from '@/lib/validations'
import { formatSerialNumber, validateSerialNumber } from '@/lib/utils'

/**
 * GET /api/devices
 * Get devices for a facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId') || session.user.facilityId

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Check access
    if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deviceList = await db
      .select()
      .from(devices)
      .where(eq(devices.facilityId, facilityId))

    return NextResponse.json({ success: true, data: deviceList })
  } catch (error) {
    console.error('Error fetching devices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/devices
 * Claim a new device
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = deviceClaimSchema.parse(body)

    const serialNumber = formatSerialNumber(validatedData.serialPrefix, validatedData.serialSuffix)

    if (!validateSerialNumber(serialNumber)) {
      return NextResponse.json({ error: 'Invalid serial number format' }, { status: 400 })
    }

    // Check if device already exists
    const existing = await db
      .select()
      .from(devices)
      .where(eq(devices.serialNumber, serialNumber))
      .limit(1)

    if (existing[0]) {
      return NextResponse.json({ error: 'Device already claimed' }, { status: 409 })
    }

    const facilityId = session.user.facilityId || body.facilityId

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Generate ID first (MySQL doesn't support RETURNING clause)
    const deviceId = crypto.randomUUID()
    
    await db
      .insert(devices)
      .values({
        id: deviceId,
        serialNumber,
        type: validatedData.deviceType,
        facilityId,
        sensorSize: 200, // Default
        ports: 2, // Default
        mode: 'change_of_state', // Default
        status: 'active',
      })

    // Fetch the created device (MySQL doesn't support RETURNING clause)
    const [newDevice] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1)

    if (!newDevice) {
      throw new Error('Failed to retrieve created device')
    }

    return NextResponse.json({ success: true, data: newDevice }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error claiming device:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

