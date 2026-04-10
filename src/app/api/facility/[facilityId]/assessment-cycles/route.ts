import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { assessmentCycles } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/facility/[facilityId]/assessment-cycles
 * Lists assessment cycles for a facility.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId } = await params
    if (!facilityId) return NextResponse.json({ error: "Facility ID required" }, { status: 400 })

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cycles = await db
      .select()
      .from(assessmentCycles)
      .where(eq(assessmentCycles.facilityId, facilityId))
      .orderBy(desc(assessmentCycles.startedAt))
      .limit(50)

    return NextResponse.json({ success: true, cycles })
  } catch (error) {
    console.error("[assessment-cycles GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/facility/[facilityId]/assessment-cycles
 * Creates a new assessment cycle (draft).
 * Body: { version?: "2.0", createdBy?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { facilityId } = await params
    if (!facilityId) return NextResponse.json({ error: "Facility ID required" }, { status: 400 })

    if (session.user.role !== "admin" && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({} as any))
    const version = typeof body.version === "string" ? body.version : "2.0"
    const createdBy =
      typeof body.createdBy === "string" && body.createdBy.trim()
        ? body.createdBy.trim()
        : session.user.id || session.user.email

    const id = generateId()
    await db.insert(assessmentCycles).values({
      id,
      facilityId,
      status: "draft",
      version,
      createdBy,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const [cycle] = await db
      .select()
      .from(assessmentCycles)
      .where(and(eq(assessmentCycles.id, id), eq(assessmentCycles.facilityId, facilityId)))
      .limit(1)

    return NextResponse.json({ success: true, cycle })
  } catch (error) {
    console.error("[assessment-cycles POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

