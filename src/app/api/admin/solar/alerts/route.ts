import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceAlerts } from '@/lib/db/schema-telemetry'
import { facilities } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/solar/alerts?status=all|active|acknowledged|resolved&severity=all|critical|high|medium|low
 * Fetch solar device alerts with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || 'all'
    const severityFilter = searchParams.get('severity') || 'all'

    // Build query conditions
    let whereConditions = []
    
    if (statusFilter !== 'all') {
      whereConditions.push(eq(deviceAlerts.status, statusFilter))
    }
    
    if (severityFilter !== 'all') {
      whereConditions.push(eq(deviceAlerts.severity, severityFilter))
    }

    // Fetch alerts with facility information
    const alertsData = await db
      .select({
        id: deviceAlerts.id,
        deviceId: deviceAlerts.deviceId,
        facilityId: deviceAlerts.facilityId,
        facilityName: facilities.name,
        alertType: deviceAlerts.alertType,
        severity: deviceAlerts.severity,
        code: deviceAlerts.code,
        title: deviceAlerts.title,
        message: deviceAlerts.message,
        alertData: deviceAlerts.alertData,
        threshold: deviceAlerts.threshold,
        actualValue: deviceAlerts.actualValue,
        status: deviceAlerts.status,
        acknowledgedBy: deviceAlerts.acknowledgedBy,
        acknowledgedAt: deviceAlerts.acknowledgedAt,
        resolvedBy: deviceAlerts.resolvedBy,
        resolvedAt: deviceAlerts.resolvedAt,
        triggeredAt: deviceAlerts.triggeredAt,
        createdAt: deviceAlerts.createdAt,
      })
      .from(deviceAlerts)
      .leftJoin(facilities, eq(deviceAlerts.facilityId, facilities.id))
      .where(
        whereConditions.length > 0 ? and(...whereConditions) : undefined
      )
      .orderBy(desc(deviceAlerts.triggeredAt))

    // Transform the data to match the expected interface
    const transformedAlerts = alertsData.map(alert => ({
      id: alert.id,
      deviceId: alert.deviceId,
      deviceSerial: `Device-${alert.deviceId}`, // Simplified - in production, join with devices table
      facilityName: alert.facilityName || 'Unknown Facility',
      type: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      timestamp: alert.triggeredAt?.toISOString() || alert.createdAt?.toISOString(),
      status: alert.status,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt?.toISOString(),
      resolvedBy: alert.resolvedBy,
      resolvedAt: alert.resolvedAt?.toISOString(),
      value: Number(alert.actualValue) || 0,
      threshold: Number(alert.threshold) || 0,
      metadata: alert.alertData ? JSON.parse(alert.alertData as string) : {}
    }))

    return NextResponse.json({
      success: true,
      data: transformedAlerts,
      count: transformedAlerts.length
    })

  } catch (error) {
    console.error('Error fetching solar alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
