import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { assessmentCycles, facilities } from "@/lib/db/schema"
import { desc, eq, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

function isMissingAssessmentNumberColumn(error: unknown): boolean {
  const e = error as { code?: string; sqlMessage?: string; message?: string }
  if (e?.code === "ER_BAD_FIELD_ERROR") return true
  const msg = `${e?.sqlMessage || ""} ${e?.message || ""}`.toLowerCase()
  return msg.includes("assessment_number")
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const isAdmin = session.user.role === "admin"
    const scopedFacilityId = session.user.facilityId ?? null
    if (!isAdmin && !scopedFacilityId) {
      return NextResponse.json({ success: true, cycles: [] })
    }

    let cycles: Array<{
      id: string
      facilityId: string
      startedAt: Date | null
      completedAt: Date | null
      status: string
      createdBy: string | null
      version: string | null
      createdAt: Date | null
      updatedAt: Date | null
      assessmentNumber?: number | null
    }> = []

    try {
      const query = db
        .select()
        .from(assessmentCycles)
        .orderBy(desc(assessmentCycles.startedAt))
        .limit(300)
      cycles = isAdmin ? await query : await query.where(eq(assessmentCycles.facilityId, scopedFacilityId!))
    } catch (error) {
      if (!isMissingAssessmentNumberColumn(error)) throw error
      const fallbackQuery = db
        .select({
          id: assessmentCycles.id,
          facilityId: assessmentCycles.facilityId,
          startedAt: assessmentCycles.startedAt,
          completedAt: assessmentCycles.completedAt,
          status: assessmentCycles.status,
          createdBy: assessmentCycles.createdBy,
          version: assessmentCycles.version,
          createdAt: assessmentCycles.createdAt,
          updatedAt: assessmentCycles.updatedAt,
        })
        .from(assessmentCycles)
        .orderBy(desc(assessmentCycles.startedAt))
        .limit(300)
      const fallbackCycles = isAdmin
        ? await fallbackQuery
        : await fallbackQuery.where(eq(assessmentCycles.facilityId, scopedFacilityId!))
      cycles = fallbackCycles.map((c) => ({ ...c, assessmentNumber: null }))
    }

    const facilityIds = Array.from(new Set(cycles.map((c) => c.facilityId).filter(Boolean)))
    const facilityRows =
      facilityIds.length === 0
        ? []
        : await db.select({ id: facilities.id, name: facilities.name }).from(facilities).where(inArray(facilities.id, facilityIds))
    const facilityNameById = new Map(facilityRows.map((f) => [f.id, f.name]))

    return NextResponse.json({
      success: true,
      cycles: cycles.map((c) => ({
        ...c,
        facilityName: facilityNameById.get(c.facilityId) ?? null,
      })),
    })
  } catch (error) {
    console.error("[assessment-cycles root GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
