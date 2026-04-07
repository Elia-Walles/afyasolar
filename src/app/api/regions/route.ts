import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { regions } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/regions
 * Get all regions (public endpoint for registration forms)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Fetching regions from database...')
    
    // First try with status filter
    let allRegions = await db
      .select({
        id: regions.id,
        name: regions.name,
      })
      .from(regions)
      .where(eq(regions.status, true))
      .orderBy(asc(regions.name))

    console.log('[API] Found', allRegions.length, 'regions with status=true')
    
    // If no regions found with status=true, try without status filter
    if (allRegions.length === 0) {
      console.log('[API] No regions with status=true, trying without status filter...')
      allRegions = await db
        .select({
          id: regions.id,
          name: regions.name,
        })
        .from(regions)
        .orderBy(asc(regions.name))
      
      console.log('[API] Found', allRegions.length, 'regions total (without status filter)')
    }

    console.log('[API] Returning', allRegions.length, 'regions')
    return NextResponse.json({ success: true, data: allRegions })
  } catch (error) {
    console.error('[API] Error fetching regions:', error)
    // Return empty array instead of error to prevent form breaking
    return NextResponse.json({ success: true, data: [] })
  }
}

