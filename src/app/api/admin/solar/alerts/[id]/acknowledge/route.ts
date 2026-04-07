import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceAlerts } from '@/lib/db/schema-telemetry'
import { eq } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/solar/alerts/[id]/acknowledge
 * Acknowledge a solar device alert
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const alertId = id
    const { acknowledgedBy } = await request.json()

    if (!acknowledgedBy) {
      return NextResponse.json({ error: 'Acknowledged by is required' }, { status: 400 })
    }

    // Update the alert status to acknowledged
    await db
      .update(deviceAlerts)
      .set({
        status: 'acknowledged',
        acknowledgedBy,
        acknowledgedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(deviceAlerts.id, alertId))

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged successfully'
    })

  } catch (error) {
    console.error('Error acknowledging alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
