import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, admins } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { sendAdminInvitationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { z } from 'zod'

const resendInvitationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

/**
 * POST /api/users/resend-invitation
 * Resend invitation to a pending user or admin (admin only)
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 5 })
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = resendInvitationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request' 
      }, { status: 400 })
    }

    const { userId } = validationResult.data

    // First check admins table
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, userId))
      .limit(1)

    if (admin) {
      if (admin.emailVerified) {
        return NextResponse.json({ 
          error: 'Admin already registered' 
        }, { status: 400 })
      }

      // Check invitation count limit (max 3 per day)
      if ((admin.invitationCount || 0) >= 3) {
        return NextResponse.json({ 
          error: 'Maximum resend limit reached' 
        }, { status: 400 })
      }

      // Generate new invitation token
      const invitationToken = randomBytes(32).toString('hex')
      const invitationExpires = new Date()
      invitationExpires.setHours(invitationExpires.getHours() + 24)

      // Update admin with new token
      await db
        .update(admins)
        .set({
          emailVerificationToken: invitationToken,
          emailVerificationExpires: invitationExpires,
          invitationSentAt: new Date(),
          invitationCount: (admin.invitationCount || 0) + 1,
          tokenUsed: false,
        })
        .where(eq(admins.id, userId))

      // Send invitation email
      try {
        await sendAdminInvitationEmail({
          to: admin.email,
          name: admin.name,
          invitationToken,
        })
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError)
      }

      await logAudit({
        userId: session.user.id,
        action: 'admin_invitation_resent',
        resource: 'admin',
        resourceId: userId,
        details: { email: admin.email, userAgent: request.headers.get('user-agent') || undefined },
        ipAddress: clientId,
        success: true,
      })

      return NextResponse.json({
        success: true,
        message: 'Invitation resent',
      })
    }

    // If not found in admins, check users table
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ 
        error: 'User already registered' 
      }, { status: 400 })
    }

    // Check invitation count limit (max 3 per day)
    if ((user.invitationCount || 0) >= 3) {
      return NextResponse.json({ 
        error: 'Maximum resend limit reached' 
      }, { status: 400 })
    }

    // Generate new invitation token
    const invitationToken = randomBytes(32).toString('hex')
    const invitationExpires = new Date()
    invitationExpires.setHours(invitationExpires.getHours() + 24)

    // Update user with new token
    await db
      .update(users)
      .set({
        emailVerificationToken: invitationToken,
        emailVerificationExpires: invitationExpires,
        invitationSentAt: new Date(),
        invitationCount: (user.invitationCount || 0) + 1,
        tokenUsed: false,
      })
      .where(eq(users.id, userId))

    // Send invitation email
    try {
      await sendAdminInvitationEmail({
        to: user.email,
        name: user.name,
        invitationToken,
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
    }

    await logAudit({
      userId: session.user.id,
      action: 'admin_invitation_resent',
      resource: 'user',
      resourceId: userId,
      details: { email: user.email, userAgent: request.headers.get('user-agent') || undefined },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation resent',
    })
  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

