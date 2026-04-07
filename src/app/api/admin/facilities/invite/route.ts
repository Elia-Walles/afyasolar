import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities, districts } from '@/lib/db/schema'
import { sendFacilityInvitationEmail } from '@/lib/email'
import { facilitySchema } from '@/lib/validations'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Create facility with pending status
    const facilityId = randomUUID()
    
    const facilityValues: any = {
      id: facilityId,
      name,
      address: address || '', // Use empty string if address is not provided
      city: cityValue, // Use district name or provided city
      region,
      phone,
      email,
      password: hashedPassword, // Temporary password
      emailVerified: false, // Will be verified when they accept invitation
      status: 'inactive', // Will be activated when they complete registration
      invitationToken,
      invitationExpires,
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

    // Send invitation email
    const emailSent = await sendFacilityInvitationEmail({
      to: email,
      facilityName: name,
      invitationToken,
    })

    if (!emailSent) {
      // If email fails, we still created the facility, but log the error
      console.error('Failed to send invitation email for facility:', facilityId)
      return NextResponse.json(
        {
          success: true,
          message: 'Facility invitation created, but email sending failed. Please try resending the invitation.',
          facilityId,
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Invitation sent successfully',
        facilityId,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating facility invitation:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid facility data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create facility invitation' },
      { status: 500 }
    )
  }
}

