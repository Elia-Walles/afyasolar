import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db, getRawConnection } from '@/lib/db'
import { technicians, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID, randomBytes } from 'crypto'
import { sendTechnicianInvitationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

export const dynamic = "force-dynamic"
export const revalidate = 0

const inviteTechnicianSchema = z.object({
  email: z.string().email('Invalid email address'),
})

/**
 * POST /api/technicians/invite
 * Invite a new technician (admin only, email only)
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

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = inviteTechnicianSchema.safeParse(body)

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

    const { email } = validationResult.data

    // Generate invitation token (24 hours expiration)
    const invitationToken = randomBytes(32).toString('hex')
    const invitationExpires = new Date()
    invitationExpires.setHours(invitationExpires.getHours() + 24)

    // Create temporary password (user will set their own password during registration)
    const tempPassword = randomBytes(16).toString('hex')
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10)

    // Check if user with this email already exists
    // Select only columns that exist in the database (exclude password_reset_token if it doesn't exist)
    const existingUser = await db
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
        failedLoginAttempts: users.failedLoginAttempts,
        accountLockedUntil: users.accountLockedUntil,
        lastLoginAt: users.lastLoginAt,
        invitationSentAt: users.invitationSentAt,
        invitationCount: users.invitationCount,
        tokenUsed: users.tokenUsed,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, email.trim()))
      .limit(1)

    if (existingUser.length > 0 && existingUser[0].emailVerified) {
      return NextResponse.json({ 
        error: 'User with this email already exists and is registered' 
      }, { status: 409 })
    }

    // Check if technician already exists
    const existingTechnician = await db
      .select()
      .from(technicians)
      .where(eq(technicians.email, email.trim()))
      .limit(1)

    let technicianId: string
    let userId: string
    const now = new Date()

    if (existingTechnician.length > 0) {
      technicianId = existingTechnician[0].id
    } else {
      // Create new technician record (minimal data, will be completed during registration)
      technicianId = randomUUID()
      await db.insert(technicians).values({
        id: technicianId,
        firstName: '', // Will be filled during registration
        lastName: '', // Will be filled during registration
        email: email.trim(),
        status: 'inactive', // Will be activated after registration
      })
    }

    // Create or update user record for authentication (similar to admin flow)
    if (existingUser.length > 0) {
      // Update existing user (pending invitation)
      userId = existingUser[0].id
      await db
        .update(users)
        .set({
          emailVerificationToken: invitationToken,
          emailVerificationExpires: invitationExpires,
          invitationSentAt: now,
          invitationCount: (existingUser[0].invitationCount || 0) + 1,
          tokenUsed: false,
          password: hashedTempPassword,
          role: 'technician',
        })
        .where(eq(users.id, userId))
    } else {
      // Create new user using raw SQL to avoid password_reset_token column that may not exist
      userId = randomUUID()
      const rawConnection = getRawConnection()
      const nowFormatted = now.toISOString().slice(0, 19).replace('T', ' ')
      const expiresFormatted = invitationExpires.toISOString().slice(0, 19).replace('T', ' ')
      
      await rawConnection.query(`
        INSERT INTO \`users\` (
          \`id\`, \`email\`, \`name\`, \`password\`, \`role\`, 
          \`email_verified\`, \`email_verification_token\`, \`email_verification_expires\`, 
          \`invitation_sent_at\`, \`invitation_count\`, \`token_used\`, 
          \`failed_login_attempts\`, \`created_at\`, \`updated_at\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        email.trim(),
        '', // name - will be filled during registration
        hashedTempPassword,
        'technician',
        false, // email_verified
        invitationToken,
        expiresFormatted,
        nowFormatted,
        1, // invitation_count
        false, // token_used
        0, // failed_login_attempts
        nowFormatted, // created_at
        nowFormatted, // updated_at
      ])
    }

    // Send invitation email
    try {
      await sendTechnicianInvitationEmail({
        to: email.trim(),
        invitationToken,
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Continue even if email fails - admin can resend invitation
    }

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: 'technician_invited',
      resource: 'technician',
      resourceId: technicianId,
      details: { email: email.trim(), userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json(
      { 
        success: true,
        message: 'Technician invitation sent successfully',
        data: {
          id: technicianId,
          email: email.trim(),
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
    const session = await getServerSession(authOptions)
    await logAudit({
      userId: session?.user?.id,
      action: 'technician_invited',
      resource: 'technician',
      details: { error: error instanceof Error ? error.message : 'Unknown error', userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: getClientIdentifier(request),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error inviting technician:', error)
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}

