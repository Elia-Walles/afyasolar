import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { sendBulkFacilityInvitationEmail } from '@/lib/email'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bulkInviteSchema = z.object({
  emails: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().optional(),
    })
  ).min(1, "At least one email is required"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emails } = bulkInviteSchema.parse(body)

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>,
      skipped: [] as Array<{ email: string; reason: string }>,
    }

    // Process each email
    for (const { email, name } of emails) {
      try {
        const normalizedEmail = email.toLowerCase().trim()
        const facilityName = name || normalizedEmail.split("@")[0]

        // Check if facility with this email already exists
        const existingFacility = await db
          .select()
          .from(facilities)
          .where(eq(facilities.email, normalizedEmail))
          .limit(1)

        if (existingFacility.length > 0) {
          results.skipped.push({
            email: normalizedEmail,
            reason: "Facility with this email already exists",
          })
          continue
        }

        // For bulk invitations, we don't pre-create facilities
        // Just send invitation email with signup link
        // Facilities will register themselves through the signup page

        // Send bulk invitation email (redirects to signup page)
        try {
          const emailSent = await sendBulkFacilityInvitationEmail({
            to: normalizedEmail,
            facilityName,
          })

          if (emailSent) {
            results.sent++
            console.log(`✅ Successfully sent invitation email to: ${normalizedEmail}`)
          } else {
            // Email failed to send
            results.failed++
            results.errors.push({
              email: normalizedEmail,
              error: "Failed to send invitation email - SMTP may not be configured",
            })
            console.error(`❌ Failed to send invitation email to: ${normalizedEmail}`)
          }
        } catch (emailError: any) {
          // Email sending threw an error
          results.failed++
          results.errors.push({
            email: normalizedEmail,
            error: emailError.message || "Email sending error",
          })
          console.error(`❌ Error sending invitation email to ${normalizedEmail}:`, emailError)
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          email: email,
          error: error.message || "Unknown error",
        })
        console.error(`Error processing invitation for ${email}:`, error)
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${emails.length} invitation(s): ${results.sent} sent, ${results.failed} failed, ${results.skipped.length} skipped`,
        sent: results.sent,
        failed: results.failed,
        skipped: results.skipped.length,
        errors: results.errors,
        skippedDetails: results.skipped,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error processing bulk invitations:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process bulk invitations' },
      { status: 500 }
    )
  }
}
