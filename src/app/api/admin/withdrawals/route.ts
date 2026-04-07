import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { technicianWithdrawals, technicians } from '@/lib/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/withdrawals
 * Get all withdrawal requests (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending', 'processing', 'completed', 'rejected', 'cancelled', or null for all

    // Build query
    let query = db
      .select({
        withdrawal: technicianWithdrawals,
        technician: {
          id: technicians.id,
          firstName: technicians.firstName,
          lastName: technicians.lastName,
          email: technicians.email,
          phone: technicians.phone,
        },
      })
      .from(technicianWithdrawals)
      .leftJoin(technicians, eq(technicianWithdrawals.technicianId, technicians.id))
      .orderBy(desc(technicianWithdrawals.createdAt))

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.where(eq(technicianWithdrawals.status, status as any)) as any
    }

    const results = await query

    // Format the response
    const withdrawals = results.map((row) => ({
      ...row.withdrawal,
      technician: row.technician ? {
        id: row.technician.id,
        name: `${row.technician.firstName} ${row.technician.lastName}`,
        email: row.technician.email,
        phone: row.technician.phone,
      } : null,
      accountDetails: row.withdrawal.accountDetails
        ? JSON.parse(row.withdrawal.accountDetails)
        : null,
    }))

    // Get counts for notifications
    const [pendingCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(technicianWithdrawals)
      .where(eq(technicianWithdrawals.status, 'pending'))

    return NextResponse.json({
      success: true,
      data: withdrawals,
      counts: {
        pending: Number(pendingCount?.count || 0),
      },
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
