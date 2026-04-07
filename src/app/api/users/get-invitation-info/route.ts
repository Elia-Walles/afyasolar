import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

const getInvitationInfoSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export const dynamic = 'force-dynamic'

/**
 * GET /api/users/get-invitation-info?token={token}
 * Get invitation information for display in registration form
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ 
        error: 'Token is required' 
      }, { status: 400 })
    }

    const validationResult = getInvitationInfoSchema.safeParse({ token })

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
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
      return NextResponse.json({ 
        error: 'Invalid invitation token' 
      }, { status: 404 })
    }

    // Check if token already used
    if (user.tokenUsed) {
      return NextResponse.json({ 
        error: 'This invitation link has already been used' 
      }, { status: 400 })
    }

    // Check if token expired
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      return NextResponse.json({ 
        error: 'Invitation token expired' 
      }, { status: 400 })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json({ 
        error: 'Already registered' 
      }, { status: 400 })
    }

    // Get facility name
    let facilityName = 'Your Facility'
    try {
      if (user.facilityId) {
        const [facility] = await db
          .select({ name: (await import('@/lib/db/schema')).facilities.name })
          .from((await import('@/lib/db/schema')).facilities)
          .where(eq((await import('@/lib/db/schema')).facilities.id, user.facilityId))
          .limit(1)
        
        if (facility) {
          facilityName = facility.name
        }
      }
    } catch (error) {
      console.error('Error fetching facility name:', error)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.subRole || 'Staff Member', // Use sub-role if available
        department: user.department,
        facilityName,
      }
    })
  } catch (error) {
    console.error('Error getting invitation info:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
