import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { visits } from '@/lib/db/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'
import type { VisitRecord, VisitStats } from '@/types/product-analytics'

export async function logVisit({
  facilityId,
  visitType,
  referrer,
  userAgent,
  ipAddress,
  sessionId,
}: {
  facilityId: string
  visitType: 'standalone' | 'widget'
  referrer?: string | null
  userAgent?: string | null
  ipAddress?: string | null
  sessionId?: string | null
}) {
  try {
    await db.insert(visits).values({
      id: randomUUID(),
      facilityId,
      visitType,
      referrer: referrer || null,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      sessionId: sessionId || null,
      selectedDepartment: false,
      selectedDoctor: false,
      selectedTimeSlot: false,
      confirmedBooking: false,
    } as any)
  } catch (error) {
    console.error('Failed to log visit', error)
  }
}

export async function updateVisitProgress({
  sessionId,
  facilityId,
  updates,
}: {
  sessionId: string
  facilityId: string
  updates: Partial<Pick<VisitRecord, 'selectedDepartment' | 'selectedDoctor' | 'selectedTimeSlot' | 'confirmedBooking'>>
}) {
  try {
    await db
      .update(visits)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(visits.sessionId, sessionId), eq(visits.facilityId, facilityId)))
  } catch (error) {
    console.error('Failed to update visit', error)
  }
}

export async function getVisitStats({
  facilityId,
  from,
  to,
}: {
  facilityId: string
  from?: Date
  to?: Date
}): Promise<VisitStats> {
  const filters = [eq(visits.facilityId, facilityId)]
  if (from) filters.push(gte(visits.createdAt, from))
  if (to) filters.push(lte(visits.createdAt, to))

  const rows = await db.select().from(visits).where(and(...filters)).orderBy(desc(visits.createdAt))

  const total = rows.length
  const standalone = rows.filter((r) => r.visitType === 'standalone').length
  const widget = total - standalone
  const departmentSelections = rows.filter((r) => r.selectedDepartment).length
  const doctorSelections = rows.filter((r) => r.selectedDoctor).length
  const slotSelections = rows.filter((r) => r.selectedTimeSlot).length
  const confirmed = rows.filter((r) => r.confirmedBooking).length

  return {
    totalVisits: total,
    widgetVisits: widget,
    standaloneVisits: standalone,
    conversionRate: total ? confirmed / total : 0,
    selectionRate: total ? departmentSelections / total : 0,
    doctorSelectionRate: total ? doctorSelections / total : 0,
    slotSelectionRate: total ? slotSelections / total : 0,
    bookingRate: total ? confirmed / total : 0,
  }
}

