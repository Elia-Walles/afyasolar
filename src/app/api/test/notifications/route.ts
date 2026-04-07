import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { adminNotifications } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'

export const dynamic = "force-dynamic"

/**
 * POST /api/test/notifications
 * Create a test notification (for development/testing only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'test', title, message, priority = 'normal' } = body

    const notificationId = generateId()

    await db.insert(adminNotifications).values({
      id: notificationId,
      userId: session.user.id,
      type,
      title: title || 'Test Notification',
      message: message || 'This is a test notification for the admin dashboard.',
      priority,
      showInDashboard: true,
      sendEmail: false,
      sendSms: false,
      isRead: false,
      isDismissed: false,
    })

    return NextResponse.json({ 
      success: true,
      notification: { id: notificationId }
    })
  } catch (error) {
    console.error('Error creating test notification:', error)
    return NextResponse.json(
      { error: 'Failed to create test notification' },
      { status: 500 }
    )
  }
}
