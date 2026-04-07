import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { sendSMS } from '@/lib/sms'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Recipients: either facilityId (we resolve phone from DB) or phoneNumber (CSV/manual)
const recipientSchema = z.union([
  z.object({ facilityId: z.string().uuid(), facilityName: z.string().min(1) }),
  z.object({ phoneNumber: z.string().min(1), facilityName: z.string().min(1) }),
])
const bulkSMSSchema = z.object({
  recipients: z.array(recipientSchema).min(1),
  message: z.string().min(1).max(1000),
})

/**
 * POST /api/admin/bulk-sms
 * Send bulk SMS to multiple recipients (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate request body
    let validatedData
    try {
      validatedData = bulkSMSSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        )
      }
      throw error
    }

    const { recipients, message } = validatedData

    // Resolve facility phones from DB when facilityId is provided (admin "Select facilities" method)
    const facilityIds = recipients
      .filter((r): r is { facilityId: string; facilityName: string } => 'facilityId' in r && !!r.facilityId)
      .map(r => r.facilityId)
    const facilityPhones = new Map<string, string>()
    if (facilityIds.length > 0) {
      const rows = await db
        .select({ id: facilities.id, phone: facilities.phone })
        .from(facilities)
        .where(inArray(facilities.id, facilityIds))
      for (const row of rows) {
        if (row.phone) facilityPhones.set(row.id, row.phone)
      }
    }

    const results: Array<{
      phone: string
      facilityName: string
      success: boolean
      error?: string
    }> = []

    let successCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      const facilityName = recipient.facilityName
      let toPhone: string
      if ('facilityId' in recipient && recipient.facilityId) {
        const dbPhone = facilityPhones.get(recipient.facilityId)
        if (!dbPhone) {
          failedCount++
          results.push({
            phone: '(no phone in DB)',
            facilityName,
            success: false,
            error: 'Facility phone not found in database',
          })
          continue
        }
        toPhone = dbPhone
      } else if ('phoneNumber' in recipient && recipient.phoneNumber) {
        toPhone = recipient.phoneNumber
      } else {
        failedCount++
        results.push({
          phone: '(missing)',
          facilityName,
          success: false,
          error: 'Missing phone number',
        })
        continue
      }

      try {
        const personalizedMessage = `Dear Manager ${facilityName},\n\n${message}\n\n- Ubuntu Afya Link Team`

        const smsResult = await sendSMS({
          to: toPhone,
          message: personalizedMessage,
          sender: 'Afyalink'
        })

        if (smsResult.success) {
          successCount++
          results.push({ phone: toPhone, facilityName, success: true })
        } else {
          failedCount++
          results.push({
            phone: toPhone,
            facilityName,
            success: false,
            error: smsResult.message,
          })
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        failedCount++
        results.push({
          phone: toPhone,
          facilityName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        total: recipients.length,
        details: results,
      },
    })
  } catch (error) {
    console.error('[BulkSMS] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

