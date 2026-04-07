import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { buildEfficiencyPerformancePayload } from "@/lib/efficiency-climate/efficiency-service"

export const dynamic = "force-dynamic"

const MANAGEMENT_PANEL_EMAIL = "services@ubuntuafyalink.co.tz"

/**
 * GET /api/management-panel/efficiency-meter?facilityId=&days=30&solarCapacityKw=
 * Demo / portfolio view using same efficiency engine (simulated + optional DB overlay).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email.toLowerCase() !== MANAGEMENT_PANEL_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get("facilityId")
    if (!facilityId) {
      return NextResponse.json({ error: "facilityId query required" }, { status: 400 })
    }

    const days = parseInt(searchParams.get("days") || "30", 10)
    const solarCapacityKw = searchParams.get("solarCapacityKw")
      ? parseFloat(searchParams.get("solarCapacityKw")!)
      : undefined
    const forceMock = searchParams.get("mock") !== "0"

    const data = await buildEfficiencyPerformancePayload(facilityId, {
      days,
      forceMock,
      solarCapacityKw,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[management-panel/efficiency-meter]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
