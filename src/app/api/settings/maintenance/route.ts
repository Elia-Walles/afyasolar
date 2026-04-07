import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { getMaintenanceSettings, updateMaintenanceSettings } from '@/lib/settings/visibility-settings'
import { z } from 'zod'

const settingsSchema = z.object({
  quoteVisibility: z.enum(['admin_only', 'facility_after_approval', 'always_visible']).optional(),
  requireReportBeforeQuote: z.boolean().optional(),
  commentDefaults: z.object({
    admin: z.enum(['internal', 'facility', 'technician']).optional(),
    technician: z.enum(['internal', 'facility', 'technician']).optional(),
    facility: z.enum(['internal', 'facility', 'technician']).optional(),
  }).optional(),
  reminders: z.object({
    reportDueHours: z.number().min(1).max(168).optional(),
    quoteDueHours: z.number().min(1).max(168).optional(),
  }).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ success: true, data: getMaintenanceSettings() })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = settingsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.errors }, { status: 400 })
  }

  updateMaintenanceSettings(parsed.data)

  return NextResponse.json({ success: true, data: getMaintenanceSettings() })
}

