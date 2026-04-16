import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { assessmentCycles, followUpTasks, recommendationItems } from "@/lib/db/schema"
import { and, desc, eq, inArray } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  )
}

async function requireCycleAccess(session: any, cycleId: string) {
  const [cycle] = await db
    .select({
      id: assessmentCycles.id,
      facilityId: assessmentCycles.facilityId,
      status: assessmentCycles.status,
    })
    .from(assessmentCycles)
    .where(eq(assessmentCycles.id, cycleId))
    .limit(1)
  if (!cycle) return { error: NextResponse.json({ error: "Assessment cycle not found" }, { status: 404 }) as any }

  if (session.user.role !== "admin" && session.user.facilityId !== cycle.facilityId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) as any }
  }

  return { cycle }
}

/**
 * GET /api/assessment-cycles/[cycleId]/action-plan
 * Returns recommendations and follow-up tasks.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { cycleId } = await params
    if (!cycleId) return NextResponse.json({ error: "Missing cycleId" }, { status: 400 })

    const access = await requireCycleAccess(session, cycleId)
    if ("error" in access) return access.error

    const recommendations = await db
      .select()
      .from(recommendationItems)
      .where(eq(recommendationItems.assessmentCycleId, cycleId))
      .orderBy(desc(recommendationItems.updatedAt))

    const recIds = recommendations.map((r) => r.id)
    const tasks =
      recIds.length === 0
        ? []
        : await db
            .select()
            .from(followUpTasks)
            .where(and(eq(followUpTasks.facilityId, access.cycle.facilityId), inArray(followUpTasks.recommendationId, recIds)))
            .orderBy(desc(followUpTasks.updatedAt))

    return NextResponse.json({ success: true, recommendations, tasks })
  } catch (error) {
    console.error("[action-plan GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/assessment-cycles/[cycleId]/action-plan
 * Replaces recommendations for the cycle.
 * Body: { recommendations: [...] }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { cycleId } = await params
    if (!cycleId) return NextResponse.json({ error: "Missing cycleId" }, { status: 400 })

    const access = await requireCycleAccess(session, cycleId)
    if ("error" in access) return access.error

    const body = await request.json().catch(() => ({} as any))
    const recommendations = Array.isArray(body.recommendations) ? body.recommendations : []

    await db.transaction(async (tx) => {
      await tx.delete(recommendationItems).where(eq(recommendationItems.assessmentCycleId, cycleId))

      if (recommendations.length > 0) {
        await tx.insert(recommendationItems).values(
          recommendations.map((r: any) => ({
            id: isUuid(r?.id) ? r.id : generateId(),
            assessmentCycleId: cycleId,
            moduleSource: String(r.moduleSource ?? "integrated"),
            title: String(r.title ?? "Untitled recommendation"),
            description: typeof r.description === "string" ? r.description : null,
            priority: String(r.priority ?? "medium"),
            horizon: String(r.horizon ?? "medium"),
            ownerType: typeof r.ownerType === "string" ? r.ownerType : null,
            dueDays: typeof r.dueDays === "number" ? r.dueDays : null,
            costBand: typeof r.costBand === "string" ? r.costBand : null,
            expectedSavings: r.expectedSavings != null ? String(r.expectedSavings) : null,
            expectedResilienceGain: typeof r.expectedResilienceGain === "number" ? r.expectedResilienceGain : null,
            expectedEfficiencyGain: typeof r.expectedEfficiencyGain === "number" ? r.expectedEfficiencyGain : null,
            kpi: typeof r.kpi === "string" ? r.kpi : null,
            evidenceRequired: Boolean(r.evidenceRequired),
            explanation: typeof r.explanation === "string" ? r.explanation : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        )
      }

      await tx.update(assessmentCycles).set({ updatedAt: new Date() }).where(eq(assessmentCycles.id, cycleId))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[action-plan PUT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/assessment-cycles/[cycleId]/action-plan
 * Upserts follow-up tasks for recommendations.
 * Body: { tasks: [{ recommendationId, ownerName?, dueDate?, status? }] }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { cycleId } = await params
    if (!cycleId) return NextResponse.json({ error: "Missing cycleId" }, { status: 400 })

    const access = await requireCycleAccess(session, cycleId)
    if ("error" in access) return access.error

    const body = await request.json().catch(() => ({} as any))
    const tasks = Array.isArray(body.tasks) ? body.tasks : []
    if (tasks.length === 0) return NextResponse.json({ error: "tasks[] required" }, { status: 400 })

    const recIds = tasks
      .map((t: any) => (typeof t?.recommendationId === "string" ? t.recommendationId : ""))
      .filter(Boolean)
    if (recIds.length === 0) return NextResponse.json({ error: "No valid recommendationId found in tasks[]" }, { status: 400 })

    const created = await db.transaction(async (tx) => {
      // Keep one task per recommendation for now (simple, deterministic UI mapping).
      await tx
        .delete(followUpTasks)
        .where(and(eq(followUpTasks.facilityId, access.cycle.facilityId), inArray(followUpTasks.recommendationId, recIds)))

      const ids: string[] = []
      for (const t of tasks) {
        const recId = typeof t.recommendationId === "string" ? t.recommendationId : ""
        if (!recId) continue
        const id = generateId()
        ids.push(id)
        await tx.insert(followUpTasks).values({
          id,
          recommendationId: recId,
          facilityId: access.cycle.facilityId,
          ownerName: typeof t.ownerName === "string" ? t.ownerName : null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          status: typeof t.status === "string" ? t.status : "open",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      return ids
    })

    return NextResponse.json({ success: true, createdTaskIds: created })
  } catch (error) {
    console.error("[action-plan POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

