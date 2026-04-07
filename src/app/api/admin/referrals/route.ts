import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilityReferrals, facilities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query with conditional where clause
    const results = await db
      .select({
        id: facilityReferrals.id,
        referrerFacilityId: facilityReferrals.referrerFacilityId,
        referredFacilityId: facilityReferrals.referredFacilityId,
        referralCode: facilityReferrals.referralCode,
        status: facilityReferrals.status,
        benefitApproved: facilityReferrals.benefitApproved,
        benefitApprovedBy: facilityReferrals.benefitApprovedBy,
        benefitApprovedAt: facilityReferrals.benefitApprovedAt,
        createdAt: facilityReferrals.createdAt,
        updatedAt: facilityReferrals.updatedAt,
        referrerName: facilities.name,
        referrerEmail: facilities.email,
      })
      .from(facilityReferrals)
      .leftJoin(
        facilities,
        eq(facilityReferrals.referrerFacilityId, facilities.id)
      )
      .where(status && status !== 'all' ? eq(facilityReferrals.status, status) : undefined)

    // Get referred facility details
    const referralsWithDetails = await Promise.all(
      results.map(async (ref) => {
        const [referredFacility] = await db
          .select({
            id: facilities.id,
            name: facilities.name,
            email: facilities.email,
          })
          .from(facilities)
          .where(eq(facilities.id, ref.referredFacilityId))
          .limit(1)

        return {
          id: ref.id,
          referrerFacilityId: ref.referrerFacilityId,
          referredFacilityId: ref.referredFacilityId,
          referralCode: ref.referralCode,
          status: ref.status,
          benefitApproved: ref.benefitApproved,
          benefitApprovedBy: ref.benefitApprovedBy,
          benefitApprovedAt: ref.benefitApprovedAt,
          createdAt: ref.createdAt,
          updatedAt: ref.updatedAt,
          referrer: {
            id: ref.referrerFacilityId,
            name: ref.referrerName || 'Unknown',
            email: ref.referrerEmail || '',
          },
          referred: referredFacility
            ? {
                id: referredFacility.id,
                name: referredFacility.name,
                email: referredFacility.email,
              }
            : undefined,
        }
      })
    )

    return NextResponse.json({ referrals: referralsWithDetails }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching referrals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    )
  }
}
