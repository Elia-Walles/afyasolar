import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { afyaSolarInvoiceRequests, afyaBookingInvoiceRequests } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/invoice-requests
 * Admin lists all Afya Solar & Afya Booking invoice requests (Pay By Invoice) in a single view.
 *
 * Query params:
 * - status: optional, filter by status: 'pending' | 'approved' | 'rejected' | 'paid'
 * - service: optional, 'afya-solar' | 'afya-booking' (defaults to both)
 * - limit: optional, max number of records (default 100, max 500)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const service = searchParams.get("service")
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500)

    const allowedStatuses = ["pending", "approved", "rejected", "paid"]
    const filterByStatus = status && allowedStatuses.includes(status)

    const servicesToInclude: ("afya-solar" | "afya-booking")[] =
      service === "afya-solar" || service === "afya-booking"
        ? [service]
        : ["afya-solar", "afya-booking"]

    const results: any[] = []

    // Fetch Afya Solar invoice requests if included
    if (servicesToInclude.includes("afya-solar")) {
      const solarConditions = []
      if (filterByStatus) {
        solarConditions.push(eq(afyaSolarInvoiceRequests.status, status as any))
      }

      const solarRequests = await db
        .select()
        .from(afyaSolarInvoiceRequests)
        .where(solarConditions.length > 0 ? and(...solarConditions) : undefined)
        .orderBy(desc(afyaSolarInvoiceRequests.createdAt))
        .limit(limit)

      results.push(
        ...solarRequests.map((row) => ({
          ...row,
          serviceName: "afya-solar" as const,
        })),
      )
    }

    // Fetch Afya Booking invoice requests if included
    if (servicesToInclude.includes("afya-booking")) {
      const bookingConditions = []
      if (filterByStatus) {
        bookingConditions.push(eq(afyaBookingInvoiceRequests.status, status as any))
      }

      const bookingRequests = await db
        .select()
        .from(afyaBookingInvoiceRequests)
        .where(bookingConditions.length > 0 ? and(...bookingConditions) : undefined)
        .orderBy(desc(afyaBookingInvoiceRequests.createdAt))
        .limit(limit)

      results.push(
        ...bookingRequests.map((row) => ({
          ...row,
          serviceName: "afya-booking" as const,
        })),
      )
    }

    // Sort combined results by createdAt desc
    results.sort((a, b) => {
      const aDate = new Date(a.createdAt ?? a.created_at ?? 0).getTime()
      const bDate = new Date(b.createdAt ?? b.created_at ?? 0).getTime()
      return bDate - aDate
    })

    return NextResponse.json({
      success: true,
      data: results.slice(0, limit),
    })
  } catch (error) {
    console.error("Error fetching invoice requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

