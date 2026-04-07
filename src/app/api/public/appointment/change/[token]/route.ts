import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appointments, patients, facilities, doctors, departments, doctorTimeSlots } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { format } from "date-fns"

export const dynamic = 'force-dynamic'

/**
 * GET /api/public/appointment/change/[token]
 * Get appointment change request details by token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const appointment = await db
      .select({
        appointment: appointments,
        patient: {
          fullName: patients.fullName,
          phone: patients.phone,
        },
        facility: {
          name: facilities.name,
          logoUrl: facilities.logoUrl,
        },
        currentDoctor: {
          id: doctors.id,
          fullName: doctors.fullName,
          specialty: doctors.specialty,
        },
        currentTimeSlot: {
          id: doctorTimeSlots.id,
          startsAt: doctorTimeSlots.startsAt,
          endsAt: doctorTimeSlots.endsAt,
        },
        department: {
          name: departments.name,
        },
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(facilities, eq(appointments.facilityId, facilities.id))
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .innerJoin(departments, eq(appointments.departmentId, departments.id))
      .innerJoin(doctorTimeSlots, eq(appointments.timeSlotId, doctorTimeSlots.id))
      .where(
        and(
          eq(appointments.changeRequestToken, params.token),
          eq(appointments.changeRequestStatus, 'pending')
        )
      )
      .limit(1)

    if (appointment.length === 0) {
      return NextResponse.json({ error: "Change request not found or already processed" }, { status: 404 })
    }

    const { appointment: apt, patient, facility, currentDoctor, currentTimeSlot, department } = appointment[0]

    // Fetch proposed doctor if exists
    let proposedDoctor = null
    if (apt.proposedDoctorId) {
      const [doc] = await db
        .select({
          id: doctors.id,
          fullName: doctors.fullName,
          specialty: doctors.specialty,
        })
        .from(doctors)
        .where(eq(doctors.id, apt.proposedDoctorId))
        .limit(1)
      proposedDoctor = doc || null
    }

    // Fetch proposed time slot if exists
    let proposedTimeSlot = null
    if (apt.proposedTimeSlotId) {
      const [slot] = await db
        .select({
          id: doctorTimeSlots.id,
          startsAt: doctorTimeSlots.startsAt,
          endsAt: doctorTimeSlots.endsAt,
        })
        .from(doctorTimeSlots)
        .where(eq(doctorTimeSlots.id, apt.proposedTimeSlotId))
        .limit(1)
      proposedTimeSlot = slot || null
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment: {
          id: apt.id,
          appointmentNumber: apt.appointmentNumber,
          status: apt.status,
        },
        patient: {
          fullName: patient.fullName,
        },
        facility: {
          name: facility.name,
          logoUrl: facility.logoUrl,
        },
        department: {
          name: department.name,
        },
        current: {
          doctor: currentDoctor,
          timeSlot: {
            ...currentTimeSlot,
            formattedDate: format(currentTimeSlot.startsAt, 'EEEE, MMMM d, yyyy'),
            formattedTime: `${format(currentTimeSlot.startsAt, 'h:mm a')} - ${format(currentTimeSlot.endsAt, 'h:mm a')}`,
          },
        },
        proposed: {
          doctor: proposedDoctor,
          timeSlot: proposedTimeSlot ? {
            ...proposedTimeSlot,
            formattedDate: format(proposedTimeSlot.startsAt, 'EEEE, MMMM d, yyyy'),
            formattedTime: `${format(proposedTimeSlot.startsAt, 'h:mm a')} - ${format(proposedTimeSlot.endsAt, 'h:mm a')}`,
          } : null,
        },
        reason: apt.changeRequestReason,
        hasDoctorChange: !!apt.proposedDoctorId,
        hasTimeChange: !!apt.proposedTimeSlotId,
      },
    })
  } catch (error) {
    console.error("Error fetching change request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/public/appointment/change/[token]
 * Patient accepts or rejects the change request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json()
    const { action } = body // 'accept' or 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'accept' or 'reject'" }, { status: 400 })
    }

    // Get appointment with change request
    const appointment = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.changeRequestToken, params.token),
          eq(appointments.changeRequestStatus, 'pending')
        )
      )
      .limit(1)

    if (appointment.length === 0) {
      return NextResponse.json({ error: "Change request not found or already processed" }, { status: 404 })
    }

    const apt = appointment[0]

    if (action === 'accept') {
      // Apply the changes
      const updateData: any = {
        changeRequestStatus: 'accepted',
        changeResponseAt: new Date(),
        updatedAt: new Date(),
      }

      // Apply doctor change
      if (apt.proposedDoctorId) {
        updateData.doctorId = apt.proposedDoctorId
      }

      // Apply time slot change
      if (apt.proposedTimeSlotId) {
        // Free up old slot
        await db
          .update(doctorTimeSlots)
          .set({ status: 'available', updatedAt: new Date() })
          .where(eq(doctorTimeSlots.id, apt.timeSlotId))

        // Book new slot
        await db
          .update(doctorTimeSlots)
          .set({ status: 'booked', updatedAt: new Date() })
          .where(eq(doctorTimeSlots.id, apt.proposedTimeSlotId))

        updateData.timeSlotId = apt.proposedTimeSlotId
      }

      // Clear proposed fields
      updateData.proposedDoctorId = null
      updateData.proposedTimeSlotId = null
      updateData.changeRequestToken = null

      await db
        .update(appointments)
        .set(updateData)
        .where(eq(appointments.id, apt.id))

      // Send confirmation SMS
      try {
        const [appointmentDetails] = await db
          .select({
            patient: {
              fullName: patients.fullName,
              phone: patients.phone,
            },
            facility: {
              name: facilities.name,
            },
            doctor: {
              fullName: doctors.fullName,
            },
            timeSlot: {
              startsAt: doctorTimeSlots.startsAt,
              endsAt: doctorTimeSlots.endsAt,
            },
            appointment: {
              appointmentNumber: appointments.appointmentNumber,
            },
          })
          .from(appointments)
          .innerJoin(patients, eq(appointments.patientId, patients.id))
          .innerJoin(facilities, eq(appointments.facilityId, facilities.id))
          .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
          .innerJoin(doctorTimeSlots, eq(appointments.timeSlotId, doctorTimeSlots.id))
          .where(eq(appointments.id, apt.id))
          .limit(1)

        if (appointmentDetails && appointmentDetails.patient.phone) {
          const { sendAppointmentChangeConfirmedSMS } = await import('@/lib/sms')
          await sendAppointmentChangeConfirmedSMS(appointmentDetails.patient.phone, {
            appointmentNumber: appointmentDetails.appointment.appointmentNumber,
            patientName: appointmentDetails.patient.fullName,
            facilityName: appointmentDetails.facility.name,
            doctor: appointmentDetails.doctor.fullName,
            date: format(appointmentDetails.timeSlot.startsAt, 'EEEE, MMMM d, yyyy'),
            time: `${format(appointmentDetails.timeSlot.startsAt, 'h:mm a')} - ${format(appointmentDetails.timeSlot.endsAt, 'h:mm a')}`,
          })
        }
      } catch (smsError) {
        console.error('Failed to send confirmation SMS:', smsError)
      }

      return NextResponse.json({
        success: true,
        message: "Change accepted. Your appointment has been updated.",
      })
    } else {
      // Reject the change
      await db
        .update(appointments)
        .set({
          changeRequestStatus: 'rejected',
          changeResponseAt: new Date(),
          proposedDoctorId: null,
          proposedTimeSlotId: null,
          changeRequestToken: null,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, apt.id))

      return NextResponse.json({
        success: true,
        message: "Change rejected. Your original appointment remains unchanged.",
      })
    }
  } catch (error) {
    console.error("Error processing change request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
