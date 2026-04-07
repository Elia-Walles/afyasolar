import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { simulatedPayments } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

const MANAGEMENT_PANEL_EMAIL = 'services@ubuntuafyalink.co.tz'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || session.user.email.toLowerCase() !== MANAGEMENT_PANEL_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await db
      .select()
      .from(simulatedPayments)
      .orderBy(desc(simulatedPayments.paymentDate))

    const payments = rows.map((p) => ({
      id: p.id,
      facilityId: p.facilityId,
      facilityName: p.facilityName,
      amount: String(p.amount ?? '0'),
      paymentDate: p.paymentDate,
      periodLabel: p.periodLabel,
      paymentType: p.paymentType,
      status: p.status,
    }))

    const totalAmount = rows.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)

    return NextResponse.json({ payments, totalAmount })
  } catch (error) {
    console.error('Management panel payments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
