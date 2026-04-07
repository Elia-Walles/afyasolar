import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db, getRawConnection } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { facilitySchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updateBookingSchema = z.object({
  facilityId: z.string().uuid().optional(),
  bookingSlug: z.string().max(100).optional(),
  isBookingEnabled: z.boolean().optional(),
  bookingWhatsappNumber: z.string().max(30).optional().nullable(),
})

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/**
 * GET /api/facilities
 * Get all facilities (admin only) or user's facility
 * Public access allowed for technician signup
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Allow public access for technician signup (to select facility)
    // Otherwise require authentication
    if (!session) {
      // Public access: return all facilities for technician signup
      const allFacilities = await db.select({
        id: facilities.id,
        name: facilities.name,
        city: facilities.city,
        region: facilities.region,
        category: facilities.category,
      }).from(facilities).orderBy(desc(facilities.createdAt))
      return NextResponse.json({ success: true, data: allFacilities })
    }

    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('id')

    // If facility ID is provided, get specific facility
    if (facilityId) {
      try {
        // Select all columns explicitly to handle potential missing columns gracefully
        const facility = await db
          .select({
            id: facilities.id,
            name: facilities.name,
            address: facilities.address,
            city: facilities.city,
            region: facilities.region,
            phone: facilities.phone,
            email: facilities.email,
            status: facilities.status,
            paymentModel: facilities.paymentModel,
            creditBalance: facilities.creditBalance,
            monthlyConsumption: facilities.monthlyConsumption,
            createdAt: facilities.createdAt,
            updatedAt: facilities.updatedAt,
            // These may not exist in older databases, but we'll try to select them
            regionId: facilities.regionId,
            districtId: facilities.districtId,
            // Booking system fields
            isBookingEnabled: facilities.isBookingEnabled,
            bookingSlug: facilities.bookingSlug,
            bookingWhatsappNumber: facilities.bookingWhatsappNumber,
            logoUrl: facilities.logoUrl,
            category: facilities.category,
            latitude: facilities.latitude,
            longitude: facilities.longitude,
          })
          .from(facilities)
          .where(eq(facilities.id, facilityId))
          .limit(1)

        if (!facility[0]) {
          return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
        }

        // Check access: admin can access any, facility users can only access their own
        if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        return NextResponse.json({ success: true, data: facility[0] })
      } catch (error: any) {
        // If logo_url column doesn't exist, try without it
        if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage?.includes('logo_url')) {
          const facility = await db
            .select({
              id: facilities.id,
              name: facilities.name,
              address: facilities.address,
              city: facilities.city,
              region: facilities.region,
              phone: facilities.phone,
              email: facilities.email,
              status: facilities.status,
              paymentModel: facilities.paymentModel,
              creditBalance: facilities.creditBalance,
              monthlyConsumption: facilities.monthlyConsumption,
              createdAt: facilities.createdAt,
              updatedAt: facilities.updatedAt,
              regionId: facilities.regionId,
              districtId: facilities.districtId,
              isBookingEnabled: facilities.isBookingEnabled,
              bookingSlug: facilities.bookingSlug,
              bookingWhatsappNumber: facilities.bookingWhatsappNumber,
            })
            .from(facilities)
            .where(eq(facilities.id, facilityId))
            .limit(1)

          if (!facility[0]) {
            return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
          }

          // Check access
          if (session.user.role !== 'admin' && session.user.facilityId !== facilityId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          }

          return NextResponse.json({ success: true, data: { ...facility[0], logoUrl: null } })
        }
        throw error
      }
    }

    // Admin can see all facilities
    if (session.user.role === 'admin') {
      const allFacilities = await db
        .select({
          id: facilities.id,
          name: facilities.name,
          address: facilities.address,
          city: facilities.city,
          region: facilities.region,
          phone: facilities.phone,
          email: facilities.email,
          status: facilities.status,
          paymentModel: facilities.paymentModel,
          creditBalance: facilities.creditBalance,
          monthlyConsumption: facilities.monthlyConsumption,
          createdAt: facilities.createdAt,
          updatedAt: facilities.updatedAt,
          isBookingEnabled: facilities.isBookingEnabled,
          bookingSlug: facilities.bookingSlug,
          bookingWhatsappNumber: facilities.bookingWhatsappNumber,
          logoUrl: facilities.logoUrl,
          latitude: facilities.latitude,
          longitude: facilities.longitude,
        })
        .from(facilities)
        .orderBy(desc(facilities.createdAt))
      return NextResponse.json({ success: true, data: allFacilities })
    }

    // Facility users can only see their own facility
    if (session.user.facilityId) {
      const facility = await db
        .select({
          id: facilities.id,
          name: facilities.name,
          address: facilities.address,
          city: facilities.city,
          region: facilities.region,
          phone: facilities.phone,
          email: facilities.email,
          status: facilities.status,
          paymentModel: facilities.paymentModel,
          creditBalance: facilities.creditBalance,
          monthlyConsumption: facilities.monthlyConsumption,
          createdAt: facilities.createdAt,
          updatedAt: facilities.updatedAt,
          // Booking system fields
          isBookingEnabled: facilities.isBookingEnabled,
          bookingSlug: facilities.bookingSlug,
          bookingWhatsappNumber: facilities.bookingWhatsappNumber,
          logoUrl: facilities.logoUrl,
        })
        .from(facilities)
        .where(eq(facilities.id, session.user.facilityId))
        .limit(1)

      return NextResponse.json({ success: true, data: facility[0] || null })
    }

    return NextResponse.json({ success: true, data: null })
  } catch (error) {
    console.error('Error fetching facilities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/facilities
 * Create a new facility (admin only, or public during signup)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Allow public facility creation during signup (no session required)
    // Or admin can create facilities
    const isPublicSignup = !session
    const isAdmin = session?.user.role === 'admin'

    if (!isPublicSignup && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = facilitySchema.parse(body)

    // Handle password - hash if provided, otherwise generate a temporary one
    let hashedPassword: string
    if (validatedData.password) {
      hashedPassword = await bcrypt.hash(validatedData.password, 10)
    } else {
      // Generate a temporary password for admin-created facilities
      const tempPassword = randomUUID().replace(/-/g, '').substring(0, 16)
      hashedPassword = await bcrypt.hash(tempPassword, 10)
    }

    const facilityId = randomUUID()
    
    // Build insert values object
    // IMPORTANT: Do not include regionId and districtId if they're null/undefined
    // to avoid errors if these columns don't exist in the database yet
    const facilityValues: any = {
      id: facilityId,
      name: validatedData.name,
      address: validatedData.address,
      city: validatedData.city,
      region: validatedData.region,
      phone: validatedData.phone,
      email: validatedData.email,
      password: hashedPassword,
      // paymentModel is optional, will be set later if not provided
      ...(validatedData.paymentModel && { paymentModel: validatedData.paymentModel }),
      emailVerified: true,
      status: 'active',
      creditBalance: '0.00',
      monthlyConsumption: '0.00',
      // Include location coordinates if provided (with validation)
      ...(validatedData.latitude !== undefined && 
          validatedData.latitude !== null && 
          !isNaN(Number(validatedData.latitude)) &&
          Number(validatedData.latitude) >= -90 &&
          Number(validatedData.latitude) <= 90 && { latitude: Number(validatedData.latitude) }),
      ...(validatedData.longitude !== undefined && 
          validatedData.longitude !== null && 
          !isNaN(Number(validatedData.longitude)) &&
          Number(validatedData.longitude) >= -180 &&
          Number(validatedData.longitude) <= 180 && { longitude: Number(validatedData.longitude) }),
    }
    
    // Only include regionId and districtId if they have actual numeric values
    // This prevents errors if these columns don't exist in the database yet
    const regionId = (validatedData as any).regionId
    const districtId = (validatedData as any).districtId
    if (regionId !== undefined && regionId !== null && typeof regionId === 'number') {
      facilityValues.regionId = regionId
    }
    if (districtId !== undefined && districtId !== null && typeof districtId === 'number') {
      facilityValues.districtId = districtId
    }

    // Try to insert, and if it fails due to missing columns, use raw SQL without regionId/districtId
    try {
      await db.insert(facilities).values(facilityValues)
    } catch (error: any) {
      // If error is about missing region_id or district_id columns, use raw SQL
      if (error?.code === 'ER_BAD_FIELD_ERROR' && 
          (error?.sqlMessage?.includes('region_id') || error?.sqlMessage?.includes('district_id'))) {
        console.warn('[Facility Creation] region_id/district_id columns not found, using raw SQL insert without them')
        
        // Use raw SQL to insert without region_id and district_id columns
        // Include latitude and longitude if available
        const rawConnection = getRawConnection()
        const hasLatitude = validatedData.latitude !== undefined && 
                            validatedData.latitude !== null && 
                            !isNaN(Number(validatedData.latitude)) &&
                            Number(validatedData.latitude) >= -90 &&
                            Number(validatedData.latitude) <= 90
        const hasLongitude = validatedData.longitude !== undefined && 
                             validatedData.longitude !== null && 
                             !isNaN(Number(validatedData.longitude)) &&
                             Number(validatedData.longitude) >= -180 &&
                             Number(validatedData.longitude) <= 180
        
        // Build dynamic SQL based on available fields
        let sqlFields = `id, name, address, city, region, phone, email, password, 
            email_verified, status, payment_model, credit_balance, monthly_consumption`
        let sqlValues = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`
        const sqlParams: any[] = [
          facilityId,
          validatedData.name,
          validatedData.address || '',
          validatedData.city,
          validatedData.region,
          validatedData.phone,
          validatedData.email,
          hashedPassword,
          true,
          'active',
          validatedData.paymentModel || null,
          '0.00',
          '0.00',
        ]
        
        // Add latitude and longitude if available
        if (hasLatitude) {
          sqlFields += ', latitude'
          sqlValues += ', ?'
          sqlParams.push(Number(validatedData.latitude))
        }
        if (hasLongitude) {
          sqlFields += ', longitude'
          sqlValues += ', ?'
          sqlParams.push(Number(validatedData.longitude))
        }
        
        sqlFields += ', created_at, updated_at'
        sqlValues += ', NOW(), NOW()'
        
        await rawConnection.query(`
          INSERT INTO facilities (${sqlFields}) VALUES (${sqlValues})
        `, sqlParams)
      } else {
        // Re-throw if it's a different error
        throw error
      }
    }

    // Fetch the created facility (MySQL doesn't support RETURNING)
    const [newFacility] = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        address: facilities.address,
        city: facilities.city,
        region: facilities.region,
        phone: facilities.phone,
        email: facilities.email,
        status: facilities.status,
        paymentModel: facilities.paymentModel,
        creditBalance: facilities.creditBalance,
        monthlyConsumption: facilities.monthlyConsumption,
        createdAt: facilities.createdAt,
        updatedAt: facilities.updatedAt,
        regionId: facilities.regionId,
        districtId: facilities.districtId,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!newFacility) {
      throw new Error('Failed to retrieve created facility')
    }

    return NextResponse.json({ success: true, data: newFacility }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error creating facility:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/facilities
 * Update facility booking settings (slug, enable toggle, whatsapp number)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateBookingSchema.parse(body)

    const targetFacilityId = parsed.facilityId || session.user.facilityId
    if (!targetFacilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    // Only admins or the facility itself can update booking settings
    if (session.user.role !== 'admin' && session.user.facilityId !== targetFacilityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingFacility = await db
      .select({
        id: facilities.id,
        currentSlug: facilities.bookingSlug,
      })
      .from(facilities)
      .where(eq(facilities.id, targetFacilityId))
      .limit(1)

    if (!existingFacility[0]) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    const updates: Record<string, any> = {}

    if (parsed.bookingSlug !== undefined) {
      const normalizedSlug = slugify(parsed.bookingSlug)
      if (!normalizedSlug || normalizedSlug.length < 3) {
        return NextResponse.json({ error: 'Booking slug must contain at least 3 alphanumeric characters' }, { status: 400 })
      }

      // Make sure slug is unique
      const existingSlug = await db
        .select({ id: facilities.id })
        .from(facilities)
        .where(eq(facilities.bookingSlug, normalizedSlug))
        .limit(1)

      if (existingSlug[0] && existingSlug[0].id !== targetFacilityId) {
        return NextResponse.json({ error: 'This booking slug is already in use' }, { status: 409 })
      }

      updates.bookingSlug = normalizedSlug
    }

    if (parsed.isBookingEnabled !== undefined) {
      // Require slug if enabling booking
      const slugToUse = updates.bookingSlug ?? existingFacility[0].currentSlug
      if (parsed.isBookingEnabled && !slugToUse) {
        return NextResponse.json({ error: 'Set a booking slug before enabling booking' }, { status: 400 })
      }
      updates.isBookingEnabled = parsed.isBookingEnabled
    }

    if (parsed.bookingWhatsappNumber !== undefined) {
      const sanitizedWhatsapp = parsed.bookingWhatsappNumber?.trim()
      updates.bookingWhatsappNumber = sanitizedWhatsapp || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid booking fields provided' }, { status: 400 })
    }

    updates.updatedAt = new Date()

    await db
      .update(facilities)
      .set(updates)
      .where(eq(facilities.id, targetFacilityId))

    const [updatedFacility] = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        address: facilities.address,
        city: facilities.city,
        region: facilities.region,
        phone: facilities.phone,
        email: facilities.email,
        status: facilities.status,
        paymentModel: facilities.paymentModel,
        creditBalance: facilities.creditBalance,
        monthlyConsumption: facilities.monthlyConsumption,
        createdAt: facilities.createdAt,
        updatedAt: facilities.updatedAt,
        isBookingEnabled: facilities.isBookingEnabled,
        bookingSlug: facilities.bookingSlug,
        bookingWhatsappNumber: facilities.bookingWhatsappNumber,
        logoUrl: facilities.logoUrl,
      })
      .from(facilities)
      .where(eq(facilities.id, targetFacilityId))
      .limit(1)

    return NextResponse.json({ success: true, data: updatedFacility })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error updating booking settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

