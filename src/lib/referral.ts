/**
 * Referral program utilities
 */

import { randomBytes } from 'crypto'

/**
 * Generate a unique referral code for a facility
 * Format: REF + 8 alphanumeric characters (uppercase)
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing characters like 0, O, I, 1
  let code = 'REF'
  
  // Generate 8 random characters
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    code += chars[randomIndex]
  }
  
  return code
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  return /^REF[A-Z0-9]{8}$/.test(code)
}
