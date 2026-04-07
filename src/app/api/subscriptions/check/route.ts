export const dynamic = "force-dynamic"
export const revalidate = 0

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { serviceSubscriptions } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// GET /api/subscriptions/check?service=<service> - Check if facility has active subscription
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryFacilityId = searchParams.get('facilityId')
    const facilityId = queryFacilityId || session.user.facilityId
    
    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    const serviceName = searchParams.get("service")

    if (!serviceName) {
      return NextResponse.json(
        { error: "Service name is required" },
        { status: 400 }
      )
    }

    console.log('[DEBUG API] GET /api/subscriptions/check - Request:', {
      facilityId,
      serviceName,
    })

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

    console.log('[DEBUG API] GET /api/subscriptions/check - Query result:', {
      subscriptionCount: subscription.length,
      subscriptions: subscription.map(sub => ({
        id: sub.id,
        facilityId: sub.facilityId,
        serviceName: sub.serviceName,
        status: sub.status,
        expiryDate: sub.expiryDate,
      })),
    })

    if (subscription.length === 0) {
      console.log('[DEBUG API] GET /api/subscriptions/check - No subscription found')
      return NextResponse.json({ 
        hasAccess: false,
        message: "No active subscription found"
      })
    }

    const sub = subscription[0]
    const now = new Date()
    const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null
    
    // Check if subscription is expired
    const isExpired = expiryDate && expiryDate < now
    
    // If subscription is expired but status is still 'active', update it
    if (isExpired && sub.status === 'active') {
      console.log('[DEBUG API] GET /api/subscriptions/check - Subscription expired, updating status to expired')
      await db
        .update(serviceSubscriptions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(serviceSubscriptions.id, sub.id))
      // Update the in-memory object
      sub.status = 'expired'
    }
    
    const hasAccess = !isExpired && sub.status === 'active'

    console.log('[DEBUG API] GET /api/subscriptions/check - Access calculation:', {
      subscriptionId: sub.id,
      status: sub.status,
      expiryDate: sub.expiryDate,
      expiryDateParsed: expiryDate?.toISOString(),
      now: now.toISOString(),
      isExpired,
      hasAccess,
    })

    const response = {
      hasAccess,
      subscription: hasAccess ? {
        id: sub.id,
        serviceName: sub.serviceName,
        status: sub.status,
        planType: sub.planType,
        expiryDate: sub.expiryDate,
        isExpired,
      } : null,
      message: hasAccess 
        ? "Active subscription found" 
        : isExpired 
          ? "Subscription has expired"
          : "Subscription is not active"
    }

    console.log('[DEBUG API] GET /api/subscriptions/check - Response:', response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error checking subscription:", error)
    return NextResponse.json(
      { error: "Failed to check subscription" },
      { status: 500 }
    )
  }
}

