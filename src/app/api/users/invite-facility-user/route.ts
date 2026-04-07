import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, facilities } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes } from 'crypto'
import { sendFacilityUserInvitationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { isAfyaFinanceReadOnlySubRole } from '@/lib/auth/afya-finance-rbac'

const inviteFacilityUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  role: z.enum([
    'store-manager',
    'pharmacy-manager',
    'nurse',
    'doctor',
    'general-manager',
    'branch-manager',
    'chief-executive-officer',
    'finance-and-administration-officer',
  ]),
  department: z.string().optional(),
  facilityId: z.string().uuid('Invalid facility ID'),
})

/**
 * POST /api/users/invite-facility-user
 * Invite a new facility user (facility admin only)
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 5 })
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
        }
      }
    )
  }

  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'facility' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role === 'facility') {
      const subRole = (session.user as any).subRole as string | undefined
      if (isAfyaFinanceReadOnlySubRole(subRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    console.log('Received invitation request body:', body)
    
    // If user is facility role, they can only invite users to their own facility
    if (session.user.role === 'facility' && session.user.facilityId) {
      body.facilityId = session.user.facilityId
    }
    
    const validationResult = inviteFacilityUserSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: errors,
      }, { status: 400 })
    }

    const { name, email, phone, role, department, facilityId } = validationResult.data

    // Normalize email and phone
    const normalizedEmail = email.toLowerCase().trim()
    const normalizedPhone = phone.replace(/\s/g, '')

    // Check if user already exists
    console.log('Checking if user exists:', normalizedEmail)
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    console.log('Existing user check result:', existing[0] ? 'User exists' : 'User does not exist')

    if (existing[0]) {
      // Check if user is already verified and part of the same facility
      if (existing[0].emailVerified && existing[0].facilityId === facilityId) {
        return NextResponse.json({ 
          error: 'User already exists in this facility' 
        }, { status: 409 })
      }
      // User exists but not verified or different facility - allow new invitation
    }

    // Generate invitation token (24 hours expiration)
    const invitationToken = randomBytes(32).toString('hex')
    const invitationExpires = new Date()
    invitationExpires.setHours(invitationExpires.getHours() + 24)

    // Create temporary password (user will set their own password during registration)
    const tempPassword = randomBytes(16).toString('hex')
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10)

    let userId: string
    const now = new Date()

    if (existing[0]) {
      // User exists but not verified or different facility - update with new invitation
      userId = existing[0].id
      console.log('Updating existing user with new invitation:', userId)
      await db
        .update(users)
        .set({
          name: name.trim(),
          phone: normalizedPhone,
          role: 'facility', // Set to 'facility' for authentication
          facilityId: facilityId,
          emailVerified: false, // Reset to false for new invitation
          emailVerificationToken: invitationToken,
          emailVerificationExpires: invitationExpires,
          invitationSentAt: now,
          invitationCount: (existing[0].invitationCount || 0) + 1,
          tokenUsed: false,
          // Store sub-role and department in temporary fields or as JSON
          subRole: role,
          department: department || null,
        })
        .where(eq(users.id, userId))
      console.log('Successfully updated existing user')
    } else {
      // Create new user in users table with invitation token
      userId = randomUUID()
      console.log('Creating new user with invitation:', userId)
      await db.insert(users).values({
        id: userId,
        email: normalizedEmail,
        name: name.trim(),
        phone: normalizedPhone,
        password: hashedTempPassword,
        role: 'facility', // Set to 'facility' for authentication
        facilityId: facilityId,
        emailVerified: false,
        emailVerificationToken: invitationToken,
        emailVerificationExpires: invitationExpires,
        invitationSentAt: now,
        invitationCount: 1,
        tokenUsed: false,
        // Store sub-role and department
        subRole: role,
        department: department || null,
      })
      console.log('Successfully created new user')
    }

    // Get facility name for both email and SMS
    const facilityName = await getFacilityName(facilityId)
    console.log('Facility name retrieved:', facilityName)

    // Send invitation email
    try {
      console.log('Attempting to send invitation email to:', normalizedEmail)
      
      await sendFacilityUserInvitationEmail({
        to: normalizedEmail,
        name: name.trim(),
        invitationToken,
        role: role.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        facilityName: facilityName,
      })
      console.log('Invitation email sent successfully')
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      console.error('Email error details:', {
        message: emailError instanceof Error ? emailError.message : 'Unknown error',
        stack: emailError instanceof Error ? emailError.stack : undefined
      })
      // Continue even if email fails - facility can resend invitation
    }

    // Send SMS notification
    try {
      const { sendUserInvitationSMS } = await import('@/lib/sms')
      
      if (phone) {
        await sendUserInvitationSMS(phone, {
          inviterName: session.user.name || 'Administrator',
          facilityName,
          role: role.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        })
        console.log('Invitation SMS sent successfully')
      }
    } catch (smsError) {
      console.error('Failed to send invitation SMS:', smsError)
      // Continue even if SMS fails - email was sent
    }

    // Audit log
    try {
      console.log('Creating audit log entry')
      await logAudit({
        userId: session.user.id,
        action: 'facility_user_invited',
        resource: 'user',
        resourceId: userId,
        details: { 
          email: normalizedEmail, 
          name: name.trim(), 
          role,
          department,
          facilityId,
          userAgent: request.headers.get('user-agent') || undefined 
        },
        ipAddress: clientId,
        success: true,
      })
      console.log('Audit log entry created successfully')
    } catch (auditError) {
      console.error('Failed to create audit log entry:', auditError)
      // Continue even if audit log fails
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Invitation sent successfully',
        data: {
          id: userId,
          email: normalizedEmail,
          name: name.trim(),
          role,
          department,
        }
      },
      { 
        status: 201,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        }
      }
    )
  } catch (error) {
    console.error('Error in invite facility user API:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    const session = await getServerSession(authOptions)
    await logAudit({
      userId: session?.user?.id,
      action: 'facility_user_invited',
      resource: 'user',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: request.headers.get('user-agent') || undefined 
      },
      ipAddress: getClientIdentifier(request),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error inviting facility user:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Helper function to get facility name
 */
async function getFacilityName(facilityId: string): Promise<string> {
  try {
    const [facility] = await db
      .select({ name: facilities.name })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)
    
    return facility?.name || 'Your Facility'
  } catch (error) {
    console.error('Error fetching facility name:', error)
    return 'Your Facility'
  }
}
