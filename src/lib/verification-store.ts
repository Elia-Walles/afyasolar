import { verificationStoreDb } from './verification-store-db'

/**
 * Track emails that have been verified via code (for signup flow)
 * This is still in-memory but could be moved to the database if needed
 */
export const verifiedEmails = new Set<string>()

// Keep verifiedPhoneNumbers for backward compatibility in case it's used elsewhere
export const verifiedPhoneNumbers = new Set<string>()

/**
 * @deprecated Use verificationStoreDb directly instead
 */
export function getVerificationCodes() {
  console.warn('getVerificationCodes() is deprecated. Use verificationStoreDb directly instead.')
  return new Map()
}

/**
 * Store a verification code in the database
 */
export async function storeVerificationCode(email: string, code: string, expiresAt: number): Promise<void> {
  await verificationStoreDb.storeVerificationCode(email, code, expiresAt)
}

/**
 * Get a verification code from the database
 */
export async function getVerificationCode(email: string) {
  return verificationStoreDb.getVerificationCode(email)
}

/**
 * Mark a verification code as used in the database
 */
export async function deleteVerificationCode(email: string, code: string): Promise<boolean> {
  return verificationStoreDb.markCodeAsUsed(email, code)
}

/**
 * Clear expired codes from the database
 */
export async function clearExpiredCodes(): Promise<void> {
  await verificationStoreDb.cleanupExpiredCodes()
}

