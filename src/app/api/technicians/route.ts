import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { technicians, users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/technicians
 * Get all technicians (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can view all technicians
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allTechnicians = await db
      .select({
        id: technicians.id,
        firstName: technicians.firstName,
        lastName: technicians.lastName,
        email: technicians.email,
        phone: technicians.phone,
        yearsExperience: technicians.yearsExperience,
        practicingLicense: technicians.practicingLicense,
        shortBio: technicians.shortBio,
        regionId: technicians.regionId,
        districtId: technicians.districtId,
        availabilityStatus: technicians.availabilityStatus,
        status: technicians.status,
        licenseVerified: technicians.licenseVerified,
        licenseVerifiedAt: technicians.licenseVerifiedAt,
        averageRating: technicians.averageRating,
        totalReviews: technicians.totalReviews,
        lastActiveAt: technicians.lastActiveAt,
        createdAt: technicians.createdAt,
        updatedAt: technicians.updatedAt,
      })
      .from(technicians)
      .orderBy(
        desc(technicians.averageRating),
        desc(technicians.totalReviews),
        technicians.createdAt,
      )

    // Get user data for each technician
    const techniciansWithUsers = await Promise.all(
      allTechnicians.map(async (tech) => {
        const [user] = await db
          .select({
            id: users.id,
            emailVerified: users.emailVerified,
            invitationSentAt: users.invitationSentAt,
            invitationCount: users.invitationCount,
          })
          .from(users)
          .where(eq(users.email, tech.email))
          .limit(1)

        return {
          ...tech,
          user: user || null,
        }
      })
    )

    return NextResponse.json({ success: true, data: techniciansWithUsers })
  } catch (error) {
    console.error('Error fetching technicians:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

