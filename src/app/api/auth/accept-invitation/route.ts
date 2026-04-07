import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { facilities, facilityReferrals } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password, referralCode, latitude, longitude } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Find facility with this invitation token
    const facility = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.invitationToken, token),
          gt(facilities.invitationExpires, new Date())
        )
      )
      .limit(1)

    if (facility.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    const facilityId = facility[0].id
    const updateData: any = {
      password: hashedPassword,
      invitationToken: null,
      invitationExpires: null,
      emailVerified: true,
      status: 'active',
    }

    // Apply location update if provided and valid
    const parsedLat = typeof latitude === 'string' ? parseFloat(latitude) : latitude
    const parsedLng = typeof longitude === 'string' ? parseFloat(longitude) : longitude

    if (
      typeof parsedLat === 'number' &&
      !Number.isNaN(parsedLat) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      typeof parsedLng === 'number' &&
      !Number.isNaN(parsedLng) &&
      parsedLng >= -180 &&
      parsedLng <= 180
    ) {
      updateData.latitude = parsedLat
      updateData.longitude = parsedLng
    }

    // Handle referral code if provided
    if (referralCode) {
      // Find the referrer facility by referral code
      const [referrerFacility] = await db
        .select()
        .from(facilities)
        .where(eq(facilities.referralCode, referralCode))
        .limit(1)

      if (referrerFacility && referrerFacility.id !== facilityId) {
        // Update facility with referral information
        updateData.referredBy = referrerFacility.id

        // Update referral record status
        await db
          .update(facilityReferrals)
          .set({
            status: 'registered',
          })
          .where(
            and(
              eq(facilityReferrals.referredFacilityId, facilityId),
              eq(facilityReferrals.referralCode, referralCode)
            )
          )
      }
    }

    // Update facility: set password, clear invitation token, activate account
    await db
      .update(facilities)
      .set(updateData)
      .where(eq(facilities.id, facilityId))

    return NextResponse.json({
      success: true,
      message: 'Registration completed successfully',
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    )
  }
}

