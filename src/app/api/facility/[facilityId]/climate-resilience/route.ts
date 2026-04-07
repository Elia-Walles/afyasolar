import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { buildClimateResiliencePayload } from "@/lib/efficiency-climate/climate-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/facility/[facilityId]/climate-resilience?mock=1
 * Climate risk scores, adaptation plan, resilience trend (simulated when DB empty).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { facilityId } = await params
    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const forceMock = new URL(request.url).searchParams.get("mock") === "1"

    const data = await buildClimateResiliencePayload(facilityId, {
      forceMock,
      seedIfEmpty: true,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[climate-resilience]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
