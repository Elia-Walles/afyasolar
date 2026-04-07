import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appointments, patients, facilities, departments, doctors, doctorTimeSlots, insuranceProviders, insuranceCoverages } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const patientLoginSchema = z.object({
  phone: z.string().min(1),
  accessCode: z.string().length(6), // Last 6 characters of appointment number
})

/**
 * POST /api/public/patient/login
 * Patient login using phone number and last 6 characters of appointment number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = patientLoginSchema.parse(body)

    // Find appointment by access code and patient phone
    const appointmentData = await db
      .select({
        appointment: {
          id: appointments.id,
          appointmentNumber: appointments.appointmentNumber,
          status: appointments.status,
          facilityId: appointments.facilityId,
          departmentId: appointments.departmentId,
          doctorId: appointments.doctorId,
          timeSlotId: appointments.timeSlotId,
          notes: appointments.notes,
          createdAt: appointments.createdAt,
          updatedAt: appointments.updatedAt,
        },
        patient: {
          id: patients.id,
          fullName: patients.fullName,
          phone: patients.phone,
          email: patients.email,
        },
        facility: {
          id: facilities.id,
          name: facilities.name,
          phone: facilities.phone,
          bookingWhatsappNumber: facilities.bookingWhatsappNumber,
          bookingSlug: facilities.bookingSlug,
          logoUrl: facilities.logoUrl,
        },
        department: {
          id: departments.id,
          name: departments.name,
        },
        doctor: {
          id: doctors.id,
          fullName: doctors.fullName,
          specialty: doctors.specialty,
        },
        timeSlot: {
          id: doctorTimeSlots.id,
          startsAt: doctorTimeSlots.startsAt,
          endsAt: doctorTimeSlots.endsAt,
        },
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(facilities, eq(appointments.facilityId, facilities.id))
      .innerJoin(departments, eq(appointments.departmentId, departments.id))
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .innerJoin(doctorTimeSlots, eq(appointments.timeSlotId, doctorTimeSlots.id))
      .where(
        and(
          eq(appointments.accessCode, validated.accessCode.toUpperCase()),
          eq(patients.phone, validated.phone)
        )
      )
      .limit(1)

    if (appointmentData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid credentials. Please check your phone number and access code.",
        },
        { status: 401 }
      )
    }

    const { appointment, patient, facility, department, doctor, timeSlot } = appointmentData[0]

    // Parse insurance information from notes
    let cleanNotes = appointment.notes || ""
    let insuranceInfo: { provider?: any; coverage?: any } | null = null

    if (appointment.notes) {
      const insuranceMatch = appointment.notes.match(/\[INSURANCE\](.*?)\[\/INSURANCE\]/s)
      if (insuranceMatch) {
        try {
          const insuranceData = JSON.parse(insuranceMatch[1])
          
          // Initialize insuranceInfo as an object if it's null
          if (!insuranceInfo) {
            insuranceInfo = {}
          }
          
          // Fetch insurance provider if providerId exists
          if (insuranceData.providerId) {
            const provider = await db
              .select()
              .from(insuranceProviders)
              .where(eq(insuranceProviders.id, insuranceData.providerId))
              .limit(1)
            
            if (provider.length > 0) {
              insuranceInfo = { ...insuranceInfo, provider: provider[0] }
            }
          }

          // Fetch insurance coverage if coverageId exists
          if (insuranceData.coverageId) {
            const coverage = await db
              .select()
              .from(insuranceCoverages)
              .where(eq(insuranceCoverages.id, insuranceData.coverageId))
              .limit(1)
            
            if (coverage.length > 0) {
              insuranceInfo = { ...insuranceInfo, coverage: coverage[0] }
            }
          }

          // Remove insurance JSON from notes
          cleanNotes = appointment.notes.replace(/\[INSURANCE\].*?\[\/INSURANCE\]/s, "").trim()
        } catch (error) {
          console.error("Error parsing insurance data:", error)
          // If parsing fails, keep original notes
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Login successful",
      data: {
        appointment: {
          ...appointment,
          notes: cleanNotes || null,
          department: department.name,
          doctor: doctor.fullName,
          doctorSpecialty: doctor.specialty,
          timeSlot: {
            startsAt: timeSlot.startsAt,
            endsAt: timeSlot.endsAt,
          },
        },
        patient: {
          fullName: patient.fullName,
          phone: patient.phone,
        },
        facility: {
          name: facility.name,
          phone: facility.phone,
          bookingWhatsappNumber: facility.bookingWhatsappNumber,
          bookingSlug: facility.bookingSlug,
          logoUrl: facility.logoUrl,
        },
        insurance: insuranceInfo || null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error in patient login:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
