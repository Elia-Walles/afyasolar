import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { getAdminPaygFinancingSummary } from '@/lib/payg-financing/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/admin/payg-financing/summary
 * Admin-wide PAYG & Financing summary, optionally filtered by facilityId.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId') || undefined
    const summary = await getAdminPaygFinancingSummary({ facilityId })

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Admin PAYG Summary] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
