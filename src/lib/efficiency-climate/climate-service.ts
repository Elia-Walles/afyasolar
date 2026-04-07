import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  facilities,
  facilityClimateAdaptation,
  facilityClimateProfile,
  facilityResilienceSnapshot,
} from "@/lib/db/schema"
import { ensureEfficiencyClimateTables } from "@/lib/db/ensure-efficiency-climate-tables"
import {
  defaultAdaptationsForProfile,
  simulateClimateProfile,
  simulateResilienceTrend,
} from "@/lib/efficiency-climate/simulation"
import { generateId } from "@/lib/utils"

export type AdaptationPayload = {
  id: string
  riskCategory: string
  recommendation: string
  status: string
  implementedAt: string | null
  effectivenessNote: string | null
}

export type ClimateResiliencePayload = {
  facilityId: string
  profile: {
    floodRiskScore: number
    heatRiskScore: number
    windRiskScore: number
    rainRiskScore: number
    overallResilienceScore: number
    latitude: number | null
    longitude: number | null
    dataSource: string
  }
  adaptations: AdaptationPayload[]
  monthlyTrend: { periodMonth: string; resilienceScore: number; adaptationCompletionPct: number }[]
  completionPct: number
}

async function seedAdaptationsIfEmpty(facilityId: string, profile: ReturnType<typeof simulateClimateProfile>) {
  const existing = await db
    .select({ id: facilityClimateAdaptation.id })
    .from(facilityClimateAdaptation)
    .where(eq(facilityClimateAdaptation.facilityId, facilityId))
    .limit(1)

  if (existing.length > 0) return

  const templates = defaultAdaptationsForProfile(profile)
  for (const t of templates) {
    await db.insert(facilityClimateAdaptation).values({
      id: generateId(),
      facilityId,
      riskCategory: t.riskCategory,
      recommendation: t.recommendation,
      status: "recommended",
    })
  }
}

