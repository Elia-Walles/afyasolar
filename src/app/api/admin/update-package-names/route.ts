import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { getRawConnection } from '@/lib/db/index'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/admin/update-package-names
 * Update package names to new naming convention
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = getRawConnection()

    // Check current packages
    const [currentPackages] = await connection.execute(`
      SELECT id, code, name, ratedKw, suitableFor, isActive 
      FROM afya_solar_packages 
      WHERE ratedKw IN (10.00, 6.00, 4.20, 2.00)
      ORDER BY ratedKw
    `) as any[];

    // Update package names
    const [result] = await connection.execute(`
      UPDATE afya_solar_packages 
      SET name = CASE 
        WHEN ratedKw = 10.00 THEN 'Ultra'
        WHEN ratedKw = 6.00 THEN 'Pro' 
        WHEN ratedKw = 4.20 THEN 'Plus'
        WHEN ratedKw = 2.00 THEN 'Essential'
        ELSE name
      END
      WHERE ratedKw IN (10.00, 6.00, 4.20, 2.00)
    `) as any[];

    // Verify updates
    const [updatedPackages] = await connection.execute(`
      SELECT id, code, name, ratedKw, suitableFor, isActive 
      FROM afya_solar_packages 
      WHERE ratedKw IN (10.00, 6.00, 4.20, 2.00)
      ORDER BY ratedKw
    `) as any[];

    return NextResponse.json({
      success: true,
      message: `Updated ${result.affectedRows} packages`,
      before: currentPackages,
      after: updatedPackages
    })

  } catch (error) {
    console.error('Error updating package names:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
