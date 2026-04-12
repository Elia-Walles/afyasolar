import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { assessmentCycles } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * PATCH /api/facility/[facilityId]/assessment-cycles/[cycleId]
 * Body: { status: "completed" | "draft" }
 * Marks a cycle complete (sets completedAt) or re-opens as draft (clears completedAt).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string; cycleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId, cycleId } = await params
    if (!facilityId || !cycleId) return NextResponse.json({ error: "Missing ids" }, { status: 400 })

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({} as { status?: string }))
    const status = typeof body.status === "string" ? body.status.trim() : ""
    if (status !== "completed" && status !== "draft") {
      return NextResponse.json({ error: 'Body must include status: "completed" | "draft"' }, { status: 400 })
    }

    const completedAt = status === "completed" ? new Date() : null

    await db
      .update(assessmentCycles)
      .set({
        status,
        completedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(assessmentCycles.id, cycleId), eq(assessmentCycles.facilityId, facilityId)))

    const [row] = await db
      .select()
      .from(assessmentCycles)
      .where(and(eq(assessmentCycles.id, cycleId), eq(assessmentCycles.facilityId, facilityId)))
      .limit(1)

    if (!row) return NextResponse.json({ error: "Cycle not found" }, { status: 404 })

    return NextResponse.json({ success: true, cycle: row })
  } catch (error) {
    console.error("[assessment-cycles PATCH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
