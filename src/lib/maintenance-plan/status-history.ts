/**
 * Status History Management for Maintenance Plans
 * Provides utilities for logging and retrieving status change history
 */

import { db } from '@/lib/db'
import { maintenancePlanStatusHistory } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export type EntityType = 'request' | 'proposal' | 'payment'
export type UserRole = 'admin' | 'facility' | 'technician'

export interface StatusChangeLog {
  requestId?: string
  proposalId?: string
  paymentId?: string
  entityType: EntityType
  previousStatus?: string
  newStatus: string
  changedBy: string
  changedByRole: UserRole
  changedByName?: string
  reason?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a status change to the history table
 */
export async function logStatusChange(log: StatusChangeLog): Promise<void> {
  try {
    await db.insert(maintenancePlanStatusHistory).values({
      id: randomUUID(),
      requestId: log.requestId || null,
      proposalId: log.proposalId || null,
      paymentId: log.paymentId || null,
      entityType: log.entityType,
      previousStatus: log.previousStatus || null,
      newStatus: log.newStatus,
      changedBy: log.changedBy,
      changedByRole: log.changedByRole,
      changedByName: log.changedByName || null,
      reason: log.reason || null,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
    })
  } catch (error) {
    console.error('Error logging status change:', error)
    // Don't throw - logging failures shouldn't break the main operation
  }
}

/**
 * Get status history for a request
 */
export async function getRequestHistory(requestId: string) {
  return await db
    .select()
    .from(maintenancePlanStatusHistory)
    .where(
      and(
        eq(maintenancePlanStatusHistory.requestId, requestId),
        eq(maintenancePlanStatusHistory.entityType, 'request')
      )
    )
    .orderBy(desc(maintenancePlanStatusHistory.createdAt))
}

/**
 * Get status history for a proposal
 */
export async function getProposalHistory(proposalId: string) {
  return await db
    .select()
    .from(maintenancePlanStatusHistory)
    .where(
      and(
        eq(maintenancePlanStatusHistory.proposalId, proposalId),
        eq(maintenancePlanStatusHistory.entityType, 'proposal')
      )
    )
    .orderBy(desc(maintenancePlanStatusHistory.createdAt))
}

/**
 * Get status history for a payment
 */
export async function getPaymentHistory(paymentId: string) {
  return await db
    .select()
    .from(maintenancePlanStatusHistory)
    .where(
      and(
        eq(maintenancePlanStatusHistory.paymentId, paymentId),
        eq(maintenancePlanStatusHistory.entityType, 'payment')
      )
    )
    .orderBy(desc(maintenancePlanStatusHistory.createdAt))
}

/**
 * Get combined history for a request (includes related proposals and payments)
 */
export async function getCombinedHistory(requestId: string) {
  return await db
    .select()
    .from(maintenancePlanStatusHistory)
    .where(eq(maintenancePlanStatusHistory.requestId, requestId))
    .orderBy(desc(maintenancePlanStatusHistory.createdAt))
}

/**
 * Helper to extract user info from session
 */
export function getUserInfo(session: any): {
  id: string
  role: UserRole
  name?: string
  email?: string
} {
  return {
    id: session.user.id || session.user.userId || '',
    role: session.user.role as UserRole,
    name: session.user.name || `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || undefined,
    email: session.user.email || undefined,
  }
}

/**
 * Helper to get request headers for IP and user agent
 */
export function getRequestMetadata(request: Request): {
  ipAddress?: string
  userAgent?: string
} {
  const headers = request.headers
  return {
    ipAddress: headers.get('x-forwarded-for') || headers.get('x-real-ip') || undefined,
    userAgent: headers.get('user-agent') || undefined,
  }
}
