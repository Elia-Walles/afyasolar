import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { db } from "@/lib/db"
import { users, technicians } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (session.user.role !== "technician") {
      return NextResponse.json(
        { error: "Forbidden - Technician access required" },
        { status: 403 }
      )
    }

    const technicianId = params.id
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      )
    }

    // Get technician to find their email
    const technician = await db
      .select({ email: technicians.email })
      .from(technicians)
      .where(eq(technicians.id, technicianId))
      .limit(1)

    if (!technician.length) {
      return NextResponse.json(
        { error: "Technician not found" },
        { status: 404 }
      )
    }

    // Get user data with password
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, technician[0].email))
      .limit(1)

    if (!user.length) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 }
      )
    }

    const userData = user[0]

    // Check if account is locked
    if (userData.accountLockedUntil && new Date() < userData.accountLockedUntil) {
      return NextResponse.json(
        { error: "Account is temporarily locked" },
        { status: 423 }
      )
    }

    // Verify current password
    if (userData.password) {
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        userData.password
      )

      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        )
      }
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password in users table
    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        failedLoginAttempts: 0, // Reset failed attempts on successful password change
        accountLockedUntil: null, // Unlock account if it was locked
      })
      .where(eq(users.id, userData.id))

    return NextResponse.json(
      { message: "Password updated successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error updating password:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
