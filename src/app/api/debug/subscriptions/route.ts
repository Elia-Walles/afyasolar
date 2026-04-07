import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { serviceSubscriptions, facilities } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log("[DEBUG] Debug subscriptions: Starting debug check")
    
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.log("[DEBUG] Debug subscriptions: No session found")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      console.log("[DEBUG] Debug subscriptions: No facilityId in session", session.user)
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    console.log(`[DEBUG] Debug subscriptions: Checking for facility ${facilityId}`)

    // Get facility info
    const facilityInfo = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    console.log(`[DEBUG] Debug subscriptions: Found facility:`, facilityInfo[0]?.name)

    // Get all subscriptions for this facility
    const allSubscriptions = await db
      .select()
      .from(serviceSubscriptions)
      .where(eq(serviceSubscriptions.facilityId, facilityId))

    console.log(`[DEBUG] Debug subscriptions: Found ${allSubscriptions.length} total subscriptions`)

    // Check specific services
    const services = ['afya-solar']
    const serviceChecks: Record<string, any> = {}

    for (const serviceName of services) {
      const subscription = await db
        .select()
        .from(serviceSubscriptions)
        .where(
          and(
            eq(serviceSubscriptions.facilityId, facilityId),
            eq(serviceSubscriptions.serviceName, serviceName),
            eq(serviceSubscriptions.status, 'active')
          )
        )
        .limit(1)

      const sub = subscription.length > 0 ? subscription[0] : null
      const now = new Date()
      const expiryDate = sub?.expiryDate ? new Date(sub.expiryDate) : null
      const isExpired = expiryDate && expiryDate < now
      
      serviceChecks[serviceName] = {
        hasSubscription: sub !== null,
        subscription: sub,
        expiryDate: expiryDate,
        isExpired,
        hasAccess: sub !== null && !isExpired && sub.status === 'active'
      }

      console.log(`[DEBUG] Debug subscriptions: ${serviceName} check:`, serviceChecks[serviceName])
    }

    return NextResponse.json({
      facilityId,
      facility: facilityInfo[0] || null,
      allSubscriptions,
      serviceChecks,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    console.error("Debug subscription check error:", error)
    return NextResponse.json(
      { error: "Failed to check subscriptions", details: (error as Error)?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
