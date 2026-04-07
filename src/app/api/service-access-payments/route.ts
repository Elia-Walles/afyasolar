import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'

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
    const facilityId = searchParams.get('facilityId') || session.user.facilityId
    const serviceName = searchParams.get('serviceName')

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Check access
    if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build query conditions
    const conditions = [eq(serviceAccessPayments.facilityId, facilityId)]
    
    if (serviceName) {
      conditions.push(eq(serviceAccessPayments.serviceName, serviceName))
    }

    const payments = await db
      .select()
      .from(serviceAccessPayments)
      .where(and(...conditions))
      .orderBy(desc(serviceAccessPayments.createdAt))

    console.log('[AfyaSolarPayment][LIST]', {
      facilityId,
      serviceName,
      count: payments.length,
      ids: payments.map((p) => p.id),
    })

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
