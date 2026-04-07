import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarSubscribers } from '@/lib/db/afyasolar-subscribers-schema'
import { eq } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/afyasolar/subscribers/sync-existing-simple
 * Simplified sync endpoint for existing Afya Solar subscriptions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { facilityId } = await request.json()

    if (!facilityId) {
      return NextResponse.json({ error: 'facilityId is required' }, { status: 400 })
    }

    // Get existing service subscriptions for this facility
    const subscriptionsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/subscriptions?facilityId=${facilityId}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    })

    if (!subscriptionsResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    const subscriptionsData = await subscriptionsResponse.json()
    const subscriptions = subscriptionsData.data || []

    // Find active Afya Solar subscription
    const afyaSolarSubscription = subscriptions.find((sub: any) => 
      sub.serviceName === 'afya-solar' && 
      (sub.status === 'active' || sub.isActive === true) &&
      (!sub.expiryDate || new Date(sub.expiryDate) > new Date())
    )

    if (!afyaSolarSubscription) {
      return NextResponse.json({ error: 'No active Afya Solar subscription found' }, { status: 404 })
    }

    // Check if subscriber already exists
    const existingSubscriber = await db
      .select()
      .from(afyaSolarSubscribers)
      .where(eq(afyaSolarSubscribers.facilityId, facilityId))
      .limit(1)

    if (existingSubscriber.length > 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Subscriber already exists in new table' 
      }, { status: 409 })
    }

    // Get facility information
    const facilityResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/facility/${facilityId}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    })

    let facilityInfo = null
    if (facilityResponse.ok) {
      facilityInfo = await facilityResponse.json()
    }

    // Create minimal subscriber record
    const [newSubscriber] = await db.insert(afyaSolarSubscribers).values({
      facilityId: facilityId,
      facilityName: facilityInfo?.data?.name || 'Unknown Facility',
      facilityEmail: facilityInfo?.data?.email || '',
      facilityPhone: facilityInfo?.data?.phone || '',
      facilityRegion: facilityInfo?.data?.region || '',
      facilityCity: facilityInfo?.data?.city || '',
      packageId: 'PKG_10KW',
      packageName: '10 kW System',
      packageCode: 'PKG_10KW',
      packageRatedKw: '10.00',
      planType: 'PAAS',
      totalPackagePrice: 14900000,
      paymentMethod: 'INVOICE',
      subscriptionStatus: 'active',
      isActive: 1,
      subscriptionStartDate: afyaSolarSubscription.startDate ? new Date(afyaSolarSubscription.startDate) : new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingCycle: 'monthly',
      gracePeriodDays: 7,
      contractStatus: 'active',
      minimumTermMonths: 12,
      autoRenew: 1,
      installationStatus: 'completed',
      installationDate: afyaSolarSubscription.startDate ? new Date(afyaSolarSubscription.startDate) : new Date(),
      systemStatus: 'active',
      systemHealth: 'optimal',
      paymentHistory: [],
      bills: [],
      metadata: {
        createdBy: session.user.email,
        source: 'sync-existing-simple',
        originalSubscriptionId: afyaSolarSubscription.id,
        syncedAt: new Date().toISOString()
      },
      notes: `Synced from existing subscription (${afyaSolarSubscription.id})`,
      adminNotes: 'Automatically synced from service_subscriptions table'
    })

    return NextResponse.json({
      success: true,
      data: {
        subscriber: {
          id: newSubscriber.insertId,
          facilityId,
          packageName: '10 kW System',
          planType: 'PAAS',
          subscriptionStatus: 'active'
        }
      },
      message: 'Existing Afya Solar subscription synced to new table'
    })

  } catch (error) {
    console.error('Error syncing Afya Solar subscription:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
