import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { facilityFeedback, facilities, appointments } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { randomUUID } from "crypto"
import { z } from "zod"

const submitFeedbackSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  slug: z.string().optional(), // Facility slug for public access
  userRole: z.enum(['patient', 'visitor', 'relative', 'caregiver']),
  phoneNumber: z.string().optional(),
  serviceDepartment: z.string().optional(),
  feedbackTypes: z.array(z.enum(['compliment', 'suggestion', 'complaint', 'general'])).min(1),
  detailedFeedback: z.string().min(10).max(2000),
  ratings: z.record(z.string(), z.number().min(1).max(5)).optional(),
  // Static ratings for backward compatibility
  overallExperience: z.number().min(1).max(5).optional(),
  staffFriendliness: z.number().min(1).max(5).optional(),
  waitTime: z.number().min(1).max(5).optional(),
  cleanliness: z.number().min(1).max(5).optional(),
  communication: z.number().min(1).max(5).optional(),
  treatmentQuality: z.number().min(1).max(5).optional(),
  facilityComfort: z.number().min(1).max(5).optional(),
})

/**
 * POST /api/public/feedback
 * Submit feedback for a facility/appointment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = submitFeedbackSchema.parse(body)

    // Get facility ID
    let facilityId: string | null = null
    
    if (validated.facilityId) {
      facilityId = validated.facilityId
    } else if (validated.slug) {
      const facility = await db
        .select({ id: facilities.id })
        .from(facilities)
        .where(eq(facilities.bookingSlug, validated.slug))
        .limit(1)
      
      if (facility.length === 0) {
        return NextResponse.json(
          { error: "Facility not found" },
          { status: 404 }
        )
      }
      facilityId = facility[0].id
    } else if (validated.appointmentId) {
      // Get facility from appointment
      const appointment = await db
        .select({ facilityId: appointments.facilityId })
        .from(appointments)
        .where(eq(appointments.id, validated.appointmentId))
        .limit(1)
      
      if (appointment.length === 0) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 }
        )
      }
      facilityId = appointment[0].facilityId
    }

    if (!facilityId) {
      return NextResponse.json(
        { error: "Facility ID, slug, or appointment ID required" },
        { status: 400 }
      )
    }

    // Verify appointment exists and belongs to facility if provided
    if (validated.appointmentId) {
      const appointment = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.id, validated.appointmentId),
            eq(appointments.facilityId, facilityId)
          )
        )
        .limit(1)
      
      if (appointment.length === 0) {
        return NextResponse.json(
          { error: "Appointment not found or does not belong to this facility" },
          { status: 404 }
        )
      }
    }

    // Generate unique feedback number with retry mechanism to prevent duplicates
    const generateFeedbackNumber = async (): Promise<string> => {
      const maxRetries = 5
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Get the highest feedback number (order by DESC to get the latest)
        const lastFeedback = await db
          .select({ feedbackNumber: facilityFeedback.feedbackNumber })
          .from(facilityFeedback)
          .orderBy(desc(facilityFeedback.feedbackNumber))
          .limit(1)
        
        let feedbackNumber = 'FB-000001'
        if (lastFeedback.length > 0) {
          const lastNumber = lastFeedback[0].feedbackNumber
          const match = lastNumber.match(/FB-(\d+)/)
          if (match) {
            const num = parseInt(match[1], 10) + 1
            feedbackNumber = `FB-${String(num).padStart(6, '0')}`
          } else {
            // If format doesn't match, use timestamp-based approach
            const timestamp = Date.now()
            feedbackNumber = `FB-${String(timestamp).slice(-8)}`
          }
        }
        
        // Check if this number already exists (race condition check)
        const existing = await db
          .select({ id: facilityFeedback.id })
          .from(facilityFeedback)
          .where(eq(facilityFeedback.feedbackNumber, feedbackNumber))
          .limit(1)
        
        if (existing.length === 0) {
          return feedbackNumber
        }
        
        // If duplicate found, add random suffix and retry
        if (attempt < maxRetries - 1) {
          const randomSuffix = Math.floor(Math.random() * 1000)
          feedbackNumber = `FB-${String(Date.now()).slice(-6)}-${String(randomSuffix).padStart(3, '0')}`
        }
      }
      
      // Fallback: use UUID-based number if all retries fail
      return `FB-${randomUUID().substring(0, 8).toUpperCase()}`
    }
    
    const feedbackNumber = await generateFeedbackNumber()

    // Collect ratings
    const ratingsObj: Record<string, number> = {}
    if (validated.ratings) {
      Object.assign(ratingsObj, validated.ratings)
    }
    
    // Add static ratings to ratings object if provided
    if (validated.overallExperience) ratingsObj.overall_experience = validated.overallExperience
    if (validated.staffFriendliness) ratingsObj.staff_friendliness = validated.staffFriendliness
    if (validated.waitTime) ratingsObj.wait_time = validated.waitTime
    if (validated.cleanliness) ratingsObj.cleanliness = validated.cleanliness
    if (validated.communication) ratingsObj.communication = validated.communication
    if (validated.treatmentQuality) ratingsObj.treatment_quality = validated.treatmentQuality
    if (validated.facilityComfort) ratingsObj.facility_comfort = validated.facilityComfort

    // Get IP address and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create feedback
    const feedbackId = randomUUID()
    await db.insert(facilityFeedback).values({
      id: feedbackId,
      facilityId,
      appointmentId: validated.appointmentId || null,
      feedbackNumber,
      userRole: validated.userRole,
      phoneNumber: validated.phoneNumber || null,
      serviceDepartment: validated.serviceDepartment || null,
      feedbackTypes: JSON.stringify(validated.feedbackTypes),
      detailedFeedback: validated.detailedFeedback,
      ratings: Object.keys(ratingsObj).length > 0 ? JSON.stringify(ratingsObj) : null,
      overallExperience: validated.overallExperience || null,
      staffFriendliness: validated.staffFriendliness || null,
      waitTime: validated.waitTime || null,
      cleanliness: validated.cleanliness || null,
      communication: validated.communication || null,
      treatmentQuality: validated.treatmentQuality || null,
      facilityComfort: validated.facilityComfort || null,
      isAttended: false,
      ipAddress,
      userAgent,
    })

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback! Your response has been recorded.",
      data: {
        id: feedbackId,
        feedbackNumber,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error submitting feedback:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
