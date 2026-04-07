import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarInvoiceRequests } from '@/lib/db/schema'
import { desc, eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/solar/invoice-requests
 * Admin lists all Afya Solar invoice requests (Pay By Invoice)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

    const conditions = []
    if (status && ['pending', 'approved', 'rejected', 'paid'].includes(status)) {
      conditions.push(eq(afyaSolarInvoiceRequests.status, status))
    }

    const requests = await db
      .select()
      .from(afyaSolarInvoiceRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(afyaSolarInvoiceRequests.createdAt))
      .limit(limit)

    return NextResponse.json({
      success: true,
      data: requests,
    })
  } catch (error) {
    console.error('Error fetching Afya Solar invoice requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
