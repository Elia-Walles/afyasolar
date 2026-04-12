import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { assessmentCycles, assessmentCycleEnergyState } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function requireCycleAccess(session: { user: { role?: string; facilityId?: string | null } }, cycleId: string) {
  const [cycle] = await db.select().from(assessmentCycles).where(eq(assessmentCycles.id, cycleId)).limit(1)
  if (!cycle) {
    return { error: NextResponse.json({ error: "Assessment cycle not found" }, { status: 404 }) as const }
  }
  if (session.user.role !== "admin" && session.user.facilityId !== cycle.facilityId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) as const }
  }
  return { cycle }
}

/**
 * GET /api/assessment-cycles/[cycleId]/energy
 * Returns persisted sizing + operational (BMI) JSON for the cycle.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { cycleId } = await params
    const gate = await requireCycleAccess(session.user as any, cycleId)
    if ("error" in gate) return gate.error

    const [row] = await db
      .select()
      .from(assessmentCycleEnergyState)
      .where(eq(assessmentCycleEnergyState.assessmentCycleId, cycleId))
      .limit(1)

    return NextResponse.json({
      success: true,
      facilityId: gate.cycle.facilityId,
      sizingData: row?.sizingData ?? null,
      operationsData: row?.operationsData ?? null,
      bmiTrendJson: row?.bmiTrendJson ?? null,
      updatedAt: row?.updatedAt ?? null,
    })
  } catch (error) {
    console.error("[assessment-cycle energy GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/assessment-cycles/[cycleId]/energy
 * Upserts energy state. Body fields are shallow-merged with existing JSON blobs when omitted.
 * { sizingData?, operationsData?, bmiTrendJson? }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { cycleId } = await params
    const gate = await requireCycleAccess(session.user as any, cycleId)
    if ("error" in gate) return gate.error

    const body = (await request.json().catch(() => ({}))) as {
      sizingData?: unknown
      operationsData?: unknown
      bmiTrendJson?: unknown
    }

    const [existing] = await db
      .select()
      .from(assessmentCycleEnergyState)
      .where(eq(assessmentCycleEnergyState.assessmentCycleId, cycleId))
      .limit(1)

    const nextSizing = body.sizingData !== undefined ? body.sizingData : existing?.sizingData ?? null
    const nextOps = body.operationsData !== undefined ? body.operationsData : existing?.operationsData ?? null
    const nextTrend = body.bmiTrendJson !== undefined ? body.bmiTrendJson : existing?.bmiTrendJson ?? null

    if (!existing) {
      const id = generateId()
      await db.insert(assessmentCycleEnergyState).values({
        id,
        assessmentCycleId: cycleId,
        facilityId: gate.cycle.facilityId,
        sizingData: nextSizing as any,
        operationsData: nextOps as any,
        bmiTrendJson: nextTrend as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } else {
      await db
        .update(assessmentCycleEnergyState)
        .set({
          sizingData: nextSizing as any,
          operationsData: nextOps as any,
          bmiTrendJson: nextTrend as any,
          updatedAt: new Date(),
        })
        .where(eq(assessmentCycleEnergyState.assessmentCycleId, cycleId))
    }

    await db.update(assessmentCycles).set({ updatedAt: new Date() }).where(eq(assessmentCycles.id, cycleId))

    const [row] = await db
      .select()
      .from(assessmentCycleEnergyState)
      .where(eq(assessmentCycleEnergyState.assessmentCycleId, cycleId))
      .limit(1)

    return NextResponse.json({ success: true, sizingData: row?.sizingData, operationsData: row?.operationsData, bmiTrendJson: row?.bmiTrendJson })
  } catch (error) {
    console.error("[assessment-cycle energy PUT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
