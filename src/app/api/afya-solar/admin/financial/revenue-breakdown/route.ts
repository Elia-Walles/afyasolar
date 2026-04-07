import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments } from '@/lib/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30d'

    // Calculate time range
    const now = new Date()
    let startTime: Date
    let previousStartTime: Date
    
    switch (timeRange) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousStartTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousStartTime = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        previousStartTime = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
        break
      default: // 30d
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousStartTime = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    }

    // Get revenue breakdown by service type for current period
    const currentPeriodQuery = db
      .select({
        category: serviceAccessPayments.serviceName,
        amount: sql<number>`SUM(CAST(${serviceAccessPayments.amount} AS DECIMAL(15,2)))`.as('amount'),
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(serviceAccessPayments)
      .where(and(
        eq(serviceAccessPayments.status, 'completed'),
        gte(serviceAccessPayments.createdAt, startTime),
        lte(serviceAccessPayments.createdAt, now)
      ))
      .groupBy(serviceAccessPayments.serviceName)

    // Get revenue breakdown for previous period (for trend comparison)
    const previousPeriodQuery = db
      .select({
        category: serviceAccessPayments.serviceName,
        amount: sql<number>`SUM(CAST(${serviceAccessPayments.amount} AS DECIMAL(15,2)))`.as('amount')
      })
      .from(serviceAccessPayments)
      .where(and(
        eq(serviceAccessPayments.status, 'completed'),
        gte(serviceAccessPayments.createdAt, previousStartTime),
        lte(serviceAccessPayments.createdAt, startTime)
      ))
      .groupBy(serviceAccessPayments.serviceName)

    const [currentPeriod, previousPeriod] = await Promise.all([
      currentPeriodQuery,
      previousPeriodQuery
    ])

    // Calculate total revenue for percentage calculation
    const totalRevenue = currentPeriod.reduce((sum, item) => sum + Number(item.amount), 0)

    // Create previous period map for easy lookup
    const previousPeriodMap = new Map(
      previousPeriod.map(item => [item.category, Number(item.amount)])
    )

    // Process breakdown with trends
    const breakdown = currentPeriod.map(item => {
      const currentAmount = Number(item.amount)
      const previousAmount = previousPeriodMap.get(item.category) || 0
      
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (currentAmount > previousAmount * 1.05) trend = 'up'
      else if (currentAmount < previousAmount * 0.95) trend = 'down'
      
      const percentage = totalRevenue > 0 ? (currentAmount / totalRevenue) * 100 : 0

      return {
        category: item.category || 'Other',
        amount: currentAmount,
        percentage,
        count: Number(item.count),
        trend
      }
    })

    // Sort by amount descending
    breakdown.sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      success: true,
      data: breakdown,
      meta: {
        timeRange,
        totalRevenue,
        timeRangeStart: startTime.toISOString(),
        timeRangeEnd: now.toISOString(),
        previousTimeRangeStart: previousStartTime.toISOString(),
        previousTimeRangeEnd: startTime.toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching revenue breakdown:', error)
    return NextResponse.json(
      { error: 'Failed to fetch revenue breakdown' },
      { status: 500 }
    )
  }
}
