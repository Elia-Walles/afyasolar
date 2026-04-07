import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { sendVerificationCodeEmail } from '@/lib/email'
import { storeVerificationCode } from '@/lib/verification-store'
import { verificationStoreDb } from '@/lib/verification-store-db'

/**
 * POST /api/auth/send-verification-code
 * Send a 6-digit verification code via email
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 5 })
  
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
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    // Normalize email (trim and lowercase)
    const normalizedEmail = email.toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    // Store code in database
    await storeVerificationCode(normalizedEmail, code, expiresAt)
    
    // Clean up any expired codes
    await verificationStoreDb.cleanupExpiredCodes()

    // Send email
    try {
      const emailResult = await sendVerificationCodeEmail({
        to: normalizedEmail,
        code,
      })
      if (!emailResult) {
        // In development, if SMTP fails, log the code to console
        if (process.env.NODE_ENV === 'development') {
          console.log('\n📧 Email Verification Code (SMTP Failed - Development Mode):')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log(`To: ${normalizedEmail}`)
          console.log(`Verification Code: ${code}`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
          // Still return success in dev mode so testing can continue
          return NextResponse.json({
            success: true,
            message: 'Verification code sent to your email (check console in dev mode)',
            devMode: true,
            code: code, // Include code in dev mode for testing
          })
        }
        console.error('Failed to send verification code email')
        return NextResponse.json({
          error: 'Failed to send verification code. Please check your SMTP configuration.',
        }, { status: 500 })
      }
    } catch (emailError: any) {
      console.error('Failed to send verification code email:', emailError)
      
      // In development, log the code even if email fails
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📧 Email Verification Code (SMTP Error - Development Mode):')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`To: ${normalizedEmail}`)
        console.log(`Verification Code: ${code}`)
        console.log(`SMTP Error: ${emailError.message || emailError}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        // Return success in dev mode with code for testing
        return NextResponse.json({
          success: true,
          message: 'Verification code sent to your email (check console in dev mode)',
          devMode: true,
          code: code, // Include code in dev mode for testing
        })
      }
      
      return NextResponse.json({
        error: 'Failed to send verification code. Please check your SMTP configuration.',
        details: emailError.message || 'SMTP authentication failed',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    })
  } catch (error) {
    console.error('Error sending verification code:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

