import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { carbonCredits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * PUT /api/admin/carbon-credits/[id]
 * Update a carbon credit record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { verificationStatus, verifiedBy, notes, certificateId } = body

    const verifiedAt = verificationStatus !== 'pending' ? new Date() : null
    const verifiedByValue = verificationStatus !== 'pending' ? (verifiedBy ?? null) : null
    const cert = verificationStatus === 'certified' ? (certificateId ?? null) : null

    const result = await db
      .update(carbonCredits)
      .set({
        verificationStatus,
        verifiedAt,
        verifiedBy: verifiedByValue,
        notes: notes ?? null,
        certificateId: cert,
        updatedAt: new Date(),
      })
      .where(eq(carbonCredits.id, id))

    // drizzle update returns a result object; we just confirm success by re-reading
    const [updated] = await db.select().from(carbonCredits).where(eq(carbonCredits.id, id)).limit(1)
    if (!updated) {
      return NextResponse.json({ error: 'Carbon credit not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        verificationStatus: updated.verificationStatus,
        verifiedAt: updated.verifiedAt ? new Date(updated.verifiedAt).toISOString() : undefined,
        verifiedBy: updated.verifiedBy ?? undefined,
        notes: updated.notes ?? undefined,
        certificateId: updated.certificateId ?? undefined,
        updatedAt: new Date(updated.updatedAt).toISOString(),
      },
      message: 'Carbon credit updated successfully',
    })
  } catch (error) {
    console.error('Error updating carbon credit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update carbon credit' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/admin/carbon-credits/[id]
 * Delete a carbon credit record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await db.delete(carbonCredits).where(eq(carbonCredits.id, id))

    return NextResponse.json({
      success: true,
      message: 'Carbon credit deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting carbon credit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete carbon credit' },
      { status: 500 },
    )
  }
}

