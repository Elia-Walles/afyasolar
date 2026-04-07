import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/bills
 * Get bills for a facility
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

    const billList = await db
      .select()
      .from(bills)
      .where(eq(bills.facilityId, facilityId))
      .orderBy(desc(bills.createdAt))

    return NextResponse.json({ success: true, data: billList })
  } catch (error) {
    console.error('Error fetching bills:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/bills
 * Create a new bill (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { facilityId, periodStart, periodEnd, totalConsumption, totalCost, dueDate } = body

    if (!facilityId || !periodStart || !periodEnd || !totalConsumption || !totalCost || !dueDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate ID first (MySQL doesn't support RETURNING clause)
    const billId = crypto.randomUUID()
    
    await db
      .insert(bills)
      .values({
        id: billId,
        facilityId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalConsumption: totalConsumption.toString(),
        totalCost: totalCost.toString(),
        dueDate: new Date(dueDate),
        status: 'pending',
      })

    // Fetch the created bill (MySQL doesn't support RETURNING clause)
    const [newBill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1)

    if (!newBill) {
      throw new Error('Failed to retrieve created bill')
    }

    return NextResponse.json({ success: true, data: newBill }, { status: 201 })
  } catch (error) {
    console.error('Error creating bill:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

