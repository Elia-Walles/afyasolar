import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateReferralCode } from '@/lib/referral'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID not found' }, { status: 400 })
    }

    // Get facility referral code
    const [facility] = await db
      .select({
        referralCode: facilities.referralCode,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Generate referral code if doesn't exist
    let referralCode = facility.referralCode
    if (!referralCode) {
      referralCode = generateReferralCode()
      await db
        .update(facilities)
        .set({ referralCode })
        .where(eq(facilities.id, facilityId))
    }

    return NextResponse.json({ referralCode }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching referral code:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referral code' },
      { status: 500 }
    )
  }
}
