import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { sendFacilityInvitationEmail } from '@/lib/email'
import { randomUUID } from 'crypto'

/**
 * Test endpoint to verify email sending
 * Only accessible to admins
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const testToken = randomUUID()
    const testName = name || 'Test Facility'

    console.log(`\n🧪 Testing email sending to: ${email}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const emailSent = await sendFacilityInvitationEmail({
      to: email,
      facilityName: testName,
      invitationToken: testToken,
    })

    if (emailSent) {
      console.log('✅ Email sent successfully!')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully!',
        email,
        invitationUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/auth/accept-invitation?token=${testToken}`,
      })
    } else {
      console.log('❌ Email sending failed!')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return NextResponse.json({
        success: false,
        message: 'Email sending failed. Check server logs and SMTP configuration.',
        email,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error in test email endpoint:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    )
  }
}
