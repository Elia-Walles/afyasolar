import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { users, facilities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { sendFacilityUserInvitationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { z } from 'zod'
import { isAfyaFinanceReadOnlySubRole } from '@/lib/auth/afya-finance-rbac'

const resendFacilityUserInvitationSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

/**
 * POST /api/users/resend-facility-user-invitation
 * Resend invitation for a facility user when the token has expired (facility admin side)
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 5 })

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
        },
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
    const validationResult = resendFacilityUserInvitationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const { userId } = validationResult.data

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.role !== 'facility') {
      return NextResponse.json(
        { error: 'Only facility users can be resent from this endpoint' },
        { status: 400 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'User already registered' },
        { status: 400 }
      )
    }

    // If session user is facility, they may only manage users in their own facility
    if (session.user.role === 'facility') {
      if (!session.user.facilityId || !user.facilityId || session.user.facilityId !== user.facilityId) {
        return NextResponse.json(
          { error: 'Unauthorized to manage this user' },
          { status: 403 }
        )
      }
    }

    // Ensure the previous invitation token has expired before allowing resend
    const now = new Date()
    if (!user.emailVerificationExpires || user.emailVerificationExpires > now) {
      return NextResponse.json(
        { error: 'Invitation has not expired yet' },
        { status: 400 }
      )
    }

    // Check invitation count limit (max 10 resends)
    if ((user.invitationCount || 0) >= 10) {
      return NextResponse.json(
        { error: 'Maximum resend limit reached' },
        { status: 400 }
      )
    }

    // Generate new invitation token (24 hours expiration)
    const invitationToken = randomBytes(32).toString('hex')
    const invitationExpires = new Date()
    invitationExpires.setHours(invitationExpires.getHours() + 24)

    await db
      .update(users)
      .set({
        emailVerificationToken: invitationToken,
        emailVerificationExpires: invitationExpires,
        invitationSentAt: now,
        invitationCount: (user.invitationCount || 0) + 1,
        tokenUsed: false,
      })
      .where(eq(users.id, userId))

    // Look up facility name for a nicer email
    let facilityName = 'Your Facility'
    if (user.facilityId) {
      try {
        const [facility] = await db
          .select({ name: facilities.name })
          .from(facilities)
          .where(eq(facilities.id, user.facilityId))
          .limit(1)

        if (facility?.name) {
          facilityName = facility.name
        }
      } catch (facilityError) {
        console.error('Error fetching facility name for resend:', facilityError)
      }
    }

    // Send facility user invitation email
    try {
      await sendFacilityUserInvitationEmail({
        to: user.email,
        name: user.name,
        invitationToken,
        role: (user.subRole || 'Facility User').replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        facilityName,
      })
    } catch (emailError) {
      console.error('Failed to send facility invitation email (resend):', emailError)
      // Continue even if email fails; UI will still show updated state
    }

    await logAudit({
      userId: session.user.id,
      action: 'facility_user_invitation_resent',
      resource: 'user',
      resourceId: userId,
      details: {
        email: user.email,
        facilityId: user.facilityId,
        userAgent: request.headers.get('user-agent') || undefined,
      },
      ipAddress: clientId,
      success: true,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Invitation resent successfully',
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        },
      }
    )
  } catch (error) {
    console.error('Error resending facility user invitation:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

