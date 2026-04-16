import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { assessmentCycles } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

function isMissingAssessmentNumberColumn(error: unknown): boolean {
  const e = error as { code?: string; sqlMessage?: string; message?: string }
  if (e?.code === "ER_BAD_FIELD_ERROR") return true
  const msg = `${e?.sqlMessage || ""} ${e?.message || ""}`.toLowerCase()
  return msg.includes("assessment_number")
}

/**
 * GET /api/facility/[facilityId]/assessment-cycles
 * Lists assessment cycles for a facility.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId } = await params
    if (!facilityId) return NextResponse.json({ error: "Facility ID required" }, { status: 400 })

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let cycles: any[] = []
    try {
      cycles = await db
        .select()
        .from(assessmentCycles)
        .where(eq(assessmentCycles.facilityId, facilityId))
        .orderBy(desc(assessmentCycles.startedAt))
        .limit(50)
    } catch (error) {
      if (!isMissingAssessmentNumberColumn(error)) throw error
      // Backward-compatible fallback when migration for `assessment_number` has not been applied yet.
      const fallbackCycles = await db
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
        .where(eq(assessmentCycles.facilityId, facilityId))
        .orderBy(desc(assessmentCycles.startedAt))
        .limit(50)
      cycles = fallbackCycles.map((c) => ({ ...c, assessmentNumber: null }))
    }

    // #region agent log
    fetch('http://127.0.0.1:7272/ingest/c99fbffc-2c05-4b71-ad32-c7c14a4d90a6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'af648d'},body:JSON.stringify({sessionId:'af648d',runId:'pre-fix',hypothesisId:'H2',location:'assessment-cycles/route.ts:GET',message:'API cycles payload returned',data:{facilityId,cyclesCount:cycles.length,top:cycles.slice(0,5).map((c:any)=>({id:c.id,status:c.status,assessmentNumber:c.assessmentNumber ?? null,startedAt:c.startedAt ?? null}))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ success: true, cycles })
  } catch (error) {
    console.error("[assessment-cycles GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/facility/[facilityId]/assessment-cycles
 * Creates a new assessment cycle (draft).
 * Body: { version?: "2.0", createdBy?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId } = await params
    if (!facilityId) return NextResponse.json({ error: "Facility ID required" }, { status: 400 })

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({} as any))
    const version = typeof body.version === "string" ? body.version : "2.0"
    const createdBy =
      typeof body.createdBy === "string" && body.createdBy.trim()
        ? body.createdBy.trim()
        : session.user.id || session.user.email

    // Generate unique assessment number for the facility (if column exists).
    let assessmentNumberSupported = true
    let nextAssessmentNumber = 1
    try {
      const existingCycles = await db
        .select({ assessmentNumber: assessmentCycles.assessmentNumber })
        .from(assessmentCycles)
        .where(eq(assessmentCycles.facilityId, facilityId))
        .orderBy(desc(assessmentCycles.assessmentNumber))
        .limit(1)
      nextAssessmentNumber = existingCycles.length > 0 ? (existingCycles[0].assessmentNumber ?? 0) + 1 : 1
    } catch (error) {
      if (!isMissingAssessmentNumberColumn(error)) throw error
      assessmentNumberSupported = false
      nextAssessmentNumber = 1
    }

    const id = generateId()
    if (assessmentNumberSupported) {
      await db.insert(assessmentCycles).values({
        id,
        assessmentNumber: nextAssessmentNumber,
        facilityId,
        status: "draft",
        version,
        createdBy,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } else {
      await db.insert(assessmentCycles).values({
        id,
        facilityId,
        status: "draft",
        version,
        createdBy,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    const [cycle] = await db
      .select()
      .from(assessmentCycles)
      .where(and(eq(assessmentCycles.id, id), eq(assessmentCycles.facilityId, facilityId)))
      .limit(1)

    return NextResponse.json({ success: true, cycle })
  } catch (error) {
    console.error("[assessment-cycles POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

