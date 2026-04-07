import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db, getRawConnection } from "@/lib/db"
import { admins, facilities, users } from "@/lib/db/schema"
import { desc, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

type RangePreset = "weekly" | "monthly" | "all" | "all-time"
type Scope = "users" | "facilities"

function resolveRange(preset: RangePreset) {
  const now = new Date()
  if (preset === "weekly") return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now }
  if (preset === "monthly") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now }
  if (preset === "all") return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to: now }
  return { from: null as Date | null, to: null as Date | null }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scope = (searchParams.get("scope") || "users") as Scope
    const preset = (searchParams.get("range") || "monthly") as RangePreset
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const presetRange = resolveRange(preset)
    const from = fromParam ? new Date(fromParam) : presetRange.from
    const to = toParam ? new Date(toParam) : presetRange.to

    // We keep the response shape identical to v0.
    // If the auth_login_events table doesn't exist yet, return an empty report.
    let loginAgg: Array<{
      entityType: string | null
      entityId: string | null
      identifier: string | null
      loginCount: number
      lastEventAt: string | null
    }> = []

    try {
      const conn = getRawConnection()
      const params: any[] = []
      const where: string[] = ["success = true"]

      if (scope === "facilities") {
        where.push("entity_type = 'facility'")
      }

      if (from) {
        where.push("created_at >= ?")
        params.push(from)
      }
      if (to) {
        where.push("created_at <= ?")
        params.push(to)
      }

      const [rows] = await conn.query(
        `
          SELECT
            entity_type AS entityType,
            entity_id AS entityId,
            identifier AS identifier,
            COUNT(*) AS loginCount,
            MAX(created_at) AS lastEventAt
          FROM auth_login_events
          WHERE ${where.join(" AND ")}
          GROUP BY entity_type, entity_id, identifier
          ORDER BY COUNT(*) DESC
          LIMIT 200
        `,
        params
      )

      loginAgg = (rows as any[]).map((r) => ({
        entityType: r.entityType ?? null,
        entityId: r.entityId ?? null,
        identifier: r.identifier ?? null,
        loginCount: Number(r.loginCount || 0),
        lastEventAt: r.lastEventAt ? new Date(r.lastEventAt).toISOString() : null,
      }))
    } catch (e: any) {
      const code = e?.code || e?.errno
      const message = String(e?.message || "")
      if (code === "ER_NO_SUCH_TABLE" || code === 1146 || message.toLowerCase().includes("doesn't exist")) {
        loginAgg = []
      } else {
        throw e
      }
    }

    if (scope === "facilities") {
      const facilityIds = loginAgg.map((r) => r.entityId).filter(Boolean) as string[]
      const facilityRows = facilityIds.length
        ? await db
            .select({
              id: facilities.id,
              name: facilities.name,
              region: facilities.region,
              city: facilities.city,
              status: facilities.status,
              lastLoginAt: facilities.lastLoginAt,
            })
            .from(facilities)
            .where(sql`${facilities.id} in (${sql.join(facilityIds.map((id) => sql`${id}`), sql`,`)})`)
        : []

      const byId = new Map(facilityRows.map((f) => [f.id, f]))

      return NextResponse.json({
        scope,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        rows: loginAgg.map((r) => {
          const f = r.entityId ? byId.get(r.entityId) : undefined
          return {
            facilityId: r.entityId,
            facilityName: f?.name || "Unknown facility",
            region: f?.region || null,
            city: f?.city || null,
            status: f?.status || null,
            lastLoginAt: f?.lastLoginAt ? new Date(f.lastLoginAt).toISOString() : null,
            loginCount: Number(r.loginCount || 0),
            lastEventAt: r.lastEventAt,
          }
        }),
      })
    }

    // users scope: join to users/admins for display
    const userIds = loginAgg.map((r) => r.entityId).filter(Boolean) as string[]
    const [userRows, adminRows] = await Promise.all([
      userIds.length
        ? db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              phone: users.phone,
              role: users.role,
              lastLoginAt: users.lastLoginAt,
            })
            .from(users)
            .where(sql`${users.id} in (${sql.join(userIds.map((id) => sql`${id}`), sql`,`)})`)
        : Promise.resolve([] as any[]),
      userIds.length
        ? db
            .select({
              id: admins.id,
              name: admins.name,
              email: admins.email,
              lastLoginAt: admins.lastLoginAt,
            })
            .from(admins)
            .where(sql`${admins.id} in (${sql.join(userIds.map((id) => sql`${id}`), sql`,`)})`)
        : Promise.resolve([] as any[]),
    ])

    const userById = new Map(userRows.map((u) => [u.id, { ...u, entityType: "user" }]))
    const adminById = new Map(adminRows.map((a) => [a.id, { ...a, entityType: "admin", role: "admin", phone: null }]))

    return NextResponse.json({
      scope,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      rows: loginAgg.map((r) => {
        const entity = (r.entityId && (userById.get(r.entityId) || adminById.get(r.entityId))) || null
        return {
          userId: r.entityId,
          name: (entity as any)?.name || null,
          email: (entity as any)?.email || r.identifier,
          phone: (entity as any)?.phone || null,
          role: (entity as any)?.role || (r.entityType === "admin" ? "admin" : "facility"),
          lastLoginAt: (entity as any)?.lastLoginAt ? new Date((entity as any).lastLoginAt).toISOString() : null,
          loginCount: Number(r.loginCount || 0),
          lastEventAt: r.lastEventAt,
        }
      }),
    })
  } catch (error) {
    console.error("Error building activity report:", error)
    return NextResponse.json({ error: "Failed to build activity report" }, { status: 500 })
  }
}

