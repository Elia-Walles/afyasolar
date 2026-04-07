import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { adminNotifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/admin/notifications/mark-all-read
 * Mark all unread notifications as read for the current admin
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mark all unread notifications as read
    await db
      .update(adminNotifications)
      .set({ 
        isRead: true,
        updatedAt: new Date()
      })
      .where(eq(adminNotifications.isRead, false))

    return NextResponse.json({ 
      success: true, 
      message: 'All notifications marked as read'
    })

  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
