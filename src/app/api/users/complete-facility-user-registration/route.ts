import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { validatePassword } from '@/lib/password-validation'
import { z } from 'zod'

const completeFacilityUserRegistrationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

/**
 * POST /api/users/complete-facility-user-registration
 * Complete facility user registration by setting password and marking as verified
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
    const validationResult = completeFacilityUserRegistrationSchema.safeParse(body)

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

    const { token, password } = validationResult.data

    // Validate password strength
    const passwordValidation = validatePassword(password, {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      minStrength: 2,
      userInputs: [], // Could add email/name here
    })

    if (!passwordValidation.isValid) {
      return NextResponse.json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      }, { status: 400 })
    }

    // Check users table for invitation
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        facilityId: users.facilityId,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
        tokenUsed: users.tokenUsed,
        subRole: users.subRole,
        department: users.department,
      })
      .from(users)
      .where(
        and(
          eq(users.emailVerificationToken, token),
          isNotNull(users.emailVerificationToken)
        )
      )
      .limit(1)

    if (!user) {
      await logAudit({
        action: 'complete_facility_user_registration_failed',
        resource: 'user',
        details: { reason: 'Invalid token', userAgent: request.headers.get('user-agent') || undefined },
        ipAddress: clientId,
        success: false,
        error: 'Invalid invitation token',
      })

      return NextResponse.json({ 
        error: 'Invalid token' 
      }, { status: 400 })
    }

    // Check if token already used (single-use enforcement)
    if (user.tokenUsed) {
      await logAudit({
        userId: user.id,
        action: 'complete_facility_user_registration_failed',
        resource: 'user',
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
        action: 'complete_facility_user_registration_failed',
        resource: 'user',
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

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user with new password, mark as verified, and mark invitation token as used
    await db
      .update(users)
      .set({
        password: hashedPassword,
        emailVerified: true,
        emailVerificationToken: null, // Clear the token
        emailVerificationExpires: null, // Clear expiration
        tokenUsed: true, // Mark invitation token as used (single-use enforcement)
        failedLoginAttempts: 0, // Reset failed attempts
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    // No need to send verification email since this is an invitation completion
    // The user can now log in directly

    await logAudit({
      userId: user.id,
      action: 'facility_user_registration_completed',
      resource: 'user',
      resourceId: user.id,
      details: { 
        email: user.email, 
        name: user.name,
        role: user.subRole || 'facility',
        facilityId: user.facilityId,
        department: user.department,
        userAgent: request.headers.get('user-agent') || undefined 
      },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Registration complete! You can now log in to Afya Solar.',
      requiresVerification: false, // No additional verification needed
    })
  } catch (error) {
    await logAudit({
      action: 'complete_facility_user_registration_failed',
      resource: 'user',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: request.headers.get('user-agent') || undefined 
      },
      ipAddress: getClientIdentifier(request),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error completing facility user registration:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
