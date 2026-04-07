/**
 * Audit logging system
 * Logs important actions for security and compliance
 */

import { db } from '@/lib/db'
import { maintenanceAuditLogs, users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { ensureMaintenanceTables } from './db/ensure-tables'

export interface AuditLogEntry {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  success: boolean
  error?: string
}

export async function logAudit(entry: AuditLogEntry) {
  const timestamp = new Date().toISOString()
  
  // Get user email if userId provided
  let userEmail: string | undefined
  if (entry.userId) {
    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, entry.userId))
        .limit(1)
      userEmail = user?.email
    } catch (error) {
      // Ignore errors in audit logging
    }
  }

  const logEntry = {
    ...entry,
    timestamp,
    userEmail,
  }

  try {
    await ensureMaintenanceTables()
    await db.insert(maintenanceAuditLogs).values({
      id: randomUUID(),
      userId: entry.userId || null,
      userEmail: userEmail || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      success: entry.success,
      error: entry.error || null,
      createdAt: new Date(timestamp),
    })
  } catch (error) {
    console.error('[AUDIT] Failed to persist audit log:', error)
  }

  // Log to console (in production, send to external service)
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUDIT]', JSON.stringify(logEntry, null, 2))
  } else {
    // In production, send to logging service (e.g., LogRocket, Sentry, etc.)
    console.log('[AUDIT]', JSON.stringify(logEntry))
  }
}

export async function getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  await ensureMaintenanceTables()
  const rows = await db
    .select()
    .from(maintenanceAuditLogs)
    .orderBy(desc(maintenanceAuditLogs.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    userId: row.userId || undefined,
    userEmail: row.userEmail || undefined,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId || undefined,
    details: row.details ? safeParse(row.details) : undefined,
    ipAddress: row.ipAddress || undefined,
    userAgent: row.userAgent || undefined,
    success: row.success,
    error: row.error || undefined,
    timestamp: row.createdAt?.toISOString() || new Date().toISOString(),
  }))
}

function safeParse(data: string) {
  try {
    return JSON.parse(data)
  } catch {
    return undefined
  }
}

