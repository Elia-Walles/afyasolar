import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import {
  assessmentCycles,
  climateAssessmentResponses,
  climateScoreSummaries,
  evidenceItems,
  riskDrivers,
} from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

type ModuleCode = "HES" | "CSF" | "ECPQ" | "EDC" | "RRC"

const MODULE_MAX: Record<ModuleCode, number> = {
  HES: 20,
  CSF: 30,
  ECPQ: 25,
  EDC: 15,
  RRC: 10,
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getTier(score: number, criticalAttention: boolean) {
  if (criticalAttention) return { tier: 0, label: "Critical attention" }
  if (score >= 80) return { tier: 3, label: "Tier 3 (strong)" }
  if (score >= 60) return { tier: 2, label: "Tier 2 (moderate)" }
  if (score >= 40) return { tier: 1, label: "Tier 1 (weak)" }
  return { tier: 0, label: "Tier 0 (fragile)" }
}

function computeScores(payload: {
  responses: Array<{
    moduleCode: ModuleCode
    questionCode: string
    score: number
    scoreMax: number
    isRedFlag?: boolean
  }>
}) {
  const sums: Record<ModuleCode, number> = { HES: 0, CSF: 0, ECPQ: 0, EDC: 0, RRC: 0 }
  const max: Record<ModuleCode, number> = { HES: 0, CSF: 0, ECPQ: 0, EDC: 0, RRC: 0 }
  let criticalAttention = false

  for (const r of payload.responses) {
    const module = r.moduleCode
    if (!MODULE_MAX[module]) continue
    const sMax = clamp(Number(r.scoreMax ?? 0), 0, 1000)
    const s = clamp(Number(r.score ?? 0), 0, sMax || 0)
    max[module] += sMax
    sums[module] += s
    if (r.isRedFlag) criticalAttention = true
  }

  const normalized: Record<ModuleCode, number> = { HES: 0, CSF: 0, ECPQ: 0, EDC: 0, RRC: 0 }
  ;(Object.keys(MODULE_MAX) as ModuleCode[]).forEach((m) => {
    const rawMax = Math.max(1, max[m])
    normalized[m] = Math.round((sums[m] / rawMax) * MODULE_MAX[m] * 10) / 10
  })

  const total = normalized.HES + normalized.CSF + normalized.ECPQ + normalized.EDC + normalized.RRC
  const riskTotal = Math.round(total * 10) / 10
  const capacity = Math.round((100 - riskTotal) * 10) / 10
  const tier = getTier(capacity, criticalAttention)

  return {
    normalized,
    riskTotal,
    capacity,
    tier: tier.tier,
    criticalAttention,
  }
}

function computeTopRisks(normalized: Record<ModuleCode, number>) {
  const drivers = [
    { key: "flood", module: "HES" as const, title: "Flood exposure", w: 1.0 },
    { key: "heat", module: "HES" as const, title: "Heat stress", w: 0.9 },
    { key: "cold", module: "CSF" as const, title: "Cold-chain fragility", w: 1.2 },
    { key: "backup", module: "ECPQ" as const, title: "Backup gaps", w: 1.1 },
    { key: "sop", module: "RRC" as const, title: "SOP & readiness", w: 1.0 },
  ]

  return drivers
    .map((d) => {
      const moduleScore = normalized[d.module]
      const sev = Math.round(clamp((moduleScore / MODULE_MAX[d.module]) * 100 * d.w, 0, 100))
      return {
        title: d.title,
        riskType: d.key,
        severity: sev,
        priorityScore: sev,
      }
    })
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5)
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
 * GET /api/assessment-cycles/[cycleId]/climate
 * Returns persisted climate assessment (responses, evidence, score summary, top risks).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cycleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { cycleId } = await params
    if (!cycleId) return NextResponse.json({ error: "Missing cycleId" }, { status: 400 })

    const access = await requireCycleAccess(session, cycleId)
    if ("error" in access) return access.error

    const [responses, evidence, score, risks] = await Promise.all([
      db
        .select()
        .from(climateAssessmentResponses)
        .where(eq(climateAssessmentResponses.assessmentCycleId, cycleId))
        .orderBy(desc(climateAssessmentResponses.updatedAt)),
      db
        .select()
        .from(evidenceItems)
        .where(eq(evidenceItems.assessmentCycleId, cycleId))
        .orderBy(desc(evidenceItems.capturedAt)),
      db.select().from(climateScoreSummaries).where(eq(climateScoreSummaries.assessmentCycleId, cycleId)).limit(1),
      db.select().from(riskDrivers).where(eq(riskDrivers.assessmentCycleId, cycleId)).orderBy(riskDrivers.rank).limit(10),
    ])

    // #region agent log
    fetch('http://127.0.0.1:7272/ingest/c99fbffc-2c05-4b71-ad32-c7c14a4d90a6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'af648d'},body:JSON.stringify({sessionId:'af648d',runId:'pre-fix',hypothesisId:'H3',location:'assessment-cycles/[cycleId]/climate/route.ts:GET',message:'API climate snapshot returned',data:{cycleId,facilityId:access.cycle.facilityId,responsesCount:responses.length,evidenceCount:evidence.length,hasScore:!!score[0],rcs:score[0]?.rcs ?? null,tier:score[0]?.tier ?? null,risksCount:risks.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      cycle: access.cycle,
      responses,
      evidence,
      score: score[0] ?? null,
      topRisks: risks,
    })
  } catch (error) {
    console.error("[assessment-cycle climate GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/assessment-cycles/[cycleId]/climate
 * Persists responses + evidence (replaces existing for the cycle).
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
    const responses = Array.isArray(body.responses) ? body.responses : []
    const evidence = Array.isArray(body.evidence) ? body.evidence : []

    // Basic payload validation
    for (const r of responses) {
      if (!r || typeof r !== "object") {
        return NextResponse.json({ error: "Invalid responses payload" }, { status: 400 })
      }
      if (typeof r.moduleCode !== "string" || !(r.moduleCode in MODULE_MAX)) {
        return NextResponse.json({ error: "Invalid moduleCode in responses" }, { status: 400 })
      }
      if (typeof r.questionCode !== "string" || !r.questionCode) {
        return NextResponse.json({ error: "Missing questionCode in responses" }, { status: 400 })
      }
      if (typeof r.answerValue !== "string" || !r.answerValue) {
        return NextResponse.json({ error: "Missing answerValue in responses" }, { status: 400 })
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(climateAssessmentResponses).where(eq(climateAssessmentResponses.assessmentCycleId, cycleId))
      await tx.delete(evidenceItems).where(eq(evidenceItems.assessmentCycleId, cycleId))

      if (responses.length > 0) {
        await tx.insert(climateAssessmentResponses).values(
          responses.map((r: any) => ({
            id: generateId(),
            assessmentCycleId: cycleId,
            moduleCode: r.moduleCode,
            questionCode: r.questionCode,
            answerValue: r.answerValue,
            score: Number(r.score ?? 0),
            scoreMax: Number(r.scoreMax ?? 0),
            note: typeof r.note === "string" ? r.note : null,
            confidence: typeof r.confidence === "number" ? r.confidence : 100,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        )
      }

      if (evidence.length > 0) {
        await tx.insert(evidenceItems).values(
          evidence.map((e: any) => ({
            id: generateId(),
            assessmentCycleId: cycleId,
            questionCode: String(e.questionCode ?? ""),
            type: String(e.type ?? "note"),
            fileUrl: typeof e.fileUrl === "string" ? e.fileUrl : null,
            note: typeof e.note === "string" ? e.note : null,
            capturedAt: e.capturedAt ? new Date(e.capturedAt) : new Date(),
          }))
        )
      }

      await tx
        .update(assessmentCycles)
        .set({ updatedAt: new Date() })
        .where(eq(assessmentCycles.id, cycleId))
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[assessment-cycle climate PUT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/assessment-cycles/[cycleId]/climate
 * Computes + persists score summary + top risks from submitted responses.
 * Body: { responses: [...], criticalAttention?: boolean }
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
    const responses = Array.isArray(body.responses) ? body.responses : []
    if (responses.length === 0) {
      return NextResponse.json({ error: "responses[] required to compute score" }, { status: 400 })
    }

    const computed = computeScores({ responses })
    const topRisks = computeTopRisks(computed.normalized)

    await db.transaction(async (tx) => {
      // Upsert summary for the cycle (delete+insert keeps it simple across MySQL/TiDB variants)
      await tx.delete(climateScoreSummaries).where(eq(climateScoreSummaries.assessmentCycleId, cycleId))

      await tx.insert(climateScoreSummaries).values({
        id: generateId(),
        assessmentCycleId: cycleId,
        hes: Math.round(computed.normalized.HES),
        csf: Math.round(computed.normalized.CSF),
        ecpq: Math.round(computed.normalized.ECPQ),
        edc: Math.round(computed.normalized.EDC),
        rrc: Math.round(computed.normalized.RRC),
        rcs: Math.round(computed.capacity),
        tier: computed.tier,
        criticalAttention: computed.criticalAttention,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await tx.delete(riskDrivers).where(eq(riskDrivers.assessmentCycleId, cycleId))
      if (topRisks.length > 0) {
        await tx.insert(riskDrivers).values(
          topRisks.map((r, idx) => ({
            id: generateId(),
            assessmentCycleId: cycleId,
            title: r.title,
            riskType: r.riskType,
            severity: r.severity,
            priorityScore: r.priorityScore,
            rank: idx + 1,
            createdAt: new Date(),
          }))
        )
      }

      await tx.update(assessmentCycles).set({ updatedAt: new Date() }).where(eq(assessmentCycles.id, cycleId))
    })

    const [score] = await db
      .select()
      .from(climateScoreSummaries)
      .where(eq(climateScoreSummaries.assessmentCycleId, cycleId))
      .limit(1)

    const risks = await db
      .select()
      .from(riskDrivers)
      .where(eq(riskDrivers.assessmentCycleId, cycleId))
      .orderBy(riskDrivers.rank)
      .limit(10)

    return NextResponse.json({ success: true, score: score ?? null, topRisks: risks })
  } catch (error) {
    console.error("[assessment-cycle climate POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

