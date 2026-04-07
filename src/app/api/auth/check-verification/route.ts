import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/auth/check-verification
 * Check if a user's email is verified (for signin error handling)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const [user] = await db
      .select({
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({ requiresVerification: false })
    }

    return NextResponse.json({
      requiresVerification: !user.emailVerified,
      emailVerified: user.emailVerified,
    })
  } catch (error) {
    console.error('Error checking verification:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

