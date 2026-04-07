import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { buildEfficiencyPerformancePayload } from "@/lib/efficiency-climate/efficiency-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/facility/[facilityId]/efficiency-performance?days=30&mock=1&evaluateAlerts=1&solarCapacityKw=5
 * Meter-based efficiency vs expected yield, payment-model billing context, optional alert evaluation.
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

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30", 10)
    const forceMock = searchParams.get("mock") === "1"
    const evaluateAlerts = searchParams.get("evaluateAlerts") === "1"
    const solarKw = searchParams.get("solarCapacityKw")
    const solarCapacityKw = solarKw ? parseFloat(solarKw) : undefined

    const payload = await buildEfficiencyPerformancePayload(facilityId, {
      days,
      forceMock,
      evaluateAlerts,
      solarCapacityKw,
    })

    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    console.error("[efficiency-performance]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
