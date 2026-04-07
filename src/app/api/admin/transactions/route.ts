import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { paymentTransactions, transactionStatusHistory, facilities, serviceSubscriptions } from '@/lib/db/schema'
import { eq, desc, asc, sql, and, like, or, gte, lte } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  serviceName: z.string().optional(),
  facilityId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

/**
 * GET /api/admin/transactions
 * Get all transactions with filtering and pagination (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    // Parse query parameters with safe defaults
    const rawQuery = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status') || undefined,
      serviceName: searchParams.get('serviceName') || undefined,
      facilityId: searchParams.get('facilityId') || undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }
    
    // Validate with zod schema
    let query
    try {
      query = querySchema.parse(rawQuery)
    } catch (validationError) {
      console.error('[Admin Transactions] Validation error:', validationError)
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Validation error', 
            details: validationError.errors,
            received: rawQuery
          },
          { status: 400 }
        )
      }
      throw validationError
    }

    console.log('[Admin Transactions] Query params:', query)

    const offset = (query.page - 1) * query.limit

    // Build where conditions
    const conditions = []
    
    if (query.status) {
      conditions.push(eq(paymentTransactions.status, query.status))
    }
    if (query.serviceName) {
      conditions.push(eq(paymentTransactions.serviceName, query.serviceName))
    }
    if (query.facilityId) {
      conditions.push(eq(paymentTransactions.facilityId, query.facilityId))
    }
    if (query.search) {
      conditions.push(
        or(
          like(paymentTransactions.externalId, `%${query.search}%`),
          like(paymentTransactions.azamTransactionId, `%${query.search}%`),
          like(paymentTransactions.mobileNumber, `%${query.search}%`)
        )
      )
    }
    if (query.dateFrom) {
      try {
        const dateFrom = new Date(query.dateFrom)
        if (!isNaN(dateFrom.getTime())) {
          conditions.push(gte(paymentTransactions.createdAt, dateFrom))
        }
      } catch (e) {
        console.warn('[Admin Transactions] Invalid dateFrom:', query.dateFrom)
      }
    }
    if (query.dateTo) {
      try {
        const dateTo = new Date(query.dateTo)
        // Add one day to include the entire end date
        dateTo.setHours(23, 59, 59, 999)
        if (!isNaN(dateTo.getTime())) {
          conditions.push(lte(paymentTransactions.createdAt, dateTo))
        }
      } catch (e) {
        console.warn('[Admin Transactions] Invalid dateTo:', query.dateTo)
      }
    }

    // Get transactions with facility info and subscription info
    let transactionsQuery = db
      .select({
        transaction: paymentTransactions,
        facilityName: facilities.name,
        subscriptionExpiryDate: serviceSubscriptions.expiryDate,
        subscriptionStatus: serviceSubscriptions.status,
      })
      .from(paymentTransactions)
      .leftJoin(facilities, eq(paymentTransactions.facilityId, facilities.id))
      .leftJoin(
        serviceSubscriptions,
        and(
          eq(serviceSubscriptions.facilityId, paymentTransactions.facilityId),
          eq(serviceSubscriptions.serviceName, paymentTransactions.serviceName)
        )
      )

    // Apply where conditions if any
    if (conditions.length > 0) {
      transactionsQuery = transactionsQuery.where(and(...conditions)) as typeof transactionsQuery
    }

    // Apply ordering based on sortBy parameter
    let orderByClause
    if (query.sortBy === 'amount') {
      orderByClause = query.sortOrder === 'desc' 
        ? desc(paymentTransactions.amount)
        : asc(paymentTransactions.amount)
    } else if (query.sortBy === 'status') {
      orderByClause = query.sortOrder === 'desc' 
        ? desc(paymentTransactions.status)
        : asc(paymentTransactions.status)
    } else {
      // Default: sort by createdAt
      orderByClause = query.sortOrder === 'desc' 
        ? desc(paymentTransactions.createdAt)
        : asc(paymentTransactions.createdAt)
    }
    
    console.log('[Admin Transactions] Executing query with conditions:', conditions.length)
    
    const transactions = await transactionsQuery
      .orderBy(orderByClause)
      .limit(query.limit)
      .offset(offset)
    
    console.log('[Admin Transactions] Fetched', transactions.length, 'transactions')

    // Get total count
    let countQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentTransactions)
    
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery
    }
    
    const [countResult] = await countQuery

    const totalCount = Number(countResult?.count || 0)
    const totalPages = Math.ceil(totalCount / query.limit)

    // Get summary statistics
    let statsQuery = db
      .select({
        totalTransactions: sql<number>`COUNT(*)`,
        completedCount: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        failedCount: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
        pendingCount: sql<number>`SUM(CASE WHEN status IN ('pending', 'initiated', 'awaiting_confirmation', 'processing') THEN 1 ELSE 0 END)`,
        totalAmount: sql<number>`SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END)`,
      })
      .from(paymentTransactions)
    
    if (conditions.length > 0) {
      statsQuery = statsQuery.where(and(...conditions)) as typeof statsQuery
    }
    
    const [stats] = await statsQuery

    // Map transactions to expected format - include all database fields
    const mappedTransactions = transactions.map(t => {
      const tx = t.transaction
      
      // Convert amount to string (it's a decimal in DB)
      const amount = typeof tx.amount === 'string' 
        ? tx.amount 
        : String(tx.amount || '0')
      
      // Helper to convert date to ISO string
      const toISOString = (date: any): string | undefined => {
        if (!date) return undefined
        if (date instanceof Date) return date.toISOString()
        if (typeof date === 'string') return date
        return undefined
      }
      
      return {
        id: tx.id,
        facilityId: tx.facilityId,
        serviceName: tx.serviceName,
        externalId: tx.externalId,
        azamTransactionId: tx.azamTransactionId || undefined,
        azamReference: tx.azamReference || undefined,
        mnoReference: tx.mnoReference || undefined,
        amount: amount,
        currency: tx.currency || 'TZS',
        paymentType: tx.paymentType || 'mobile',
        paymentMethod: tx.paymentMethod || undefined,
        mobileNumber: tx.mobileNumber || undefined,
        mobileProvider: tx.mobileProvider || undefined,
        bankName: tx.bankName || undefined,
        bankAccountNumber: tx.bankAccountNumber || undefined,
        bankMobileNumber: tx.bankMobileNumber || undefined,
        status: tx.status,
        statusMessage: tx.statusMessage || undefined,
        failureReason: tx.failureReason || undefined,
        billingCycle: tx.billingCycle || undefined,
        subscriptionId: tx.subscriptionId || undefined,
        // All timestamp fields
        initiatedAt: toISOString(tx.initiatedAt) || new Date().toISOString(),
        sentToProviderAt: toISOString(tx.sentToProviderAt),
        customerPromptedAt: toISOString(tx.customerPromptedAt),
        completedAt: toISOString(tx.completedAt),
        failedAt: toISOString(tx.failedAt),
        callbackReceivedAt: toISOString(tx.callbackReceivedAt),
        expiresAt: toISOString(tx.expiresAt),
        createdAt: toISOString(tx.createdAt) || new Date().toISOString(),
        updatedAt: toISOString(tx.updatedAt) || new Date().toISOString(),
        // Facility info from join
        facilityName: t.facilityName || undefined,
        // Subscription info
        subscriptionExpiryDate: t.subscriptionExpiryDate ? toISOString(t.subscriptionExpiryDate) : undefined,
        subscriptionStatus: t.subscriptionStatus || undefined,
      }
    })

    console.log(`[Admin Transactions] Returning ${mappedTransactions.length} transactions out of ${totalCount} total`)

    return NextResponse.json({
      transactions: mappedTransactions,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages,
        hasMore: query.page < totalPages,
      },
      stats: {
        total: Number(stats?.totalTransactions || 0),
        completed: Number(stats?.completedCount || 0),
        failed: Number(stats?.failedCount || 0),
        pending: Number(stats?.pendingCount || 0),
        totalAmount: Number(stats?.totalAmount || 0),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Admin Transactions] Validation error:', error.errors)
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[Admin Transactions] Error fetching transactions:', error)
    console.error('[Admin Transactions] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

