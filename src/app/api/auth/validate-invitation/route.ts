import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // Find facility with this invitation token
    const facility = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        email: facilities.email,
        invitationToken: facilities.invitationToken,
        invitationExpires: facilities.invitationExpires,
        status: facilities.status,
      })
      .from(facilities)
      .where(
        and(
          eq(facilities.invitationToken, token),
          gt(facilities.invitationExpires, new Date())
        )
      )
      .limit(1)

    if (facility.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation link' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      facility: {
        id: facility[0].id,
        name: facility[0].name,
        email: facility[0].email,
      },
    })
  } catch (error) {
    console.error('Error validating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to validate invitation' },
      { status: 500 }
    )
  }
}

