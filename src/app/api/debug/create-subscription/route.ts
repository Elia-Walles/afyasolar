import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { serviceSubscriptions } from "@/lib/db/schema"
import { generateId } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    // This endpoint is for local debugging only and should not be available in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: "Facility ID required" }, { status: 400 })
    }

    const body = await request.json()
    const { serviceName } = body

    if (!serviceName) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 })
    }

    // Create a test subscription
    const newSubscription = await db
      .insert(serviceSubscriptions)
      .values({
        id: generateId(),
        facilityId,
        serviceName,
        status: 'active',
        planType: 'basic',
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        autoRenew: false,
        amount: '0.00',
        billingCycle: 'annual'
      })
      .$returningId()

    return NextResponse.json({
      success: true,
      data: newSubscription[0]
    })
  } catch (error: any) {
    console.error("Error creating subscription:", error)
    return NextResponse.json(
      { error: "Failed to create subscription", details: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
