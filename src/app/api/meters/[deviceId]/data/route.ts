import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, desc, eq } from 'drizzle-orm'

import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarClientServices, afyaSolarMeterCommands, afyaSolarSmartmeters } from '@/lib/db/afya-solar-schema'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/meters/[deviceId]/data
 * Design-compat endpoint.
 *
 * For now this returns:
 * - smartmeter identity + lastSeenAt
 * - linked client service (if any)
 * - recent queued/sent commands
 *
 * (In the DB task we’ll add `afyasolar_meter_readings` to support historical readings.)
 */
export async function GET(_request: NextRequest, { params }: { params: { deviceId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deviceIdRaw = params.deviceId
    const deviceIdNum = Number.parseInt(deviceIdRaw, 10)

    const [smartmeter] = await db
      .select({
        id: afyaSolarSmartmeters.id,
        meterSerial: afyaSolarSmartmeters.meterSerial,
        vendor: afyaSolarSmartmeters.vendor,
        apiEndpoint: afyaSolarSmartmeters.apiEndpoint,
        siteAddress: afyaSolarSmartmeters.siteAddress,
        installedAt: afyaSolarSmartmeters.installedAt,
        lastSeenAt: afyaSolarSmartmeters.lastSeenAt,
        createdAt: afyaSolarSmartmeters.createdAt,
        updatedAt: afyaSolarSmartmeters.updatedAt,
      })
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

    const [service] = await db
      .select({
        id: afyaSolarClientServices.id,
        facilityId: afyaSolarClientServices.facilityId,
        status: afyaSolarClientServices.status,
        siteName: afyaSolarClientServices.siteName,
        serviceLocation: afyaSolarClientServices.serviceLocation,
      })
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.smartmeterId, smartmeter.id))
      .limit(1)

    // If the user is a facility user, only allow access to their facility’s meter/service.
    if (session.user.role === 'facility') {
      const facilityId = session.user.facilityId
      if (service?.facilityId && facilityId && service.facilityId !== facilityId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const commands = await db
      .select({
        id: afyaSolarMeterCommands.id,
        commandType: afyaSolarMeterCommands.commandType,
        status: afyaSolarMeterCommands.status,
        requestedReasonCode: afyaSolarMeterCommands.requestedReasonCode,
        requestedReasonText: afyaSolarMeterCommands.requestedReasonText,
        createdAt: afyaSolarMeterCommands.createdAt,
        sentAt: afyaSolarMeterCommands.sentAt,
        ackedAt: afyaSolarMeterCommands.ackedAt,
        errorMessage: afyaSolarMeterCommands.errorMessage,
      })
      .from(afyaSolarMeterCommands)
      .where(eq(afyaSolarMeterCommands.smartmeterId, smartmeter.id))
      .orderBy(desc(afyaSolarMeterCommands.createdAt))
      .limit(20)

    return NextResponse.json({
      success: true,
      data: {
        smartmeter,
        service: service || null,
        commands,
      },
    })
  } catch (error) {
    console.error('Error fetching meter data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

