import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { adminNotifications } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/admin/notifications
 * Get notifications for admin users
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Build query conditions
    const conditions = []
    
    if (unreadOnly) {
      conditions.push(eq(adminNotifications.isRead, false))
      conditions.push(eq(adminNotifications.isDismissed, false))
    }

    const notifications = await db
      .select()
      .from(adminNotifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adminNotifications.createdAt))
      .limit(limit)

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Error fetching admin notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/notifications
 * Create a new admin notification
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or system (for automated notifications)
    if (session.user.role !== 'admin' && session.user.role !== 'system') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      type,
      title,
      message,
      actionUrl,
      actionLabel,
      facilityId,
      productId,
      serviceName,
      transactionId,
      metadata,
      priority = 'normal'
    } = body

    // Validate required fields
    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Type, title, and message are required' },
        { status: 400 }
      )
    }

    const notificationId = generateId()

    await db
      .insert(adminNotifications)
      .values({
        id: notificationId,
        userId: session.user.id,
        type,
        title,
        message,
        actionUrl,
        actionLabel,
        facilityId,
        productId,
        serviceName,
        transactionId,
        metadata,
        priority,
        showInDashboard: true,
        sendEmail: false,
        sendSms: false,
        isRead: false,
        isDismissed: false,
      })

    return NextResponse.json({ notification: { id: notificationId } })
  } catch (error) {
    console.error('Error creating admin notification:', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/notifications/[id]
 * Update notification status (mark as read, dismissed, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, isRead, isDismissed } = body

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (isRead !== undefined) {
      updateData.isRead = isRead
      updateData.readAt = isRead ? new Date() : null
    }
    if (isDismissed !== undefined) {
      updateData.isDismissed = isDismissed
      updateData.dismissedAt = isDismissed ? new Date() : null
    }

    await db
      .update(adminNotifications)
      .set(updateData)
      .where(eq(adminNotifications.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating admin notification:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}
