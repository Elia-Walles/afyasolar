import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarClientServices, afyaSolarMeterCommands, afyaSolarSmartmeters } from '@/lib/db/afya-solar-schema'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const bodySchema = z.object({
  action: z.enum(['on', 'off']),
})

/**
 * POST /api/meters/[deviceId]/control
 * Design-compat endpoint that maps to AfyaSolar meter command queue.
 *
 * - `deviceId` may be a meter serial (preferred) or numeric smartmeter id.
 * - We queue ENABLE/DISABLE commands against the linked client service.
 */
export async function POST(request: NextRequest, { params }: { params: { deviceId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = bodySchema.parse(await request.json())

    const deviceIdRaw = params.deviceId
    const deviceIdNum = Number.parseInt(deviceIdRaw, 10)

    // Resolve smartmeter by serial first, then by numeric id.
    const [smartmeter] = await db
      .select({ id: afyaSolarSmartmeters.id, meterSerial: afyaSolarSmartmeters.meterSerial })
      .from(afyaSolarSmartmeters)
      .where(
        Number.isFinite(deviceIdNum)
          ? and(eq(afyaSolarSmartmeters.id, deviceIdNum), eq(afyaSolarSmartmeters.deletedAt, null))
          : and(eq(afyaSolarSmartmeters.meterSerial, deviceIdRaw), eq(afyaSolarSmartmeters.deletedAt, null)),
      )
      .limit(1)

    if (!smartmeter) {
      return NextResponse.json({ error: 'Smart meter not found' }, { status: 404 })
    }

    // Find an active service linked to this smartmeter.
    const [service] = await db
      .select({ id: afyaSolarClientServices.id })
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.smartmeterId, smartmeter.id))
      .limit(1)

    if (!service) {
      return NextResponse.json(
        { error: 'No client service linked to this smart meter' },
        { status: 409 },
      )
    }

    const commandType = action === 'on' ? 'ENABLE' : 'DISABLE'

    const [commandResult] = await db.insert(afyaSolarMeterCommands).values({
      smartmeterId: smartmeter.id,
      clientServiceId: service.id,
      commandType,
      requestedByUserId: session.user.id,
      requestedReasonCode: 'ADMIN_OVERRIDE',
      requestedReasonText: `API /api/meters/${deviceIdRaw}/control action=${action}`,
      status: 'QUEUED',
    })

    return NextResponse.json({
      success: true,
      data: {
        commandId: commandResult.insertId,
        smartmeterId: smartmeter.id,
        meterSerial: smartmeter.meterSerial,
        commandType,
        status: 'QUEUED',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error controlling meter:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

