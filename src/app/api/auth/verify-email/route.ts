import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, admins } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'

/**
 * GET /api/auth/verify-email?token=...
 * Verify email address using token
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 10 })
  
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
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 })
    }

    // Try admins table first (select only columns present in production DB)
    const [admin] = await db
      .select({
        id: admins.id,
        email: admins.email,
        emailVerified: admins.emailVerified,
        emailVerificationToken: admins.emailVerificationToken,
        emailVerificationExpires: admins.emailVerificationExpires,
      })
      .from(admins)
      .where(
        and(
          eq(admins.emailVerificationToken, token),
          isNotNull(admins.emailVerificationToken)
        )
      )
      .limit(1)

    if (admin) {
      // Check if already verified
      if (admin.emailVerified) {
        return NextResponse.json({ 
          error: 'Email already verified',
          message: 'Your email has already been verified. You can sign in now.',
        }, { status: 400 })
      }

      // Check if token expired
      if (admin.emailVerificationExpires && new Date() > admin.emailVerificationExpires) {
        await logAudit({
          userId: admin.id,
          action: 'email_verification_failed',
          resource: 'admin',
          details: { reason: 'Token expired', email: admin.email },
          ipAddress: clientId,
          userAgent: request.headers.get('user-agent') || undefined,
          success: false,
          error: 'Verification token expired',
        })

        return NextResponse.json({ 
          error: 'Verification token has expired',
          message: 'Please request a new verification email.',
        }, { status: 400 })
      }

      // Verify the email
      await db
        .update(admins)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        })
        .where(eq(admins.id, admin.id))

      await logAudit({
        userId: admin.id,
        action: 'email_verified',
        resource: 'admin',
        resourceId: admin.id,
        details: { email: admin.email },
        ipAddress: clientId,
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      })

      return NextResponse.json({
        success: true,
        message: 'Email verified successfully! You can now sign in.',
      })
    }

    // Try users table (for technicians/onboarding) with explicit columns
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        emailVerificationToken: users.emailVerificationToken,
        emailVerificationExpires: users.emailVerificationExpires,
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
        action: 'email_verification_failed',
        resource: 'user',
        details: { reason: 'Invalid token' },
        ipAddress: clientId,
        userAgent: request.headers.get('user-agent') || undefined,
        success: false,
        error: 'Invalid verification token',
      })

      return NextResponse.json({ 
        error: 'Invalid or expired verification token' 
      }, { status: 400 })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({ 
        error: 'Email already verified',
        message: 'Your email has already been verified. You can sign in now.',
      }, { status: 400 })
    }

    // Check if token expired
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      await logAudit({
        userId: user.id,
        action: 'email_verification_failed',
        resource: 'user',
        details: { reason: 'Token expired', email: user.email },
        ipAddress: clientId,
        userAgent: request.headers.get('user-agent') || undefined,
        success: false,
        error: 'Verification token expired',
      })

      return NextResponse.json({ 
        error: 'Verification token has expired',
        message: 'Please request a new verification email.',
      }, { status: 400 })
    }

    // Verify the email
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      })
      .where(eq(users.id, user.id))

    await logAudit({
      userId: user.id,
      action: 'email_verified',
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: clientId,
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now sign in.',
    })
  } catch (error) {
    console.error('Error verifying email:', error)
    
    await logAudit({
      action: 'email_verification_failed',
      resource: 'user',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      ipAddress: clientId,
      userAgent: request.headers.get('user-agent') || undefined,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

/**
 * POST /api/auth/verify-email
 * Resend verification email
 */
export async function POST(request: NextRequest) {
  // Rate limiting (stricter for resend)
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 3 })
  
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
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Try admins table first (explicit columns)
    const [admin] = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        emailVerified: admins.emailVerified,
      })
      .from(admins)
      .where(eq(admins.email, normalizedEmail))
      .limit(1)

    if (admin) {
      // If already verified, don't send
      if (admin.emailVerified) {
        return NextResponse.json({
          success: true,
          message: 'This email is already verified. You can sign in now.',
        })
      }

      // Generate new verification token
      const { randomBytes } = await import('crypto')
      const verificationToken = randomBytes(32).toString('hex')
      const verificationExpires = new Date()
      verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

      // Update admin with new token
      await db
        .update(admins)
        .set({
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        })
        .where(eq(admins.id, admin.id))

      // Send verification email
      const { sendResendVerificationEmail } = await import('@/lib/email')
      try {
        await sendResendVerificationEmail({
          to: admin.email,
          name: admin.name,
          verificationToken,
        })
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        return NextResponse.json({
          error: 'Failed to send verification email. Please try again later.',
        }, { status: 500 })
      }

      await logAudit({
        userId: admin.id,
        action: 'verification_email_resent',
        resource: 'admin',
        resourceId: admin.id,
        details: { email: admin.email },
        ipAddress: clientId,
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      })

      return NextResponse.json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
      })
    }

    // Try users table (for technicians/onboarding) with explicit columns
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (!user) {
      // Don't reveal if user exists or not (security)
      return NextResponse.json({
        success: true,
        message: 'If an account with this email exists, a verification email has been sent.',
      })
    }

    // If already verified, don't send
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'This email is already verified. You can sign in now.',
      })
    }

    // Generate new verification token
    const { randomBytes } = await import('crypto')
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date()
    verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

    // Update user with new token
    await db
      .update(users)
      .set({
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      })
      .where(eq(users.id, user.id))

    // Send verification email
    const { sendResendVerificationEmail } = await import('@/lib/email')
    try {
      await sendResendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationToken,
      })
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      return NextResponse.json({
        error: 'Failed to send verification email. Please try again later.',
      }, { status: 500 })
    }

    await logAudit({
      userId: user.id,
      action: 'verification_email_resent',
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: clientId,
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    })
  } catch (error) {
    console.error('Error resending verification email:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

