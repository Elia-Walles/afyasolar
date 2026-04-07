import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarInvoiceRequests } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'

/**
 * GET /api/afya-solar-invoice-requests
 * Get Afya Solar invoice requests for a facility
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

    const invoiceRequests = await db
      .select()
      .from(afyaSolarInvoiceRequests)
      .where(eq(afyaSolarInvoiceRequests.facilityId, facilityId))
      .orderBy(desc(afyaSolarInvoiceRequests.createdAt))

    return NextResponse.json({
      success: true,
      data: invoiceRequests
    })

  } catch (error) {
    console.error('Error fetching invoice requests:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
