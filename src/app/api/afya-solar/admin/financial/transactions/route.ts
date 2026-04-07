import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments, facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30d'
    const status = searchParams.get('status') || 'all'
    const type = searchParams.get('type') || 'all'

    // Calculate time range
    const now = new Date()
    let startTime: Date
    
    switch (timeRange) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default: // 30d
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Build query conditions
    const conditions = [
      gte(serviceAccessPayments.createdAt, startTime),
      lte(serviceAccessPayments.createdAt, now)
    ]

    if (status !== 'all') {
      conditions.push(eq(serviceAccessPayments.status, status))
    }

    // Fetch transactions with facility information
    const transactions = await db
      .select({
        id: serviceAccessPayments.id,
        facilityId: serviceAccessPayments.facilityId,
        facilityName: facilities.name,
        amount: serviceAccessPayments.amount,
        currency: serviceAccessPayments.currency,
        status: serviceAccessPayments.status,
        paymentMethod: serviceAccessPayments.paymentMethod,
        type: serviceAccessPayments.serviceName,
        description: serviceAccessPayments.description,
        createdAt: serviceAccessPayments.createdAt,
        processedAt: serviceAccessPayments.processedAt,
        // Add a dummy dueDate for demonstration (would come from actual schema)
        dueDate: sql<string>`DATE_ADD(${serviceAccessPayments.createdAt}, INTERVAL 30 DAY)`.as('dueDate')
      })
      .from(serviceAccessPayments)
      .leftJoin(facilities, eq(serviceAccessPayments.facilityId, facilities.id))
      .where(and(...conditions))
      .orderBy(desc(serviceAccessPayments.createdAt))
      .limit(100)

    // Filter by type if specified
    const filteredTransactions = type === 'all' 
      ? transactions 
      : transactions.filter(t => t.type === type)

    return NextResponse.json({
      success: true,
      data: filteredTransactions,
      meta: {
        timeRange,
        status,
        type,
        count: filteredTransactions.length,
        timeRangeStart: startTime.toISOString(),
        timeRangeEnd: now.toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
