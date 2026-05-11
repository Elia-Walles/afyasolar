import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments } from '@/lib/db/schema'
import { eq, desc, and, type SQL } from 'drizzle-orm'

/**
 * GET /api/service-access-payments
 * Get service access payments for a facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedFacilityId = searchParams.get('facilityId')
    const facilityId = requestedFacilityId || session.user.facilityId
    const serviceName = searchParams.get('serviceName')

    if (!facilityId && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Check access
    if (facilityId && session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build query conditions
    const conditions: SQL[] = []
    if (facilityId) {
      conditions.push(eq(serviceAccessPayments.facilityId, facilityId))
    }
    
    if (serviceName) {
      conditions.push(eq(serviceAccessPayments.serviceName, serviceName))
    }

    const payments = await db
      .select()
      .from(serviceAccessPayments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(serviceAccessPayments.createdAt))

    return NextResponse.json({
      success: true,
      data: payments
    })

  } catch (error) {
    console.error('Error fetching service access payments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
