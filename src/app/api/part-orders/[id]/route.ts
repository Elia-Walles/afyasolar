import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { partOrders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateSchema = z.object({
  status: z
    .enum(['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'cancelled'])
    .optional(),
  unitPrice: z.number().min(0).optional(),
  totalPrice: z.number().min(0).optional(),
  approvedById: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  receivedAt: z.string().datetime().optional(),
  vendorName: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const parsed = updateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const isAdmin = session.user.role === 'admin'
    if (!isAdmin && parsed.data.status && parsed.data.status !== 'received') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db
      .update(partOrders)
      .set({
        status: parsed.data.status ?? undefined,
        unitPrice: parsed.data.unitPrice !== undefined ? String(parsed.data.unitPrice) : undefined,
        totalPrice: parsed.data.totalPrice !== undefined ? String(parsed.data.totalPrice) : undefined,
        approvedById: parsed.data.approvedById ?? (isAdmin ? session.user.id : undefined),
        approvedAt: parsed.data.approvedAt
          ? new Date(parsed.data.approvedAt)
          : isAdmin && parsed.data.status === 'approved'
          ? new Date()
          : undefined,
        receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : undefined,
        vendorName: parsed.data.vendorName ?? undefined,
        trackingNumber: parsed.data.trackingNumber ?? undefined,
        notes: parsed.data.notes ?? undefined,
      })
      .where(eq(partOrders.id, params.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating part order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

