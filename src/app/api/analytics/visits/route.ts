import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { getVisitStats } from '@/lib/services/product-analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'facility' && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId') || session.user.facilityId
    const range = searchParams.get('range') || '30d'

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    let from: Date | undefined
    const to = new Date()

    if (range === '7d') {
      from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (range === '90d') {
      from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000)
    } else {
      from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    const stats = await getVisitStats({ facilityId, from, to })

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Error fetching visit stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

