import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { facilities, users, admins } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

/**
 * GET /api/auth/check-duplicates
 * Check if phone or email already exists in the system
 * Query parameters:
 * - phone: phone number to check (normalized format)
 * - email: email to check (normalized format)
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 20 })
  
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
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Either phone or email parameter is required' },
        { status: 400 }
      )
    }

    const duplicates = {
      phone: false,
      email: false,
      phoneIn: null as string[] | null,
      emailIn: null as string[] | null,
    }

    // Check phone number duplicates
    if (phone) {
      const normalizedPhone = phone.replace(/\s/g, '')
      
      // Check in facilities table
      const facilityPhoneCheck = await db
        .select({ phone: facilities.phone, name: facilities.name })
        .from(facilities)
        .where(eq(facilities.phone, normalizedPhone))
        .limit(1)

      // Check in users table
      const userPhoneCheck = await db
        .select({ phone: users.phone, name: users.name })
        .from(users)
        .where(eq(users.phone, normalizedPhone))
        .limit(1)

      duplicates.phone = facilityPhoneCheck.length > 0 || userPhoneCheck.length > 0
      if (duplicates.phone) {
        duplicates.phoneIn = [
          ...(facilityPhoneCheck.map(f => `Facility: ${f.name}`) || []),
          ...(userPhoneCheck.map(u => `User: ${u.name}`) || [])
        ]
      }
    }

    // Check email duplicates
    if (email) {
      const normalizedEmail = email.toLowerCase().trim()
      
      // Check in facilities table
      const facilityEmailCheck = await db
        .select({ email: facilities.email, name: facilities.name })
        .from(facilities)
        .where(eq(facilities.email, normalizedEmail))
        .limit(1)

      // Check in users table
      const userEmailCheck = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      // Check in admins table
      const adminEmailCheck = await db
        .select({ email: admins.email, name: admins.name })
        .from(admins)
        .where(eq(admins.email, normalizedEmail))
        .limit(1)

      duplicates.email = facilityEmailCheck.length > 0 || userEmailCheck.length > 0 || adminEmailCheck.length > 0
      if (duplicates.email) {
        duplicates.emailIn = [
          ...(facilityEmailCheck.map(f => `Facility: ${f.name}`) || []),
          ...(userEmailCheck.map(u => `User: ${u.name}`) || []),
          ...(adminEmailCheck.map(a => `Admin: ${a.name}`) || [])
        ]
      }
    }

    return NextResponse.json({
      success: true,
      duplicates,
      message: duplicates.phone || duplicates.email 
        ? 'Some information already exists in our system' 
        : 'No duplicates found'
    })

  } catch (error) {
    console.error('Error checking duplicates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
