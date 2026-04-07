import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { updateAdaptationStatus } from "@/lib/efficiency-climate/climate-service"

export const dynamic = "force-dynamic"

const VALID = new Set(["recommended", "planned", "in_progress", "completed", "dismissed"])

/**
 * PATCH /api/facility/[facilityId]/climate-resilience/adaptations/[adaptationId]
 * Body: { status, effectivenessNote? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string; adaptationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { facilityId, adaptationId } = await params
    if (!facilityId || !adaptationId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (adaptationId.startsWith("local-")) {
      return NextResponse.json(
        { error: "Save climate profile to the database first (open Climate resilience once online)." },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const status = typeof body.status === "string" ? body.status : ""
    if (!VALID.has(status)) {
      return NextResponse.json(
        { error: `Invalid status. Use one of: ${[...VALID].join(", ")}` },
        { status: 400 }
      )
    }

    const updated = await updateAdaptationStatus(facilityId, adaptationId, {
      status,
      effectivenessNote: body.effectivenessNote ?? null,
    })

    if (!updated) {
      return NextResponse.json({ error: "Adaptation not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, adaptation: updated })
  } catch (error) {
    console.error("[climate adaptation PATCH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
