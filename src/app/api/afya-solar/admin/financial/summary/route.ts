import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { serviceAccessPayments, serviceSubscriptions, facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, sql, isNull } from 'drizzle-orm'

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

    // Calculate month start for monthly revenue
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get total revenue in time range
    const totalRevenueQuery = db
      .select({
        total: sql<number>`SUM(CAST(${serviceAccessPayments.amount} AS DECIMAL(15,2)))`.as('total')
      })
      .from(serviceAccessPayments)
      .where(and(
        eq(serviceAccessPayments.status, 'completed'),
        gte(serviceAccessPayments.createdAt, startTime),
        lte(serviceAccessPayments.createdAt, now)
      ))

    // Get monthly revenue
    const monthlyRevenueQuery = db
      .select({
        total: sql<number>`SUM(CAST(${serviceAccessPayments.amount} AS DECIMAL(15,2)))`.as('total')
      })
      .from(serviceAccessPayments)
      .where(and(
        eq(serviceAccessPayments.status, 'completed'),
        gte(serviceAccessPayments.createdAt, monthStart),
        lte(serviceAccessPayments.createdAt, now)
      ))

    // Get pending payments
    const pendingPaymentsQuery = db
      .select({
        total: sql<number>`SUM(CAST(${serviceAccessPayments.amount} AS DECIMAL(15,2)))`.as('total')
      })
      .from(serviceAccessPayments)
      .where(eq(serviceAccessPayments.status, 'pending'))

    // Get overdue payments (assuming dueDate exists or using createdAt + 30 days)
    const overdueDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const overduePaymentsQuery = db
      .select({
        total: sql<number>`SUM(CAST(${serviceAccessPayments.amount} AS DECIMAL(15,2)))`.as('total')
      })
      .from(serviceAccessPayments)
      .where(and(
        eq(serviceAccessPayments.status, 'pending'),
        lte(serviceAccessPayments.createdAt, overdueDate)
      ))

    // Get total customers (facilities with active services)
    const totalCustomersQuery = db
      .select({
        count: sql<number>`COUNT(DISTINCT ${serviceSubscriptions.facilityId})`.as('count')
      })
      .from(serviceSubscriptions)
      .where(eq(serviceSubscriptions.status, 'active'))

    // Get active subscriptions
    const activeSubscriptionsQuery = db
      .select({
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(serviceSubscriptions)
      .where(eq(serviceSubscriptions.status, 'active'))

    // Get payment success rate
    const totalTransactionsQuery = db
      .select({
        total: sql<number>`COUNT(*)`.as('total'),
        completed: sql<number>`SUM(CASE WHEN ${serviceAccessPayments.status} = 'completed' THEN 1 ELSE 0 END)`.as('completed')
      })
      .from(serviceAccessPayments)
      .where(and(
        gte(serviceAccessPayments.createdAt, startTime),
        lte(serviceAccessPayments.createdAt, now)
      ))

    // Execute all queries
    const [
      totalRevenueResult,
      monthlyRevenueResult,
      pendingPaymentsResult,
      overduePaymentsResult,
      totalCustomersResult,
      activeSubscriptionsResult,
      totalTransactionsResult
    ] = await Promise.all([
      totalRevenueQuery,
      monthlyRevenueQuery,
      pendingPaymentsQuery,
      overduePaymentsQuery,
      totalCustomersQuery,
      activeSubscriptionsQuery,
      totalTransactionsQuery
    ])

    const totalRevenue = Number(totalRevenueResult[0]?.total || 0)
    const monthlyRevenue = Number(monthlyRevenueResult[0]?.total || 0)
    const pendingPayments = Number(pendingPaymentsResult[0]?.total || 0)
    const overduePayments = Number(overduePaymentsResult[0]?.total || 0)
    const totalCustomers = Number(totalCustomersResult[0]?.count || 0)
    const activeSubscriptions = Number(activeSubscriptionsResult[0]?.count || 0)
    const totalTransactions = Number(totalTransactionsResult[0]?.total || 0)
    const completedTransactions = Number(totalTransactionsResult[0]?.completed || 0)

    const avgRevenuePerCustomer = activeSubscriptions > 0 ? monthlyRevenue / activeSubscriptions : 0
    const paymentSuccessRate = totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0

    const summary = {
      totalRevenue,
      monthlyRevenue,
      pendingPayments,
      overduePayments,
      totalCustomers,
      activeSubscriptions,
      avgRevenuePerCustomer,
      paymentSuccessRate
    }

    return NextResponse.json({
      success: true,
      data: summary,
      meta: {
        timeRange,
        timeRangeStart: startTime.toISOString(),
        timeRangeEnd: now.toISOString(),
        monthStart: monthStart.toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching financial summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial summary' },
      { status: 500 }
    )
  }
}
