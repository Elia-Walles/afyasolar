import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilityReferrals, facilities, serviceSubscriptions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get referral details
    const [referral] = await db
      .select()
      .from(facilityReferrals)
      .where(eq(facilityReferrals.id, id))
      .limit(1)

    if (!referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
    }

    if (referral.benefitApproved) {
      return NextResponse.json(
        { error: 'Benefit already approved for this referral' },
        { status: 400 }
      )
    }

    if (referral.status !== 'registered') {
      return NextResponse.json(
        { error: 'Can only approve benefits for registered facilities' },
        { status: 400 }
      )
    }

    // Update referral record
    await db
      .update(facilityReferrals)
      .set({
        benefitApproved: true,
        benefitApprovedBy: session.user.id,
        benefitApprovedAt: new Date(),
        status: 'benefit_applied',
      })
      .where(eq(facilityReferrals.id, id))

    // Update facility to mark benefit as applied
    await db
      .update(facilities)
      .set({
        referralBenefitApplied: true,
      })
      .where(eq(facilities.id, referral.referredFacilityId))

    // Create free Afya Booking subscription for next month
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0)

    // Check if subscription already exists
    const [existingSubscription] = await db
      .select()
      .from(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.facilityId, referral.referredFacilityId),
          eq(serviceSubscriptions.serviceName, 'afya-booking')
        )
      )
      .limit(1)

    if (existingSubscription) {
      // Update existing subscription to extend it
      await db
        .update(serviceSubscriptions)
        .set({
          status: 'active',
          startDate: nextMonth,
          expiryDate: endOfNextMonth,
          updatedAt: new Date(),
        })
        .where(eq(serviceSubscriptions.id, existingSubscription.id))
    } else {
      // Create new subscription
      await db.insert(serviceSubscriptions).values({
        id: randomUUID(),
        facilityId: referral.referredFacilityId,
        serviceName: 'afya-booking',
        status: 'active',
        startDate: nextMonth,
        expiryDate: endOfNextMonth,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Referral benefit approved successfully. Facility will receive free Afya Booking for next month.',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error approving referral benefit:', error)
    return NextResponse.json(
      { error: 'Failed to approve referral benefit' },
      { status: 500 }
    )
  }
}
