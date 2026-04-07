import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilityNotifications } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { 
  getUnreadNotifications, 
  markNotificationAsRead, 
  dismissNotification 
} from '@/lib/payments/transaction-service'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/notifications
 * Get notifications for the current user's facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Build query conditions
    const conditions = [eq(facilityNotifications.facilityId, facilityId)]
    
    if (unreadOnly) {
      conditions.push(eq(facilityNotifications.isRead, false))
      conditions.push(eq(facilityNotifications.isDismissed, false))
    }

    const notifications = await db
      .select()
      .from(facilityNotifications)
      .where(and(...conditions))
      .orderBy(desc(facilityNotifications.createdAt))
      .limit(limit)

    // Get unread count
    const [unreadCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(facilityNotifications)
      .where(
        and(
          eq(facilityNotifications.facilityId, facilityId),
          eq(facilityNotifications.isRead, false),
          eq(facilityNotifications.isDismissed, false)
        )
      )

    return NextResponse.json({
      notifications,
      unreadCount: Number(unreadCount?.count || 0),
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read or dismissed
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { notificationId, action, markAllRead } = body

    if (markAllRead) {
      // Mark all notifications as read for this facility
      await db
        .update(facilityNotifications)
        .set({ 
          isRead: true, 
          readAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP` 
        })
        .where(
          and(
            eq(facilityNotifications.facilityId, facilityId),
            eq(facilityNotifications.isRead, false)
          )
        )

      return NextResponse.json({ success: true, message: 'All notifications marked as read' })
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID required' },
        { status: 400 }
      )
    }

    // Verify notification belongs to this facility
    const [notification] = await db
      .select()
      .from(facilityNotifications)
      .where(
        and(
          eq(facilityNotifications.id, notificationId),
          eq(facilityNotifications.facilityId, facilityId)
        )
      )
      .limit(1)

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (action === 'read') {
      await markNotificationAsRead(notificationId)
    } else if (action === 'dismiss') {
      await dismissNotification(notificationId)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "read" or "dismiss"' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

