export const dynamic = "force-dynamic"
export const revalidate = 0

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { serviceSubscriptions } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// GET /api/subscriptions - Get all subscriptions for a facility
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

    // Check if querying for specific service
    const serviceName = searchParams.get("service")

    let subscriptions
    if (serviceName) {
      subscriptions = await db
        .select()
        .from(serviceSubscriptions)
        .where(
          and(
            eq(serviceSubscriptions.facilityId, facilityId),
            eq(serviceSubscriptions.serviceName, serviceName)
          )
        )
    } else {
      subscriptions = await db
        .select()
        .from(serviceSubscriptions)
        .where(eq(serviceSubscriptions.facilityId, facilityId))
    }

    // Check if subscription is active (not expired)
    const now = new Date()
    const activeSubscriptions = subscriptions.map(sub => {
      const isActive = 
        sub.status === 'active' && 
        (!sub.expiryDate || new Date(sub.expiryDate) > now)
      
      return {
        ...sub,
        isActive,
      }
    })

    return NextResponse.json(activeSubscriptions)
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}

// POST /api/subscriptions - Create new subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.log('[DEBUG API] POST /api/subscriptions - No session')
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryFacilityId = searchParams.get('facilityId')
    const facilityId = queryFacilityId || session.user.facilityId
    
    if (!facilityId) {
      console.log('[DEBUG API] POST /api/subscriptions - No facilityId')
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    const body = await request.json()
    const { serviceName, planType, billingCycle, amount, paymentMethod } = body

    console.log('[DEBUG API] POST /api/subscriptions - Request:', {
      facilityId,
      serviceName,
      planType,
      billingCycle,
      amount,
      paymentMethod,
    })

    if (!serviceName) {
      return NextResponse.json(
        { error: "Service name is required" },
        { status: 400 }
      )
    }

    // Check if facility already has an active subscription for this service
    // First, get all subscriptions (including expired ones) to check and update status
    const allSubscriptions = await db
      .select()
      .from(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.facilityId, facilityId),
          eq(serviceSubscriptions.serviceName, serviceName)
        )
      )

    console.log('[DEBUG API] POST /api/subscriptions - All subscriptions:', {
      count: allSubscriptions.length,
      subscriptions: allSubscriptions.map(sub => ({
        id: sub.id,
        status: sub.status,
        expiryDate: sub.expiryDate,
      })),
    })

    // Check for expired subscriptions and update their status
    const now = new Date()
    const expiredSubscriptions = allSubscriptions.filter(sub => {
      if (sub.status !== 'active') return false
      if (!sub.expiryDate) return false // No expiry means still active
      return new Date(sub.expiryDate) <= now
    })

    // Update expired subscriptions to 'expired' status
    if (expiredSubscriptions.length > 0) {
      console.log('[DEBUG API] POST /api/subscriptions - Found expired subscriptions, updating status:', {
        count: expiredSubscriptions.length,
        ids: expiredSubscriptions.map(sub => sub.id),
      })
      
      for (const expiredSub of expiredSubscriptions) {
        await db
          .update(serviceSubscriptions)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(serviceSubscriptions.id, expiredSub.id))
        // Update the in-memory array as well
        expiredSub.status = 'expired'
      }
    }

    // Now check for truly active subscriptions (not expired)
    const activeSubscriptions = allSubscriptions.filter(sub => {
      if (sub.status !== 'active') return false
      if (!sub.expiryDate) return true // No expiry date means it's still active
      return new Date(sub.expiryDate) > now
    })

    console.log('[DEBUG API] POST /api/subscriptions - Active subscription check:', {
      now: now.toISOString(),
      activeSubscriptions: activeSubscriptions.map(sub => ({
        id: sub.id,
        status: sub.status,
        expiryDate: sub.expiryDate,
      })),
    })

    if (activeSubscriptions.length > 0) {
      console.log('[DEBUG API] POST /api/subscriptions - Already has active subscription, returning 400')
      return NextResponse.json(
        { error: "Facility already has an active subscription for this service" },
        { status: 400 }
      )
    }

    // Calculate expiry date (default: 30 days from now, or based on billing cycle)
    const startDate = new Date()
    const expiryDate = new Date()
    if (billingCycle === 'annual') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1)
    } else {
      expiryDate.setDate(expiryDate.getDate() + 30) // Default 30 days
    }

    const subscription = await db.insert(serviceSubscriptions).values({
      id: crypto.randomUUID(),
      facilityId,
      serviceName,
      status: 'active',
      planType: planType || null,
      startDate,
      expiryDate,
      autoRenew: false,
      paymentMethod: paymentMethod || null,
      amount: amount ? String(amount) : null,
      billingCycle: billingCycle || null,
    })

    return NextResponse.json(
      { 
        success: true, 
        message: `Successfully subscribed to ${serviceName}`,
        subscription: {
          serviceName,
          status: 'active',
          expiryDate,
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    )
  }
}

