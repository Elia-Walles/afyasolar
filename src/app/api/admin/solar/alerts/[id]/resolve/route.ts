import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { deviceAlerts } from '@/lib/db/schema-telemetry'
import { eq } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/solar/alerts/[id]/resolve
 * Resolve a solar device alert
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
    const { resolvedBy, resolution } = await request.json()

    if (!resolvedBy) {
      return NextResponse.json({ error: 'Resolved by is required' }, { status: 400 })
    }

    // Update the alert status to resolved
    await db
      .update(deviceAlerts)
      .set({
        status: 'resolved',
        resolvedBy,
        resolvedAt: new Date(),
        resolution,
        updatedAt: new Date()
      })
      .where(eq(deviceAlerts.id, alertId))

    return NextResponse.json({
      success: true,
      message: 'Alert resolved successfully'
    })

  } catch (error) {
    console.error('Error resolving alert:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
