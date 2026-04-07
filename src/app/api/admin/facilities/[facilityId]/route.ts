import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/facilities/[facilityId]
 * Delete a facility (admin only). May fail if facility has related records (users, devices, etc.)
 * without ON DELETE CASCADE in the database.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { facilityId } = await params

    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const [existing] = await db.select({ id: facilities.id }).from(facilities).where(eq(facilities.id, facilityId)).limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    await db.delete(facilities).where(eq(facilities.id, facilityId))

    return NextResponse.json({
      success: true,
      message: 'Facility deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting facility:', error)

    const message = error instanceof Error ? error.message : 'Internal server error'
    if (message.includes('foreign key') || message.includes('ForeignKey') || message.includes('a foreign key constraint')) {
      return NextResponse.json(
        {
          error: 'Cannot delete facility. It has related records (users, devices, subscriptions, bookings, etc.). Remove or reassign them first.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

