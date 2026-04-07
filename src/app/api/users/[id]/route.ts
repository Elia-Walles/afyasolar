import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { isAfyaFinanceReadOnlySubRole } from "@/lib/auth/afya-finance-rbac"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  // `role` is overloaded: for admins it can be a top-level role,
  // for facilities it can be a facility sub-role (store-manager, branch-manager, etc.)
  role: z
    .enum([
      "facility",
      "technician",
      "admin",
      "store-manager",
      "pharmacy-manager",
      "nurse",
      "doctor",
      "general-manager",
      "branch-manager",
      "chief-executive-officer",
      "finance-and-administration-officer",
    ])
    .optional(),
  department: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(), // Display-only
})

/**
 * PATCH /api/users/[id]
 * Update a user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role === 'facility') {
      const subRole = (session.user as any).subRole as string | undefined
      if (isAfyaFinanceReadOnlySubRole(subRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get existing user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = existing[0]

    // Check access: Admin can update anyone, facility can only update users in their facility
    if (session.user.role !== 'admin') {
      if (session.user.role === 'facility' && session.user.facilityId) {
        if (user.facilityId !== session.user.facilityId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    const updateData: any = { updatedAt: new Date() }
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.email !== undefined) updateData.email = validatedData.email
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone

    // Handle role and sub-role updates
    if (validatedData.role !== undefined) {
      const topLevelRoles = ['facility', 'technician', 'admin']
      const subRoles = [
        'store-manager',
        'pharmacy-manager',
        'nurse',
        'doctor',
        'general-manager',
        'branch-manager',
        'chief-executive-officer',
        'finance-and-administration-officer',
      ]

      // Only admin can change the actual database role (facility/technician/admin)
      if (session.user.role === 'admin' && topLevelRoles.includes(validatedData.role)) {
        updateData.role = validatedData.role
      }

      // For facility-created users, sub-role is stored in users.subRole
      if (subRoles.includes(validatedData.role)) {
        updateData.subRole = validatedData.role
      }
    }

    // Persist department so it stays in sync with branch/department assignments
    if (validatedData.department !== undefined) {
      updateData.department = validatedData.department
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, params.id))

    // Fetch updated user
    const updated = await db
      .select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1)

    return NextResponse.json({ 
      success: true, 
      message: 'User updated successfully',
      data: {
        ...updated[0],
        // Include sub-role and department in response if provided
        subRole: validatedData.role && !['facility', 'technician', 'admin'].includes(validatedData.role) 
          ? validatedData.role 
          : undefined,
        department: validatedData.department,
        status: validatedData.status,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation error', 
        details: error.errors 
      }, { status: 400 })
    }
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user (soft delete by setting status to inactive, or hard delete)
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

    if (session.user.role === 'facility') {
      const subRole = (session.user as any).subRole as string | undefined
      if (isAfyaFinanceReadOnlySubRole(subRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get existing user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = existing[0]

    // Check access: Admin can delete anyone, facility can only delete users in their facility
    if (session.user.role !== 'admin') {
      if (session.user.role === 'facility' && session.user.facilityId) {
        if (user.facilityId !== session.user.facilityId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Hard delete: Remove user from database
    // Note: If you want soft delete, you would need to add a status field to the users table schema
    await db
      .delete(users)
      .where(eq(users.id, params.id))

    return NextResponse.json({ 
      success: true, 
      message: 'User deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

