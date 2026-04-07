import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { technicians, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * DELETE /api/technicians/[id]
 * Delete a technician (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete technicians
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const technicianId = params.id

    // First check if technician exists
    const [technician] = await db
      .select({
        id: technicians.id,
        email: technicians.email,
        firstName: technicians.firstName,
        lastName: technicians.lastName,
      })
      .from(technicians)
      .where(eq(technicians.id, technicianId))
      .limit(1)

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    // Check if technician has any active assignments or related data
    // This is a basic check - you might want to add more comprehensive checks
    // based on your business logic and database relationships

    try {
      // Delete the technician (this will cascade delete related records if properly set up)
      await db.delete(technicians).where(eq(technicians.id, technicianId))

      // Optionally, you might want to delete or deactivate the associated user account
      // For now, we'll leave the user account intact but you could add:
      // await db.delete(users).where(eq(users.email, technician.email))

      return NextResponse.json({ 
        success: true, 
        message: 'Technician deleted successfully' 
      })
    } catch (deleteError) {
      // Handle foreign key constraint violations
      console.error('Delete constraint error:', deleteError)
      return NextResponse.json({ 
        error: 'Cannot delete technician: they have related records (assignments, reviews, etc.)' 
      }, { status: 409 })
    }

  } catch (error) {
    console.error('Error deleting technician:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
