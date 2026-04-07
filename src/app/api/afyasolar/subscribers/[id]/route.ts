import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarSubscribers } from '@/lib/db/afyasolar-subscribers-schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateSubscriberSchema = z.object({
  paymentStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  subscriptionStatus: z.enum(['active', 'expired', 'suspended', 'cancelled']).optional(),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  systemStatus: z.enum(['active', 'inactive', 'maintenance']).optional(),
  systemHealth: z.enum(['optimal', 'warning', 'critical']).optional(),
  installationStatus: z.enum(['pending', 'scheduled', 'completed']).optional(),
  notes: z.string().optional(),
  adminNotes: z.string().optional(),
})

/**
 * PUT /api/afyasolar/subscribers/[id]
 * Update an existing Afya Solar subscriber
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const subscriberId = parseInt(id)

    if (isNaN(subscriberId)) {
      return NextResponse.json({ error: 'Invalid subscriber ID' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = updateSubscriberSchema.parse(body)

    await db
      .update(afyaSolarSubscribers)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(afyaSolarSubscribers.id, subscriberId))

    return NextResponse.json({
      success: true,
      data: {
        subscriber: {
          id: subscriberId,
          ...validatedData,
        },
      },
      message: 'Afya Solar subscription updated successfully',
    })
  } catch (error) {
    console.error('Error updating Afya Solar subscriber:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 },
    )
  }
}

