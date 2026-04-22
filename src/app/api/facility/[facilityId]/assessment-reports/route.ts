import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilityClimateAssessments, facilityEnergyAssessments } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

function canAccessFacility(session: any, facilityId: string): boolean {
  return session?.user?.role === "admin" || session?.user?.facilityId === facilityId
}

/**
 * GET /api/facility/[facilityId]/assessment-reports
 * Returns the latest persisted energy and climate snapshots for the facility.
 *
 * Query `assessmentCycleId`: when set, returns the latest snapshot **for that cycle** (join on
 * `facility_energy_assessments.assessment_cycle_id` / `facility_climate_assessments.assessment_cycle_id`).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ facilityId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId } = await params
    if (!facilityId) return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    if (!canAccessFacility(session, facilityId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const rawCycle = searchParams.get("assessmentCycleId")
    const assessmentCycleId = rawCycle && rawCycle.trim().length > 0 ? rawCycle.trim() : null

    const [latestEnergy, latestClimate] = await Promise.all([
      assessmentCycleId
        ? db
            .select()
            .from(facilityEnergyAssessments)
            .where(
              and(
                eq(facilityEnergyAssessments.facilityId, facilityId),
                eq(facilityEnergyAssessments.assessmentCycleId, assessmentCycleId)
              )
            )
            .orderBy(desc(facilityEnergyAssessments.assessmentDate), desc(facilityEnergyAssessments.updatedAt))
            .limit(1)
        : db
            .select()
            .from(facilityEnergyAssessments)
            .where(eq(facilityEnergyAssessments.facilityId, facilityId))
            .orderBy(desc(facilityEnergyAssessments.assessmentDate), desc(facilityEnergyAssessments.updatedAt))
            .limit(1),
      assessmentCycleId
        ? db
            .select()
            .from(facilityClimateAssessments)
            .where(
              and(
                eq(facilityClimateAssessments.facilityId, facilityId),
                eq(facilityClimateAssessments.assessmentCycleId, assessmentCycleId)
              )
            )
            .orderBy(desc(facilityClimateAssessments.assessmentDate), desc(facilityClimateAssessments.updatedAt))
            .limit(1)
        : db
            .select()
            .from(facilityClimateAssessments)
            .where(eq(facilityClimateAssessments.facilityId, facilityId))
            .orderBy(desc(facilityClimateAssessments.assessmentDate), desc(facilityClimateAssessments.updatedAt))
            .limit(1),
    ])

    const energyRow = latestEnergy[0] ?? null
    const climateRow = latestClimate[0] ?? null

    return NextResponse.json({
      success: true,
      latestEnergy: energyRow,
      latestClimate: climateRow,
      /** Cycle-scoped aliases (same row when `assessmentCycleId` was passed). */
      energyReport: energyRow,
      climateReport: climateRow,
      assessmentCycleId,
    })
  } catch (error) {
    console.error("[assessment-reports GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/facility/[facilityId]/assessment-reports
 * Saves an explicit energy/climate report snapshot.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ facilityId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId } = await params
    if (!facilityId) return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    if (!canAccessFacility(session, facilityId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({} as any))
    const assessmentCycleId = typeof body.assessmentCycleId === "string" ? body.assessmentCycleId : null
    const sourceVersion = typeof body.sourceVersion === "string" ? body.sourceVersion : "3.0"
    const assessmentDate = body.assessmentDate ? new Date(body.assessmentDate) : new Date()
    const savedBy = session.user.id || session.user.email || null

    let savedEnergyId: string | null = null
    let savedClimateId: string | null = null

    if (body.energy && typeof body.energy === "object") {
      const id = generateId()
      await db.insert(facilityEnergyAssessments).values({
        id,
        facilityId,
        assessmentCycleId,
        assessmentDate,
        savedBy,
        sourceVersion,
        payload: body.energy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      savedEnergyId = id
    }

    if (body.climate && typeof body.climate === "object") {
      const id = generateId()
      await db.insert(facilityClimateAssessments).values({
        id,
        facilityId,
        assessmentCycleId,
        assessmentDate,
        savedBy,
        sourceVersion,
        payload: body.climate,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      savedClimateId = id
    }

    if (!savedEnergyId && !savedClimateId) {
      return NextResponse.json({ error: "Provide energy and/or climate payload to save" }, { status: 400 })
    }

    return NextResponse.json({ success: true, savedEnergyId, savedClimateId })
  } catch (error) {
    console.error("[assessment-reports POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
