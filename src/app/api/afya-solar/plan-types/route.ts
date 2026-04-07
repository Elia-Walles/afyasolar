import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarPlanTypes } from '@/lib/db/afya-solar-schema'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/afya-solar/plan-types
 * Fetch all available plan types
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planTypes = await db
      .select()
      .from(afyaSolarPlanTypes)
      .orderBy(afyaSolarPlanTypes.code)

    return NextResponse.json({
      success: true,
      data: planTypes
    })

  } catch (error) {
    console.error('Error fetching Afya Solar plan types:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
