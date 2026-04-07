import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { getVerificationCode, deleteVerificationCode, verifiedEmails } from '@/lib/verification-store'

/**
 * POST /api/auth/verify-code
 * Verify the 6-digit code sent via email
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 10 })
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
        }
      }
    )
  }

  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json({ error: 'Email address and code are required' }, { status: 400 })
    }

    // Normalize email (trim and lowercase)
    const normalizedEmail = email.toLowerCase().trim()
    
    // Normalize code (trim and ensure it's a string)
    const normalizedCode = String(code).trim()

    console.log('[Verify Code] Attempting verification for:', normalizedEmail, 'Code:', normalizedCode)

    if (normalizedCode.length !== 6 || !/^\d{6}$/.test(normalizedCode)) {
      console.log('[Verify Code] Invalid code format:', normalizedCode)
      return NextResponse.json({ error: 'Verification code must be 6 digits' }, { status: 400 })
    }

    const stored = await getVerificationCode(normalizedEmail)

    if (!stored) {
      console.log('[Verify Code] No valid, unexpired code found for email:', normalizedEmail)
      return NextResponse.json({ 
        error: 'No valid verification code found or code has expired. Please request a new code.' 
      }, { status: 400 })
    }

    console.log('[Verify Code] Found stored code. Expected:', normalizedCode, 'Match:', stored.code === normalizedCode)

    if (new Date() > stored.expiresAt) {
      await deleteVerificationCode(normalizedEmail, normalizedCode)
      return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 })
    }

    if (stored.code !== normalizedCode) {
      console.log('[Verify Code] Code mismatch. Stored:', stored.code, 'Received:', normalizedCode)
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Code is valid - mark it as used and mark email as verified
    const marked = await deleteVerificationCode(normalizedEmail, normalizedCode)
    
    if (marked) {
      verifiedEmails.add(normalizedEmail) // Track that this email was verified via code
      console.log('[Verify Code] Verification successful for:', normalizedEmail)
      console.log('[Verify Code] Added to verifiedEmails Set. Set size:', verifiedEmails.size, 'Has email:', verifiedEmails.has(normalizedEmail))
    } else {
      console.error('[Verify Code] Failed to mark code as used for:', normalizedEmail)
      return NextResponse.json({ 
        error: 'Failed to complete verification. Please try again.' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    console.error('Error verifying code:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