export async function buildClimateResiliencePayload(
  facilityId: string,
  options: { forceMock?: boolean; seedIfEmpty?: boolean } = {}
): Promise<ClimateResiliencePayload> {
  await ensureEfficiencyClimateTables()

  let region: string | null = null
  try {
    const [f] = await db
      .select({ region: facilities.region })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)
    region = f?.region ?? null
  } catch {
    region = null
  }

  let profileRow = null as (typeof facilityClimateProfile.$inferSelect) | null
  try {
    const rows = await db
      .select()
      .from(facilityClimateProfile)
      .where(eq(facilityClimateProfile.facilityId, facilityId))
      .limit(1)
    profileRow = rows[0] ?? null
  } catch {
    profileRow = null
  }

  const simulated = simulateClimateProfile(facilityId, region)

  const profileValues = {
    floodRiskScore: String(simulated.floodRiskScore),
    heatRiskScore: String(simulated.heatRiskScore),
    windRiskScore: String(simulated.windRiskScore),
    rainRiskScore: String(simulated.rainRiskScore),
    overallResilienceScore: String(simulated.overallResilienceScore),
    latitude: String(simulated.latitude),
    longitude: String(simulated.longitude),
    dataSource: "simulated" as const,
  }

  try {
    if (!profileRow) {
      await db.insert(facilityClimateProfile).values({
        facilityId,
        ...profileValues,
      })
    } else if (options.forceMock) {
      await db
        .update(facilityClimateProfile)
        .set(profileValues)
        .where(eq(facilityClimateProfile.facilityId, facilityId))
    }
  } catch (e) {
    console.warn("[climate-service] profile upsert:", e)
  }

  const [freshProfile] = await db
    .select()
    .from(facilityClimateProfile)
    .where(eq(facilityClimateProfile.facilityId, facilityId))
    .limit(1)

  profileRow =
    freshProfile ??
    ({
      facilityId,
      ...profileValues,
      updatedAt: new Date(),
    } as typeof facilityClimateProfile.$inferSelect)

  if (options.seedIfEmpty !== false) {
    try {
      await seedAdaptationsIfEmpty(facilityId, simulated)
    } catch {
      /* non-fatal */
    }
  }

  let adaptationRows: (typeof facilityClimateAdaptation.$inferSelect)[] = []
  try {
    adaptationRows = await db
      .select()
      .from(facilityClimateAdaptation)
      .where(eq(facilityClimateAdaptation.facilityId, facilityId))
  } catch {
    adaptationRows = []
  }

  if (adaptationRows.length === 0) {
    adaptationRows = defaultAdaptationsForProfile(simulated).map((t, i) => ({
      id: `local-${i}`,
      facilityId,
      riskCategory: t.riskCategory,
      recommendation: t.recommendation,
      status: "recommended",
      implementedAt: null,
      effectivenessNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  }

  const completed = adaptationRows.filter((a) => a.status === "completed").length
  const completionPct =
    adaptationRows.length > 0 ? Math.round((completed / adaptationRows.length) * 100) : 0

  let snapshots: (typeof facilityResilienceSnapshot.$inferSelect)[] = []
  try {
    snapshots = await db
      .select()
      .from(facilityResilienceSnapshot)
      .where(eq(facilityResilienceSnapshot.facilityId, facilityId))
      .limit(24)
  } catch {
    snapshots = []
  }

  const monthlyTrend =
    snapshots.length >= 3
      ? snapshots
          .map((s) => ({
            periodMonth: s.periodMonth,
            resilienceScore: Number(s.resilienceScore),
            adaptationCompletionPct: Number(s.adaptationCompletionPct ?? completionPct),
          }))
          .sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
      : simulateResilienceTrend(facilityId, 12, completionPct)

  const profile = profileRow!

  return {
    facilityId,
    profile: {
      floodRiskScore: Number(profile.floodRiskScore),
      heatRiskScore: Number(profile.heatRiskScore),
      windRiskScore: Number(profile.windRiskScore),
      rainRiskScore: Number(profile.rainRiskScore),
      overallResilienceScore: Number(profile.overallResilienceScore),
      latitude: profile.latitude != null ? Number(profile.latitude) : null,
      longitude: profile.longitude != null ? Number(profile.longitude) : null,
      dataSource: profile.dataSource,
    },
    adaptations: adaptationRows.map((a) => ({
      id: a.id,
      riskCategory: a.riskCategory,
      recommendation: a.recommendation,
      status: a.status,
      implementedAt: a.implementedAt ? new Date(a.implementedAt).toISOString() : null,
      effectivenessNote: a.effectivenessNote,
    })),
    monthlyTrend,
    completionPct,
  }
}

export async function updateAdaptationStatus(
  facilityId: string,
  adaptationId: string,
  body: { status: string; effectivenessNote?: string | null }
): Promise<AdaptationPayload | null> {
  await ensureEfficiencyClimateTables()
  const implementedAt =
    body.status === "completed" ? new Date() : body.status === "recommended" ? null : undefined

  await db
    .update(facilityClimateAdaptation)
    .set({
      status: body.status,
      ...(implementedAt !== undefined ? { implementedAt } : {}),
      ...(body.effectivenessNote !== undefined ? { effectivenessNote: body.effectivenessNote } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(facilityClimateAdaptation.id, adaptationId), eq(facilityClimateAdaptation.facilityId, facilityId))
    )

  const [row] = await db
    .select()
    .from(facilityClimateAdaptation)
    .where(
      and(eq(facilityClimateAdaptation.id, adaptationId), eq(facilityClimateAdaptation.facilityId, facilityId))
    )
    .limit(1)

  if (!row) return null
  return {
    id: row.id,
    riskCategory: row.riskCategory,
    recommendation: row.recommendation,
    status: row.status,
    implementedAt: row.implementedAt ? new Date(row.implementedAt).toISOString() : null,
    effectivenessNote: row.effectivenessNote,
  }
}
