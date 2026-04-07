import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, admins } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { validatePassword } from '@/lib/password-validation'
import { z } from 'zod'

const completeRegistrationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

/**
 * POST /api/users/complete-registration
 * Complete admin registration by setting password and sending verification email
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
    const validationResult = completeRegistrationSchema.safeParse(body)

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

    // First check admins table for admin invitations. Select only existing columns to avoid password reset fields.
    const [admin] = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        emailVerified: admins.emailVerified,
        emailVerificationToken: admins.emailVerificationToken,
        emailVerificationExpires: admins.emailVerificationExpires,
        tokenUsed: admins.tokenUsed,
      })
      .from(admins)
      .where(
        and(
          eq(admins.emailVerificationToken, token),
          isNotNull(admins.emailVerificationToken)
        )
      )
      .limit(1)

    // If found in admins, handle admin registration
    if (admin) {
      // Check if token already used (single-use enforcement)
      if (admin.tokenUsed) {
        await logAudit({
          userId: admin.id,
          action: 'complete_registration_failed',
          resource: 'admin',
          details: { reason: 'Token already used', email: admin.email, userAgent: request.headers.get('user-agent') || undefined },
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
      if (admin.emailVerificationExpires && new Date() > admin.emailVerificationExpires) {
        await logAudit({
          userId: admin.id,
          action: 'complete_registration_failed',
          resource: 'admin',
          details: { reason: 'Token expired', email: admin.email, userAgent: request.headers.get('user-agent') || undefined },
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
      if (admin.emailVerified) {
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
      verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

      // Update admin with new password, verification token, and mark invitation token as used
      await db
        .update(admins)
        .set({
          password: hashedPassword,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          tokenUsed: true, // Mark invitation token as used (single-use enforcement)
          failedLoginAttempts: 0, // Reset failed attempts
        })
        .where(eq(admins.id, admin.id))

      // Send verification email
      try {
        await sendVerificationEmail({
          to: admin.email,
          name: admin.name,
          verificationToken,
        })
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Continue even if email fails - admin can request resend
      }

      await logAudit({
        userId: admin.id,
        action: 'registration_completed',
        resource: 'admin',
        resourceId: admin.id,
        details: { email: admin.email, userAgent: request.headers.get('user-agent') || undefined },
        ipAddress: clientId,
        success: true,
      })

      return NextResponse.json({
        success: true,
        message: 'Password set. Check your email to verify.',
        requiresVerification: true,
      })
    }

    // If not found in admins, check users table. Select explicit columns to avoid missing password reset fields in prod DB.
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
        tokenUsed: users.tokenUsed,
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
        action: 'complete_registration_failed',
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
        action: 'complete_registration_failed',
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
        action: 'complete_registration_failed',
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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate new verification token for email verification
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date()
    verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

    // Update user with new password, verification token, and mark invitation token as used
    await db
      .update(users)
      .set({
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        tokenUsed: true, // Mark invitation token as used (single-use enforcement)
        failedLoginAttempts: 0, // Reset failed attempts
      })
      .where(eq(users.id, user.id))

    // Send verification email
    try {
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationToken,
      })
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Continue even if email fails - user can request resend
    }

    await logAudit({
      userId: user.id,
      action: 'registration_completed',
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role, userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Password set. Check your email to verify.',
      requiresVerification: true,
    })
  } catch (error) {
    await logAudit({
      action: 'complete_registration_failed',
      resource: 'user',
      details: { error: error instanceof Error ? error.message : 'Unknown error', userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error completing registration:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

