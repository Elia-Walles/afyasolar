import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, technicians, regions, districts } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { validatePassword } from '@/lib/password-validation'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

const completeTechnicianRegistrationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  yearsExperience: z.number().int().min(0).optional(),
  practicingLicense: z.string().optional(),
  shortBio: z.string().optional(),
  regionId: z.number().optional(),
  districtId: z.number().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

/**
 * POST /api/technicians/complete-registration
 * Complete technician registration by setting password and all details
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
    const body = await request.json()
    const validationResult = completeTechnicianRegistrationSchema.safeParse(body)

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

    const { token, password, firstName, lastName, phone, yearsExperience, practicingLicense, shortBio, regionId, districtId } = validationResult.data

    // Validate password strength
    const passwordValidation = validatePassword(password, {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      minStrength: 2,
      userInputs: [],
    })

    if (!passwordValidation.isValid) {
      return NextResponse.json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      }, { status: 400 })
    }

    // Find user with this invitation token
    // Explicitly select only needed columns to avoid issues with missing password_reset columns
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        password: users.password,
        role: users.role,
        facilityId: users.facilityId,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
        tokenUsed: users.tokenUsed,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.emailVerificationToken, token),
          isNotNull(users.emailVerificationToken),
          eq(users.role, 'technician')
        )
      )
      .limit(1)

    if (!user) {
      await logAudit({
        action: 'complete_technician_registration_failed',
        resource: 'technician',
        details: { reason: 'Invalid token', userAgent: request.headers.get('user-agent') || undefined },
        ipAddress: clientId,
        success: false,
        error: 'Invalid invitation token',
      })

      return NextResponse.json({ 
        error: 'Invalid token' 
      }, { status: 400 })
    }

    // Check if token already used
    if (user.tokenUsed) {
      await logAudit({
        userId: user.id,
        action: 'complete_technician_registration_failed',
        resource: 'technician',
        details: { reason: 'Token already used', email: user.email, userAgent: request.headers.get('user-agent') || undefined },
        ipAddress: clientId,
        success: false,
        error: 'Token already used',
      })

      return NextResponse.json({ 
        error: 'This invitation link has already been used',
        message: 'Please request a new invitation.',
      }, { status: 400 })
    }

    // Check if token expired
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      await logAudit({
        userId: user.id,
        action: 'complete_technician_registration_failed',
        resource: 'technician',
        details: { reason: 'Token expired', email: user.email, userAgent: request.headers.get('user-agent') || undefined },
        ipAddress: clientId,
        success: false,
        error: 'Invitation token expired',
      })

      return NextResponse.json({ 
        error: 'Token expired',
        message: 'Request a new invitation.',
      }, { status: 400 })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({ 
        error: 'Already registered',
        message: 'Sign in to continue.',
      }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate new verification token for email verification
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date()
    verificationExpires.setHours(verificationExpires.getHours() + 24)

    const fullName = `${firstName.trim()} ${lastName.trim()}`

    // Update user with new password, name, and verification token
    await db
      .update(users)
      .set({
        name: fullName,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        tokenUsed: true,
        failedLoginAttempts: 0,
      })
      .where(eq(users.id, user.id))

    // Update or create technician record (use user.id as technician.id for linking)
    const [existingTechnician] = await db
      .select()
      .from(technicians)
      .where(eq(technicians.email, user.email))
      .limit(1)

    if (existingTechnician) {
      // Update existing technician record (keep existing ID)
      await db
        .update(technicians)
        .set({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone?.trim() || null,
          yearsExperience: yearsExperience || 0,
          practicingLicense: practicingLicense?.trim() || null,
          shortBio: shortBio?.trim() || null,
          regionId: regionId ?? null,
          districtId: districtId ?? null,
          status: 'active',
        })
        .where(eq(technicians.id, existingTechnician.id))
    } else {
      // Create new technician record (use user.id for linking)
      await db.insert(technicians).values({
        id: user.id, // Use same ID as user for linking
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: user.email,
        phone: phone?.trim() || null,
        yearsExperience: yearsExperience || 0,
        practicingLicense: practicingLicense?.trim() || null,
        shortBio: shortBio?.trim() || null,
        regionId: regionId ?? null,
        districtId: districtId ?? null,
        status: 'active',
      })
    }

    // Send verification email
    try {
      await sendVerificationEmail({
        to: user.email,
        name: fullName,
        verificationToken,
      })
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
    }

    await logAudit({
      userId: user.id,
      action: 'technician_registration_completed',
      resource: 'technician',
      resourceId: user.id,
      details: { email: user.email, userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Registration complete. Check your email to verify.',
      requiresVerification: true,
    })
  } catch (error) {
    await logAudit({
      action: 'complete_technician_registration_failed',
      resource: 'technician',
      details: { error: error instanceof Error ? error.message : 'Unknown error', userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error completing technician registration:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

