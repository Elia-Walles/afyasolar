import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities, facilityReferrals, districts } from '@/lib/db/schema'
import { sendFacilityInvitationEmail } from '@/lib/email'
import { facilitySchema } from '@/lib/validations'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { generateReferralCode } from '@/lib/referral'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const referrerFacilityId = session.user.facilityId
    if (!referrerFacilityId) {
      return NextResponse.json({ error: 'Facility ID not found' }, { status: 400 })
    }

    // Get referrer facility details
    const [referrerFacility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, referrerFacilityId))
      .limit(1)

    if (!referrerFacility) {
      return NextResponse.json({ error: 'Referrer facility not found' }, { status: 404 })
    }

    // Ensure referrer facility has a referral code
    let referralCode = referrerFacility.referralCode
    if (!referralCode) {
      // Generate referral code if doesn't exist
      referralCode = generateReferralCode()
      await db
        .update(facilities)
        .set({ referralCode })
        .where(eq(facilities.id, referrerFacilityId))
    }

    const body = await request.json()
    
    // Validate facility data (without password)
    const { email, name, address, city, region, phone, regionId, districtId, paymentModel } = facilitySchema
      .omit({ password: true })
      .parse(body)

    // Check if facility with this email already exists
    const existingFacility = await db
      .select()
      .from(facilities)
      .where(eq(facilities.email, email))
      .limit(1)

    if (existingFacility.length > 0) {
      return NextResponse.json(
        { error: 'A facility with this email already exists' },
        { status: 400 }
      )
    }

    // Get district name if districtId is provided (use as city)
    let cityValue = city || region // Fallback to region if no city/district
    if (districtId) {
      const [district] = await db
        .select({ name: districts.name })
        .from(districts)
        .where(eq(districts.id, districtId))
        .limit(1)
      
      if (district) {
        cityValue = district.name
      }
    }

    // Generate invitation token
    const invitationToken = randomUUID()
    const invitationExpires = new Date()
    invitationExpires.setDate(invitationExpires.getDate() + 7) // 7 days expiry

    // Create a temporary password (will be changed when facility accepts invitation)
    const tempPassword = randomUUID()
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    const facilityId = randomUUID()
    
    const facilityValues: any = {
      id: facilityId,
      name,
      address: address || '',
      city: cityValue, // Use district name or provided city
      region,
      phone,
      email,
      password: hashedPassword,
      emailVerified: false,
      status: 'inactive',
      invitationToken,
      invitationExpires,
      referredBy: referrerFacilityId, // Track who referred this facility
      creditBalance: '0.00',
      monthlyConsumption: '0.00',
    }

    // Add optional fields
    if (regionId !== undefined && regionId !== null) {
      facilityValues.regionId = regionId
    }
    if (districtId !== undefined && districtId !== null) {
      facilityValues.districtId = districtId
    }
    if (paymentModel) {
      facilityValues.paymentModel = paymentModel
    }

    await db.insert(facilities).values(facilityValues)

    // Create referral record
    const referralId = randomUUID()
    await db.insert(facilityReferrals).values({
      id: referralId,
      referrerFacilityId,
      referredFacilityId: facilityId,
      referralCode,
      status: 'pending',
      benefitApproved: false,
    })

    // Send invitation email with referral information
    const emailSent = await sendFacilityInvitationEmail({
      to: email,
      facilityName: name,
      invitationToken,
      referrerFacilityName: referrerFacility.name,
      referralCode,
    })

    if (!emailSent) {
      console.error('Failed to send referral invitation email for facility:', facilityId)
      return NextResponse.json(
        {
          success: true,
          message: 'Referral invitation created, but email sending failed. Please try resending the invitation.',
          facilityId,
          referralCode,
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Referral invitation sent successfully',
        facilityId,
        referralCode,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating referral invitation:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to send referral invitation' },
      { status: 500 }
    )
  }
}
