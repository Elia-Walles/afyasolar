import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { featureRequests } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateFeatureRequestSchema = z.object({
  status: z.enum(['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected']).optional(),
  adminNotes: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { status, adminNotes } = updateFeatureRequestSchema.parse(body)

    // Check if request exists
    const [existingRequest] = await db
      .select()
      .from(featureRequests)
      .where(eq(featureRequests.id, id))
      .limit(1)

    if (!existingRequest) {
      return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
    }

    // Update the request
    const updateData: any = {}
    if (status) {
      updateData.status = status
    }
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes || null
    }

    await db
      .update(featureRequests)
      .set(updateData)
      .where(eq(featureRequests.id, id))

    return NextResponse.json(
      {
        success: true,
        message: 'Feature request updated successfully',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error updating feature request:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update feature request' },
      { status: 500 }
    )
  }
}
