import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { getRawConnection } from "@/lib/db"
import type { RowDataPacket } from "mysql2"

export const dynamic = "force-dynamic"

function parseJsonField(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === "object") return raw
  return null
}

function energyMetrics(payload: unknown) {
  const p = payload as Record<string, unknown> | null
  if (!p || typeof p !== "object") {
    return { bmiPercent: null as number | null, rawScore: null as number | null }
  }
  const ops = (p.operationsData ?? p.operations) as Record<string, unknown> | undefined
  const score = typeof ops?.assessmentScore === "number" ? Number(ops.assessmentScore) : null
  const bmiPercent = score !== null ? Math.round((score / 40) * 100) : null
  return { bmiPercent, rawScore: score }
}

function climateMetrics(payload: unknown) {
  const p = payload as Record<string, unknown> | null
  if (!p || typeof p !== "object") {
    return {
      rcs: null as number | null,
      tier: null as number | null,
      criticalAttention: false,
      evidenceCount: 0,
    }
  }
  const score = (p.score ?? p.climateScore) as Record<string, unknown> | undefined
  const raw = score?.rcs
  const rcs = raw !== undefined && raw !== null && !Number.isNaN(Number(raw)) ? Number(raw) : null
  const tierRaw = score?.tier
  const tier =
    typeof tierRaw === "number"
      ? tierRaw
      : tierRaw !== undefined && tierRaw !== null && !Number.isNaN(Number(tierRaw))
        ? Number(tierRaw)
        : null
  const criticalAttention = Boolean(score?.criticalAttention)
  const ev = p.evidence
  const evidenceCount = Array.isArray(ev) ? ev.length : 0
  return { rcs, tier, criticalAttention, evidenceCount }
}

type SummaryRow = RowDataPacket & {
  facilityId: string
  facilityName: string
  city: string | null
  region: string | null
  facilityStatus: string | null
  energyAssessmentDate: Date | string | null
  energyPayload: unknown
  climateAssessmentDate: Date | string | null
  climatePayload: unknown
}

/**
 * GET /api/admin/afya-solar/assessment-snapshot-summary
 * Read-only latest energy/climate assessment snapshot metadata per facility (no full JSON in UI lists).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pool = getRawConnection()
    const [rows] = await pool.query<SummaryRow[]>(
      `SELECT 
        f.id AS facilityId,
        f.name AS facilityName,
        f.city AS city,
        f.region AS region,
        f.status AS facilityStatus,
        e.assessment_date AS energyAssessmentDate,
        e.payload AS energyPayload,
        c.assessment_date AS climateAssessmentDate,
        c.payload AS climatePayload
      FROM facilities f
      LEFT JOIN facility_energy_assessments e ON e.id = (
        SELECT e2.id FROM facility_energy_assessments e2
        WHERE e2.facility_id = f.id
        ORDER BY e2.assessment_date DESC, e2.updated_at DESC
        LIMIT 1
      )
      LEFT JOIN facility_climate_assessments c ON c.id = (
        SELECT c2.id FROM facility_climate_assessments c2
        WHERE c2.facility_id = f.id
        ORDER BY c2.assessment_date DESC, c2.updated_at DESC
        LIMIT 1
      )
      ORDER BY f.name ASC`
    )

    const data = (rows || []).map((row) => {
      const energyPayload = parseJsonField(row.energyPayload)
      const climatePayload = parseJsonField(row.climatePayload)
      const e = energyMetrics(energyPayload)
      const cl = climateMetrics(climatePayload)
      return {
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        city: row.city,
        region: row.region,
        facilityStatus: row.facilityStatus,
        energyAssessmentDate: row.energyAssessmentDate
          ? new Date(row.energyAssessmentDate as Date).toISOString()
          : null,
        climateAssessmentDate: row.climateAssessmentDate
          ? new Date(row.climateAssessmentDate as Date).toISOString()
          : null,
        energyBmiPercent: e.bmiPercent,
        energyBmiRawScore: e.rawScore,
        climateRcs: cl.rcs,
        climateTier: cl.tier,
        climateCriticalAttention: cl.criticalAttention,
        climateEvidenceCount: cl.evidenceCount,
        hasEnergySnapshot: Boolean(row.energyAssessmentDate),
        hasClimateSnapshot: Boolean(row.climateAssessmentDate),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[assessment-snapshot-summary GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
