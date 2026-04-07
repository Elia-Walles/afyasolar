import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { districts } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/districts
 * Get districts for a region (public endpoint for registration forms)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get('regionId')

    if (!regionId) {
      return NextResponse.json({ error: 'Region ID is required' }, { status: 400 })
    }

    const regionIdNum = parseInt(regionId, 10)
    if (isNaN(regionIdNum)) {
      return NextResponse.json({ error: 'Invalid region ID' }, { status: 400 })
    }

    const allDistricts = await db
      .select({
        id: districts.id,
        name: districts.name,
        regionId: districts.regionId,
      })
      .from(districts)
      .where(eq(districts.regionId, regionIdNum))
      .orderBy(asc(districts.name))

    return NextResponse.json({ success: true, data: allDistricts })
  } catch (error) {
    console.error('Error fetching districts:', error)
    // Return empty array instead of error to prevent form breaking
    return NextResponse.json({ success: true, data: [] })
  }
}

