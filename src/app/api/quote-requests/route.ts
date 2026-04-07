import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { createQuoteRequestNotification } from '@/lib/admin/notifications'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * POST /api/quote-requests
 * Create a new quote request notification for admins
 */
export async function POST(request: NextRequest) {
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
    const {
      productId,
      productName,
      productCategory,
      message
    } = body

    // Validate required fields
    if (!productId || !productName || !productCategory) {
      return NextResponse.json(
        { error: 'Product ID, name, and category are required' },
        { status: 400 }
      )
    }

    // Get facility details
    const facility = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (facility.length === 0) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Create admin notification
    try {
      const notification = await createQuoteRequestNotification({
        facilityId,
        facilityName: facility[0].name,
        productId,
        productName,
        productCategory,
        requestedBy: session.user.name || 'Unknown User',
        requestedByEmail: session.user.email,
        requestedByPhone: facility[0].phone || undefined,
        message: message || undefined,
      })

      return NextResponse.json({
        success: true,
        message: 'Quote request sent successfully',
        notificationId: notification.id
      })
    } catch (dbError) {
      console.error('Database error creating notification:', dbError)
      
      // If table doesn't exist, fall back to logging
      if (dbError instanceof Error && dbError.message.includes("Table") && dbError.message.includes("doesn't exist")) {
        console.log('QUOTE REQUEST (FALLBACK - TABLE NOT EXISTS):', {
          facilityId,
          facilityName: facility[0].name,
          productId,
          productName,
          productCategory,
          requestedBy: session.user.name || 'Unknown User',
          requestedByEmail: session.user.email,
          requestedByPhone: facility[0].phone || undefined,
          message: message || undefined,
          requestedAt: new Date().toISOString(),
        })

        return NextResponse.json({
          success: true,
          message: 'Quote request sent successfully (admin notifications table not set up yet)',
          warning: 'Admin notifications table needs to be created'
        })
      }
      
      throw dbError // Re-throw other database errors
    }
  } catch (error) {
    console.error('Error creating quote request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to send quote request', details: errorMessage },
      { status: 500 }
    )
  }
}
