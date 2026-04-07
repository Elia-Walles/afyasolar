import { NextRequest, NextResponse } from 'next/server'
import { db, getRawConnection } from '@/lib/db'
import { users, admins, facilities } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { validatePassword } from '@/lib/password-validation'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = resetPasswordSchema.parse(body)

    // Validate password strength
    const passwordValidation = validatePassword(password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true,
      minStrength: 2,
    })

    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] || 'Password does not meet requirements' },
        { status: 400 }
      )
    }

    // Find user by reset token using raw SQL to handle missing columns
    let user: any = null
    let userType: 'user' | 'admin' | 'facility' = 'user'
    // Use UTC time and format for MySQL datetime comparison
    const now = new Date()
    const nowFormatted = now.toISOString().slice(0, 19).replace('T', ' ')

    const rawConnection = getRawConnection()

    // Check users table using raw SQL
    try {
      const [userRecords] = await rawConnection.query(`
        SELECT id, email, password_reset_expires
        FROM users 
        WHERE password_reset_token = ? 
        AND password_reset_expires IS NOT NULL
        AND password_reset_expires > ?
        LIMIT 1
      `, [token, nowFormatted]) as any
      
      console.log('[Reset Password] User query result:', {
        found: userRecords && userRecords.length > 0,
        expires: userRecords?.[0]?.password_reset_expires,
        now: nowFormatted
      })

      if (userRecords && userRecords.length > 0) {
        user = userRecords[0]
        userType = 'user'
      }
    } catch (error: any) {
      // If columns don't exist, password reset is not available
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        return NextResponse.json(
          { error: 'Password reset feature is not available yet. Please contact support.' },
          { status: 503 }
        )
      }
      // Re-throw other errors
      throw error
    }

    // Check admins table using raw SQL
    if (!user) {
      try {
        const [adminRecords] = await rawConnection.query(`
          SELECT id, email, password_reset_expires
          FROM admins 
          WHERE password_reset_token = ? 
          AND password_reset_expires IS NOT NULL
          AND password_reset_expires > ?
          LIMIT 1
        `, [token, nowFormatted]) as any
        
        console.log('[Reset Password] Admin query result:', {
          found: adminRecords && adminRecords.length > 0,
          expires: adminRecords?.[0]?.password_reset_expires,
          now: nowFormatted
        })

        if (adminRecords && adminRecords.length > 0) {
          user = adminRecords[0]
          userType = 'admin'
        }
      } catch (error: any) {
        // If columns don't exist, password reset is not available
        if (error?.code === 'ER_BAD_FIELD_ERROR') {
          return NextResponse.json(
            { error: 'Password reset feature is not available yet. Please contact support.' },
            { status: 503 }
          )
        }
        // Re-throw other errors
        throw error
      }
    }

    // Check facilities table using raw SQL
    if (!user) {
      try {
        const [facilityRecords] = await rawConnection.query(`
          SELECT id, email, password_reset_expires
          FROM facilities 
          WHERE password_reset_token = ? 
          AND password_reset_expires IS NOT NULL
          AND password_reset_expires > ?
          LIMIT 1
        `, [token, nowFormatted]) as any
        
        console.log('[Reset Password] Facility query result:', {
          found: facilityRecords && facilityRecords.length > 0,
          expires: facilityRecords?.[0]?.password_reset_expires,
          now: nowFormatted
        })

        if (facilityRecords && facilityRecords.length > 0) {
          user = facilityRecords[0]
          userType = 'facility'
        }
      } catch (error: any) {
        // If columns don't exist, password reset is not available
        if (error?.code === 'ER_BAD_FIELD_ERROR') {
          return NextResponse.json(
            { error: 'Password reset feature is not available yet. Please contact support.' },
            { status: 503 }
          )
        }
        // Re-throw other errors
        throw error
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password and clear reset token using raw SQL
    try {
      if (userType === 'user') {
        await rawConnection.query(`
          UPDATE users 
          SET password = ?, 
              password_reset_token = NULL, 
              password_reset_expires = NULL,
              failed_login_attempts = 0,
              account_locked_until = NULL
          WHERE id = ?
        `, [hashedPassword, user.id])
      } else if (userType === 'admin') {
        await rawConnection.query(`
          UPDATE admins 
          SET password = ?, 
              password_reset_token = NULL, 
              password_reset_expires = NULL,
              failed_login_attempts = 0,
              account_locked_until = NULL
          WHERE id = ?
        `, [hashedPassword, user.id])
      } else if (userType === 'facility') {
        await rawConnection.query(`
          UPDATE facilities 
          SET password = ?, 
              password_reset_token = NULL, 
              password_reset_expires = NULL,
              failed_login_attempts = 0,
              account_locked_until = NULL
          WHERE id = ?
        `, [hashedPassword, user.id])
      }
    } catch (error: any) {
      // If columns don't exist, try updating without password reset columns
      if (error?.code === 'ER_BAD_FIELD_ERROR' && 
          (error?.sqlMessage?.includes('password_reset_token') || error?.sqlMessage?.includes('password_reset_expires'))) {
        // Update without password reset columns
        if (userType === 'user') {
          await rawConnection.query(`
            UPDATE users 
            SET password = ?,
                failed_login_attempts = 0,
                account_locked_until = NULL
            WHERE id = ?
          `, [hashedPassword, user.id])
        } else if (userType === 'admin') {
          await rawConnection.query(`
            UPDATE admins 
            SET password = ?,
                failed_login_attempts = 0,
                account_locked_until = NULL
            WHERE id = ?
          `, [hashedPassword, user.id])
        } else if (userType === 'facility') {
          await rawConnection.query(`
            UPDATE facilities 
            SET password = ?,
                failed_login_attempts = 0,
                account_locked_until = NULL
            WHERE id = ?
          `, [hashedPassword, user.id])
        }
      } else {
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    })
  } catch (error) {
    console.error('Error in reset password:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

// GET endpoint to verify token validity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Use UTC time and format for MySQL datetime comparison
    const now = new Date()
    const nowFormatted = now.toISOString().slice(0, 19).replace('T', ' ')
    const rawConnection = getRawConnection()

    // Check users table using raw SQL
    try {
      const [userRecords] = await rawConnection.query(`
        SELECT id 
        FROM users 
        WHERE password_reset_token = ? 
        AND password_reset_expires IS NOT NULL
        AND password_reset_expires > ?
        LIMIT 1
      `, [token, nowFormatted]) as any

      if (userRecords && userRecords.length > 0) {
        return NextResponse.json({ valid: true })
      }
    } catch (error: any) {
      // If columns don't exist, password reset is not available
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        return NextResponse.json({ valid: false, error: 'Password reset feature not available' })
      }
    }

    // Check admins table using raw SQL
    try {
        const [adminRecords] = await rawConnection.query(`
          SELECT id 
          FROM admins 
          WHERE password_reset_token = ? 
          AND password_reset_expires IS NOT NULL
          AND password_reset_expires > ?
          LIMIT 1
        `, [token, nowFormatted]) as any

      if (adminRecords && adminRecords.length > 0) {
        return NextResponse.json({ valid: true })
      }
    } catch (error: any) {
      // If columns don't exist, password reset is not available
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        return NextResponse.json({ valid: false, error: 'Password reset feature not available' })
      }
    }

    // Check facilities table using raw SQL
    try {
        const [facilityRecords] = await rawConnection.query(`
          SELECT id 
          FROM facilities 
          WHERE password_reset_token = ? 
          AND password_reset_expires IS NOT NULL
          AND password_reset_expires > ?
          LIMIT 1
        `, [token, nowFormatted]) as any

      if (facilityRecords && facilityRecords.length > 0) {
        return NextResponse.json({ valid: true })
      }
    } catch (error: any) {
      // If columns don't exist, password reset is not available
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        return NextResponse.json({ valid: false, error: 'Password reset feature not available' })
      }
    }

    return NextResponse.json({ valid: false })
  } catch (error) {
    console.error('Error verifying reset token:', error)
    return NextResponse.json({ valid: false })
  }
}

