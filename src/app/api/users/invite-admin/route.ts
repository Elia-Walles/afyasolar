import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { admins } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID, randomBytes } from 'crypto'
import { sendAdminInvitationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { z } from 'zod'

const inviteAdminSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
})

/**
 * POST /api/users/invite-admin
 * Invite a new admin (admin only)
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
    const validationResult = inviteAdminSchema.safeParse(body)

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

    const { name, email } = validationResult.data

    // Generate invitation token (24 hours expiration)
    const invitationToken = randomBytes(32).toString('hex')
    const invitationExpires = new Date()
    invitationExpires.setHours(invitationExpires.getHours() + 24)

    // Create temporary password (user will set their own password during registration)
    const tempPassword = randomBytes(16).toString('hex')
    const hashedTempPassword = await (await import('bcryptjs')).default.hash(tempPassword, 10)

    // Check if admin already exists (might be pending invitation)
    const existing = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email))
      .limit(1)

    let adminId: string
    const now = new Date()

    if (existing[0]) {
      // Check if admin is already verified
      if (existing[0].emailVerified) {
        return NextResponse.json({ 
          error: 'Admin already registered' 
        }, { status: 409 })
      }
      // Admin exists but not verified - resend invitation
      adminId = existing[0].id
      await db
        .update(admins)
        .set({
          emailVerificationToken: invitationToken,
          emailVerificationExpires: invitationExpires,
          invitationSentAt: now,
          invitationCount: (existing[0].invitationCount || 0) + 1,
          tokenUsed: false,
        })
        .where(eq(admins.id, adminId))
    } else {
      // Create new admin in admins table with invitation token
      adminId = randomUUID()
      await db.insert(admins).values({
        id: adminId,
        email: email.trim(),
        name: name.trim(),
        password: hashedTempPassword,
        emailVerified: false,
        emailVerificationToken: invitationToken,
        emailVerificationExpires: invitationExpires,
        invitationSentAt: now,
        invitationCount: 1,
        tokenUsed: false,
      })
    }

    // Send invitation email
    try {
      await sendAdminInvitationEmail({
        to: email.trim(),
        name: name.trim(),
        invitationToken,
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Continue even if email fails - admin can resend invitation
    }

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: 'admin_invited',
      resource: 'admin',
      resourceId: adminId,
      details: { email: email.trim(), name: name.trim(), userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json(
      { 
        success: true,
        message: 'Admin invitation sent successfully',
        data: {
          id: adminId,
          email: email.trim(),
          name: name.trim(),
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
      action: 'admin_invited',
      resource: 'admin',
      details: { error: error instanceof Error ? error.message : 'Unknown error', userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: getClientIdentifier(request),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    console.error('Error inviting admin:', error)
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}

