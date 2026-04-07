import { db } from './db'
import { eq, and, gte, lte } from 'drizzle-orm'
import { verificationCodes } from './db/schema'

interface VerificationCodeData {
  code: string
  expiresAt: Date
  email: string
}

export const verificationStoreDb = {
  /**
   * Store a verification code in the database
   */
  async storeVerificationCode(email: string, code: string, expiresAt: number): Promise<void> {
    try {
      // Clean up any existing codes for this email
      await db.delete(verificationCodes)
        .where(eq(verificationCodes.email, email))

      // Store the new code
      await db.insert(verificationCodes).values({
        email,
        code,
        expiresAt: new Date(expiresAt),
        used: false
      })

      console.log(`[Verification DB] Stored code for: ${email} (expires: ${new Date(expiresAt).toISOString()})`)
    } catch (error) {
      console.error('[Verification DB] Error storing verification code:', error)
      throw new Error('Failed to store verification code')
    }
  },

  /**
   * Get a verification code from the database
   */
  async getVerificationCode(email: string): Promise<VerificationCodeData | null> {
    try {
      const now = new Date()
      
      // Find the most recent unused, unexpired code for this email
      const result = await db.select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.email, email),
            eq(verificationCodes.used, false),
            gte(verificationCodes.expiresAt, now)
          )
        )
        .orderBy(verificationCodes.createdAt)
        .limit(1)

      if (result.length === 0) {
        console.log(`[Verification DB] No valid code found for: ${email}`)
        return null
      }

      const codeData = result[0]
      console.log(`[Verification DB] Found code for: ${email} (expires: ${codeData.expiresAt.toISOString()})`)
      
      return {
        code: codeData.code,
        expiresAt: codeData.expiresAt,
        email: codeData.email
      }
    } catch (error) {
      console.error('[Verification DB] Error getting verification code:', error)
      return null
    }
  },

  /**
   * Mark a verification code as used
   */
  async markCodeAsUsed(email: string, code: string): Promise<boolean> {
    try {
      const result = await db.update(verificationCodes)
        .set({ 
          used: true,
          usedAt: new Date()
        })
        .where(
          and(
            eq(verificationCodes.email, email),
            eq(verificationCodes.code, code),
            eq(verificationCodes.used, false)
          )
        )

      const success = result[0].affectedRows > 0
      if (success) {
        console.log(`[Verification DB] Marked code as used for: ${email}`)
      } else {
        console.log(`[Verification DB] No valid unused code found to mark as used for: ${email}`)
      }
      
      return success
    } catch (error) {
      console.error('[Verification DB] Error marking code as used:', error)
      return false
    }
  },

  /**
   * Clean up expired verification codes
   */
  async cleanupExpiredCodes(): Promise<void> {
    try {
      // First, get the count of codes that will be deleted
      const expiredCodes = await db.select()
        .from(verificationCodes)
        .where(
          and(
            lte(verificationCodes.expiresAt, new Date()),
            eq(verificationCodes.used, false)
          )
        )
      
      // Then delete them
      await db.delete(verificationCodes)
        .where(
          and(
            lte(verificationCodes.expiresAt, new Date()),
            eq(verificationCodes.used, false)
          )
        )
      
      if (expiredCodes.length > 0) {
        console.log(`[Verification DB] Cleaned up ${expiredCodes.length} expired verification codes`)
      }
    } catch (error) {
      console.error('[Verification DB] Error cleaning up expired codes:', error)
    }
  }
}
