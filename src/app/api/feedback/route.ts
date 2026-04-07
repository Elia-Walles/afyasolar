import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities, facilityFeedback } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { notificationCreators } from '@/lib/notifications/event-notifications'

/**
 * POST /api/feedback
 * Submit feedback (web/app).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { facilityId, patientName, patientPhone, type, message, rating, source = 'web' } = body

    // Validate required fields
    if (!facilityId || !patientPhone || !type || !message) {
      return NextResponse.json({ 
        error: 'Missing required fields: facilityId, patientPhone, type, message' 
      }, { status: 400 })
    }

    // Verify facility exists
    const facility = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (facility.length === 0) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Create feedback record using existing facilityFeedback table
    const feedbackId = randomUUID()
    const feedbackNumber = `FB-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${randomUUID().substring(0, 6).toUpperCase()}`
    
    // Map feedback type to the expected format
    const feedbackTypes = JSON.stringify([type.toLowerCase()])
    
    await db.insert(facilityFeedback).values({
      id: feedbackId,
      facilityId,
      appointmentId: null,
      feedbackNumber,
      userRole: 'patient',
      phoneNumber: patientPhone,
      serviceDepartment: null,
      feedbackTypes,
      detailedFeedback: message,
      ratings: rating ? JSON.stringify({ overall: rating }) : null,
      overallExperience: rating || null,
      isAttended: false,
      ipAddress: null,
      userAgent: 'Web'
    })

    // Trigger admin notification for new feedback
    try {
      await notificationCreators.feedbackSubmitted({
        feedbackNumber: feedbackNumber,
        facilityName: facility[0].name,
        facilityId: facilityId,
        patientName: patientName || 'Anonymous',
        patientPhone: patientPhone,
        type: type,
        message: message,
        rating: rating,
        source: source,
      })
    } catch (notificationError) {
      console.error('Failed to create feedback notification:', notificationError)
      // Don't fail the feedback submission if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        id: feedbackId,
        feedbackNumber,
        facilityName: facility[0].name
      }
    })

  } catch (error) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

/**
 * GET /api/feedback
 * Get feedback for a facility (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facilityId') || session.user.facilityId
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Check access
    if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch feedback from facilityFeedback table
    const feedback = await db
      .select()
      .from(facilityFeedback)
      .where(eq(facilityFeedback.facilityId, facilityId))

    return NextResponse.json({
      success: true,
      data: feedback
    })

  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
