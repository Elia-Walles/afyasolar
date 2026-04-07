import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { facilities } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const ALL_SERVICES = ["afya-solar"] as const
type ServiceName = (typeof ALL_SERVICES)[number]

type ServiceVisibilityConfig = {
  visibleServices?: ServiceName[]
  /** Legacy field; normalized to afya-solar for this deployment. */
  defaultService?: ServiceName | "services-hub" | null
}

function parseVisibility(raw: unknown): ServiceVisibilityConfig {
  if (!raw || typeof raw !== "object") return {}
  const obj = raw as Record<string, unknown>
  const visible = Array.isArray(obj.visibleServices)
    ? (obj.visibleServices.filter((s: unknown) => typeof s === "string" && ALL_SERVICES.includes(s as ServiceName)) as ServiceName[])
    : undefined

  const rawDefault = obj.defaultService
  let defaultService: ServiceVisibilityConfig["defaultService"]
  if (typeof rawDefault === "string") {
    if (rawDefault === "services-hub") {
      defaultService = "afya-solar"
    } else if (ALL_SERVICES.includes(rawDefault as ServiceName)) {
      defaultService = rawDefault as ServiceName
    }
  }

  return {
    visibleServices: visible,
    defaultService,
  }
}

async function getFacilityVisibility(facilityId: string): Promise<ServiceVisibilityConfig> {
  const rows = await db
    .select({
      bookingSettings: facilities.bookingSettings,
    })
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1)

  if (!rows[0]) {
    throw new Error("Facility not found")
  }

  const raw = rows[0].bookingSettings
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    const visibility = parseVisibility(parsed?.serviceVisibility)
    return visibility
  } catch {
    return {}
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { facilityId } = await params

    const visibility = await getFacilityVisibility(facilityId)

    const visibleServices = visibility.visibleServices && visibility.visibleServices.length > 0 ? visibility.visibleServices : ALL_SERVICES

    return NextResponse.json({
      success: true,
      data: {
        visibleServices,
        defaultService: "afya-solar" as const,
      },
    })
  } catch (error) {
    console.error("Error fetching service visibility:", error)
    if (error instanceof Error && error.message === "Facility not found") {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { facilityId } = await params
    const body = await request.json()

    const requestedVisible: unknown = body.visibleServices

    const visibleServices: ServiceName[] = Array.isArray(requestedVisible)
      ? (requestedVisible.filter((s: unknown) => typeof s === "string" && ALL_SERVICES.includes(s as ServiceName)) as ServiceName[])
      : Array.from(ALL_SERVICES)

    const defaultService: ServiceName = "afya-solar"

    if (!visibleServices.includes(defaultService)) {
      return NextResponse.json({ error: "Afya Solar must remain visible for this deployment" }, { status: 400 })
    }

    const rows = await db
      .select({
        bookingSettings: facilities.bookingSettings,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!rows[0]) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 })
    }

    let existing: Record<string, unknown> = {}
    if (rows[0].bookingSettings) {
      try {
        existing = JSON.parse(rows[0].bookingSettings as string) as Record<string, unknown>
      } catch {
        existing = {}
      }
    }

    const nextSettings = {
      ...existing,
      serviceVisibility: {
        visibleServices,
        defaultService,
      },
    }

    await db
      .update(facilities)
      .set({
        bookingSettings: JSON.stringify(nextSettings),
      })
      .where(eq(facilities.id, facilityId))

    return NextResponse.json({
      success: true,
      data: {
        visibleServices,
        defaultService,
      },
    })
  } catch (error) {
    console.error("Error updating service visibility:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

