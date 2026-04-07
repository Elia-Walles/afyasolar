import { NextRequest, NextResponse } from 'next/server'
import { db, getRawConnection } from '@/lib/db'
import { users, admins, facilities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { sendPasswordResetEmail } from '@/lib/email'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists in any table
    let user: any = null
    let userType: 'user' | 'admin' | 'facility' = 'user'
    let userName = ''

    // Check users table
    const [userRecord] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (userRecord) {
      user = userRecord
      userType = 'user'
      userName = userRecord.name
    } else {
      // Check admins table
      const [adminRecord] = await db
        .select({
          id: admins.id,
          email: admins.email,
          name: admins.name,
        })
        .from(admins)
        .where(eq(admins.email, normalizedEmail))
        .limit(1)

      if (adminRecord) {
        user = adminRecord
        userType = 'admin'
        userName = adminRecord.name
      } else {
        // Check facilities table
        const [facilityRecord] = await db
          .select({
            id: facilities.id,
            email: facilities.email,
            name: facilities.name,
          })
          .from(facilities)
          .where(eq(facilities.email, normalizedEmail))
          .limit(1)

        if (facilityRecord) {
          user = facilityRecord
          userType = 'facility'
          userName = facilityRecord.name
        }
      }
    }

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate reset token
      const resetToken = randomBytes(32).toString('hex')
      const resetExpires = new Date()
      resetExpires.setHours(resetExpires.getHours() + 1) // Token expires in 1 hour
      // Format for MySQL datetime
      const resetExpiresFormatted = resetExpires.toISOString().slice(0, 19).replace('T', ' ')
      
      console.log('[Forgot Password] Setting reset token:', {
        email: normalizedEmail,
        expires: resetExpiresFormatted,
        expiresDate: resetExpires.toISOString()
      })

      // Update user with reset token using raw SQL
      // First, try to add columns if they don't exist, then update
      const rawConnection = getRawConnection()
      
      // Try to add columns if they don't exist (for each table type)
      try {
        if (userType === 'user') {
          // Try to add columns if they don't exist
          try {
            await rawConnection.query(`
              ALTER TABLE users 
              ADD COLUMN IF NOT EXISTS password_reset_token varchar(255) NULL,
              ADD COLUMN IF NOT EXISTS password_reset_expires datetime NULL
            `)
          } catch (alterError: any) {
            // MySQL doesn't support IF NOT EXISTS for ALTER TABLE, so check if columns exist first
            if (alterError?.code !== 'ER_DUP_FIELDNAME') {
              // Check if columns exist by trying to select them
              try {
                await rawConnection.query(`SELECT password_reset_token FROM users LIMIT 1`)
              } catch (selectError: any) {
                // Columns don't exist, add them
                await rawConnection.query(`
                  ALTER TABLE users 
                  ADD COLUMN password_reset_token varchar(255) NULL,
                  ADD COLUMN password_reset_expires datetime NULL
                `)
              }
            }
          }
          
          await rawConnection.query(`
            UPDATE users 
            SET password_reset_token = ?, 
                password_reset_expires = ?
            WHERE id = ?
          `, [resetToken, resetExpiresFormatted, user.id])
        } else if (userType === 'admin') {
          try {
            await rawConnection.query(`SELECT password_reset_token FROM admins LIMIT 1`)
          } catch {
            await rawConnection.query(`
              ALTER TABLE admins 
              ADD COLUMN password_reset_token varchar(255) NULL,
              ADD COLUMN password_reset_expires datetime NULL
            `)
          }
          
          await rawConnection.query(`
            UPDATE admins 
            SET password_reset_token = ?, 
                password_reset_expires = ?
            WHERE id = ?
          `, [resetToken, resetExpiresFormatted, user.id])
        } else if (userType === 'facility') {
          try {
            await rawConnection.query(`SELECT password_reset_token FROM facilities LIMIT 1`)
          } catch {
            await rawConnection.query(`
              ALTER TABLE facilities 
              ADD COLUMN password_reset_token varchar(255) NULL,
              ADD COLUMN password_reset_expires datetime NULL
            `)
          }
          
          await rawConnection.query(`
            UPDATE facilities 
            SET password_reset_token = ?, 
                password_reset_expires = ?
            WHERE id = ?
          `, [resetToken, resetExpiresFormatted, user.id])
        }
      } catch (error: any) {
        console.error('[Forgot Password] Error updating reset token:', error)
        // If it's still a column error, return proper message
        if (error?.code === 'ER_BAD_FIELD_ERROR') {
          return NextResponse.json({
            success: false,
            error: 'Password reset feature is not available yet. Please contact support.',
          }, { status: 503 })
        }
        throw error
      }

      // Send password reset email
      await sendPasswordResetEmail({
        to: normalizedEmail,
        name: userName,
        resetToken,
      })
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    })
  } catch (error) {
    console.error('Error in forgot password:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

