import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db, getRawConnection } from '@/lib/db'
import { users, facilities, admins } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { registerSchema, publicRegisterSchema } from '@/lib/validations'
import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes } from 'crypto'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit-log'
import { notificationCreators } from '@/lib/notifications/event-notifications'

/**
 * POST /api/users
 * Register a new user (public endpoint)
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request)
  const rateLimitResult = rateLimit(clientId, { windowMs: 60 * 1000, maxRequests: 5 })
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        }
      }
    )
  }

  try {
    const body = await request.json()
    const session = await getServerSession(authOptions)
    const isAdmin = session?.user.role === 'admin'
    const isFacility = session?.user.role === 'facility' && session?.user.facilityId
    
    // Check if this is a facility creating a sub-user (has facilityId in body and session has facilityId)
    const isFacilityCreatingUser = isFacility && 
                                   body.facilityId && 
                                   body.facilityId === session.user.facilityId &&
                                   !body.password &&
                                   !body.facilityInfo
    
    // If facility is creating a user, handle it separately
    if (isFacilityCreatingUser) {
      // Validate required fields for facility-created users
      if (!body.name || !body.email || !body.phone) {
        return NextResponse.json({ 
          error: 'Validation failed', 
          message: 'Name, email, and phone are required'
        }, { status: 400 })
      }

      // Generate a random password for the user (they can reset it later)
      const randomPassword = randomBytes(16).toString('hex')
      const hashedPassword = await bcrypt.hash(randomPassword, 10)
      
      const normalizedEmail = body.email?.toLowerCase().trim()
      const normalizedPhone = body.phone?.replace(/\s/g, '')
      
      // Check if user already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      if (existing[0]) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
      }

      // Create user in users table with role 'facility'
      // The sub-role (store-manager, pharmacy-manager, etc.) is stored in subRole field
      const userId = randomUUID()
      
      await db
        .insert(users)
        .values({
          id: userId,
          email: normalizedEmail,
          name: body.name,
          password: hashedPassword,
          role: 'facility', // Set to 'facility' for authentication
          facilityId: body.facilityId,
          phone: normalizedPhone || null,
          emailVerified: true, // Skip verification for facility-created users
          subRole: body.role, // Store the sub-role (store-manager, pharmacy-manager, etc.)
          department: body.department || null, // Store department information
        })

      // Fetch the created user
      const [newUser] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          facilityId: users.facilityId,
          phone: users.phone,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!newUser) {
        throw new Error('Failed to retrieve created user')
      }

      // Audit log
      await logAudit({
        userId: session?.user?.id,
        action: 'user_created',
        resource: 'user',
        resourceId: newUser.id,
        details: { 
          email: newUser.email, 
          role: body.role || 'facility',
          createdBy: 'facility',
          facilityId: body.facilityId
        },
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      })

      // Trigger admin notification for new user registration
      try {
        let facilityName = undefined
        if (newUser.facilityId) {
          const facilityData = await db
            .select({ name: facilities.name })
            .from(facilities)
            .where(eq(facilities.id, newUser.facilityId))
            .limit(1)
          facilityName = facilityData[0]?.name
        }
        
        await notificationCreators.userRegistered({
          userName: newUser.name,
          userEmail: newUser.email,
          userRole: newUser.role,
          facilityName,
        })
      } catch (notificationError) {
        console.error('Failed to create user registration notification:', notificationError)
        // Don't fail the registration if notification fails
      }

      return NextResponse.json(
        { 
          success: true, 
          data: { 
            ...newUser, 
            subRole: body.role, // Include sub-role (store-manager, pharmacy-manager, etc.)
            department: body.department || null,
            status: body.status || 'active',
          },
          message: 'User created successfully',
        },
        { status: 201 }
      )
    }
    
    // Validate the request body for regular registration
    // Use publicRegisterSchema for public signup, registerSchema for admin-created users
    const schemaToUse = isAdmin ? registerSchema : publicRegisterSchema
    const validationResult = schemaToUse.safeParse(body)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))
      console.error('[Registration] Validation failed:', {
        isAdmin,
        errors,
        bodyKeys: Object.keys(body),
        bodyHasFacilityInfo: 'facilityInfo' in body,
      })
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: errors,
        message: errors.map(e => `${e.field}: ${e.message}`).join(', ')
      }, { status: 400 })
    }
    
    const validatedData = validationResult.data
    
    // Log for debugging
    console.log('[Registration] Validation passed:', {
      isAdmin,
      hasFacilityInfo: 'facilityInfo' in validatedData,
      validatedDataKeys: Object.keys(validatedData),
    })

    // Determine the role based on which schema was used
    // publicRegisterSchema doesn't have role (defaults to 'facility')
    // registerSchema has role field
    const userRole = 'role' in validatedData 
      ? validatedData.role 
      : 'facility' // Default to 'facility' for public signup

    // Public signup only allows 'facility' role
    // Admin accounts must be created by existing admins or via script
    if (userRole === 'admin') {
      if (!isAdmin) {
        return NextResponse.json({ 
          error: 'Admin accounts can only be created by system administrators.' 
        }, { status: 403 })
      }
    }
    
    // Public signup only allows facility role
    if (!isAdmin && userRole !== 'facility') {
      return NextResponse.json({ 
        error: 'Invalid role for public signup. Only facility accounts can be created publicly.' 
      }, { status: 403 })
    }

    // For email verification system, use email as primary identifier
    // Email is required for verification, phone is optional for facility contact information
    const normalizedPhone = 'phone' in validatedData && validatedData.phone
      ? validatedData.phone.replace(/\s/g, '')
      : null
    const normalizedEmail = validatedData.email?.toLowerCase().trim() || null // Email is required for verification
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Handle different user types
    if (userRole === 'facility') {
      // FACILITIES: Store directly in facilities table (not users table)
      // Check if facility already exists by phone number (primary identifier)
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Phone number is required for facility registration' }, { status: 400 })
      }
      
      const existingFacility = await db
        .select({
          id: facilities.id,
          email: facilities.email,
          name: facilities.name,
        })
        .from(facilities)
        .where(eq(facilities.phone, normalizedPhone))
        .limit(1)

      if (existingFacility[0]) {
        return NextResponse.json({ error: 'Facility with this phone number already exists' }, { status: 409 })
      }

      // For public signup, facilityInfo is required (it's part of publicRegisterSchema)
      // For admin-created facilities, facilityInfo might not be in validatedData (registerSchema doesn't include it)
      // So we need to check both validatedData and the raw body
      let facilityInfo = (validatedData as any).facilityInfo
      
      // If not in validatedData (admin using registerSchema), check raw body
      if (!facilityInfo && isAdmin && 'facilityInfo' in body) {
        facilityInfo = (body as any).facilityInfo
      }
      
      // Validate facilityInfo exists and has required fields
      if (!facilityInfo || typeof facilityInfo !== 'object') {
        console.error('[Registration] CRITICAL: Missing or invalid facilityInfo:', {
          isAdmin,
          hasFacilityInfoInValidated: 'facilityInfo' in validatedData,
          hasFacilityInfoInBody: 'facilityInfo' in body,
          facilityInfoType: typeof facilityInfo,
          facilityInfoValue: facilityInfo,
          validatedDataKeys: Object.keys(validatedData),
          bodyKeys: Object.keys(body),
          schemaUsed: isAdmin ? 'registerSchema' : 'publicRegisterSchema',
        })
        return NextResponse.json({ 
          error: 'Facility information is required',
          details: 'Please provide facility name, city, region, and phone number. Address is optional.',
          message: 'Validation error: facility information was not provided correctly.'
        }, { status: 400 })
      }

      // Validate required fields in facilityInfo (address is optional)
      const requiredFields = ['name', 'city', 'region', 'phone']
      const missingFields = requiredFields.filter(field => !facilityInfo[field] || facilityInfo[field].trim() === '')
      
      if (missingFields.length > 0) {
        console.error('[Registration] Missing required facility fields:', {
          missingFields,
          facilityInfo,
        })
        return NextResponse.json({ 
          error: 'Facility information is incomplete',
          details: `Missing required fields: ${missingFields.join(', ')}`,
          message: 'Please provide all required facility information.'
        }, { status: 400 })
      }

      console.log('[Registration] Creating facility:', {
        phone: normalizedPhone,
        email: normalizedEmail
      })

      // Create facility directly in facilities table
      const facilityId = randomUUID()
      // Email verification is no longer required for facility registration
      const emailVerifiedValue = true

      // At this point, facilityInfo should be guaranteed to exist
      if (!facilityInfo) {
        console.error('[Registration] Critical error: facilityInfo is null after validation check')
        return NextResponse.json({ 
          error: 'Internal server error: Facility information validation failed' 
        }, { status: 500 })
      }

      // Build insert values object
      // IMPORTANT: Do not include regionId and districtId if they're null/undefined
      // to avoid errors if these columns don't exist in the database yet
      const facilityValues: any = {
        id: facilityId,
        name: facilityInfo.name,
        address: facilityInfo.address || '', // Use empty string if address is not provided
        city: facilityInfo.city,
        region: facilityInfo.region,
        phone: facilityInfo.phone,
        email: normalizedEmail, // Optional email for facility contact
        password: hashedPassword, // Password for authentication
        emailVerified: emailVerifiedValue, // Set to true - verification no longer required
        acceptTerms: (validatedData as any).acceptTerms || false, // Store Terms & Conditions acceptance
        // paymentModel will be set later in Afya Solar dashboard, so it can be null
        ...(facilityInfo.paymentModel && { paymentModel: facilityInfo.paymentModel }),
        status: 'active',
        creditBalance: '0.00',
        monthlyConsumption: '0.00',
        // Include category if provided
        ...(facilityInfo.category && { category: facilityInfo.category }),
      }
      
      // Only include regionId and districtId if they have actual numeric values
      // This prevents errors if these columns don't exist in the database yet
      // We check for both undefined/null AND ensure they're valid numbers
      if (facilityInfo.regionId !== undefined && facilityInfo.regionId !== null && typeof facilityInfo.regionId === 'number') {
        facilityValues.regionId = facilityInfo.regionId
      }
      if (facilityInfo.districtId !== undefined && facilityInfo.districtId !== null && typeof facilityInfo.districtId === 'number') {
        facilityValues.districtId = facilityInfo.districtId
      }
      
      // Include GPS coordinates if provided (latitude and longitude)
      // These are important for map display and location services
      if (facilityInfo.latitude !== undefined && 
          facilityInfo.latitude !== null && 
          !isNaN(Number(facilityInfo.latitude)) &&
          Number(facilityInfo.latitude) >= -90 &&
          Number(facilityInfo.latitude) <= 90) {
        facilityValues.latitude = Number(facilityInfo.latitude)
      }
      if (facilityInfo.longitude !== undefined && 
          facilityInfo.longitude !== null && 
          !isNaN(Number(facilityInfo.longitude)) &&
          Number(facilityInfo.longitude) >= -180 &&
          Number(facilityInfo.longitude) <= 180) {
        facilityValues.longitude = Number(facilityInfo.longitude)
      }

      // Try to insert, and if it fails due to missing columns, use raw SQL without regionId/districtId
      try {
        await db.insert(facilities).values(facilityValues)
      } catch (error: any) {
        // If error is about missing region_id or district_id columns, use raw SQL
        if (error?.code === 'ER_BAD_FIELD_ERROR' && 
            (error?.sqlMessage?.includes('region_id') || error?.sqlMessage?.includes('district_id'))) {
          console.warn('[Registration] region_id/district_id columns not found, using raw SQL insert without them')
          
          // Use raw SQL to insert without region_id and district_id columns
          // Include latitude and longitude if available
          const rawConnection = getRawConnection()
          const hasLatitude = facilityInfo.latitude !== undefined && 
                              facilityInfo.latitude !== null && 
                              !isNaN(Number(facilityInfo.latitude)) &&
                              Number(facilityInfo.latitude) >= -90 &&
                              Number(facilityInfo.latitude) <= 90
          const hasLongitude = facilityInfo.longitude !== undefined && 
                               facilityInfo.longitude !== null && 
                               !isNaN(Number(facilityInfo.longitude)) &&
                               Number(facilityInfo.longitude) >= -180 &&
                               Number(facilityInfo.longitude) <= 180
          
          // Build dynamic SQL based on available fields
          let sqlFields = `id, name, address, city, region, phone, email, password, 
              email_verified, accept_terms, status, payment_model, credit_balance, monthly_consumption`
          let sqlValues = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`
          const sqlParams: any[] = [
            facilityId,
            facilityInfo.name,
            facilityInfo.address || '',
            facilityInfo.city,
            facilityInfo.region,
            facilityInfo.phone,
            normalizedEmail || null,
            hashedPassword,
            emailVerifiedValue,
            (validatedData as any).acceptTerms || false,
            'active',
            facilityInfo.paymentModel || 'payg',
            '0.00',
            '0.00',
          ]
          
          // Add latitude and longitude if available
          if (hasLatitude) {
            sqlFields += ', latitude'
            sqlValues += ', ?'
            sqlParams.push(Number(facilityInfo.latitude))
          }
          if (hasLongitude) {
            sqlFields += ', longitude'
            sqlValues += ', ?'
            sqlParams.push(Number(facilityInfo.longitude))
          }
          
          // Add category if provided
          if (facilityInfo.category) {
            sqlFields += ', category'
            sqlValues += ', ?'
            sqlParams.push(facilityInfo.category)
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

      // Get the newly created facility
      const newFacility = await db
        .select({
          id: facilities.id,
          email: facilities.email,
          name: facilities.name,
          status: facilities.status,
          emailVerified: facilities.emailVerified,
          createdAt: facilities.createdAt,
          updatedAt: facilities.updatedAt,
        })
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1)

      if (!newFacility) {
        throw new Error('Failed to retrieve created facility')
      }

      // Double-check emailVerified is set correctly - if not, update it
      const facilityEmailVerified = newFacility[0]?.emailVerified === true
      
      if (!facilityEmailVerified) {
        console.warn('[Registration] Facility emailVerified not set correctly, updating...')
        await db
          .update(facilities)
          .set({ emailVerified: true })
          .where(eq(facilities.id, facilityId))
        console.log('[Registration] Updated facility emailVerified to true')
      }

      console.log('[Registration] Facility verified and ready for login:', {
        id: newFacility[0].id,
        email: newFacility[0].email,
        emailVerified: newFacility[0].emailVerified
      })

      // Audit log
      await logAudit({
        userId: session?.user?.id,
        action: 'facility_created',
        resource: 'facility',
        resourceId: newFacility[0].id,
        details: { email: newFacility[0].email, emailVerified: true },
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      })

      // Trigger admin notification for new facility registration
      try {
        await notificationCreators.userRegistered({
          userName: newFacility[0].name,
          userEmail: newFacility[0].email || undefined,
          userRole: 'facility',
          facilityName: newFacility[0].name,
        })
      } catch (notificationError) {
        console.error('Failed to create facility registration notification:', notificationError)
        // Don't fail the registration if notification fails
      }

      return NextResponse.json(
        { 
          success: true, 
          data: { ...newFacility[0], role: 'facility' },
          message: 'Account created successfully! You can sign in now.',
          requiresVerification: false,
        },
        { 
          status: 201,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          }
        }
      )
    } else if (userRole === 'admin') {
      // ADMINS: Store in admins table (not users table)
      // Admin accounts still require email verification
      if (!normalizedEmail) {
        return NextResponse.json({ error: 'Email is required for admin accounts' }, { status: 400 })
      }
      
      // Check if admin already exists
      const existingAdmin = await db
        .select()
        .from(admins)
        .where(eq(admins.email, normalizedEmail))
        .limit(1)

      if (existingAdmin[0]) {
        return NextResponse.json({ error: 'Admin with this email already exists' }, { status: 409 })
      }

      // Generate email verification token (admins use verification link, not code)
      const verificationToken = randomBytes(32).toString('hex')
      const verificationExpires = new Date()
      verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

      // Create admin in admins table
      const adminId = randomUUID()
      await db.insert(admins).values({
        id: adminId,
        email: normalizedEmail,
        name: validatedData.name,
        password: hashedPassword,
        emailVerified: false, // Admins must verify via email link
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      })

      // Fetch the created admin
      const [newAdmin] = await db
        .select({
          id: admins.id,
          email: admins.email,
          name: admins.name,
          createdAt: admins.createdAt,
          updatedAt: admins.updatedAt,
        })
        .from(admins)
        .where(eq(admins.id, adminId))
        .limit(1)

      if (!newAdmin) {
        throw new Error('Failed to retrieve created admin')
      }

      // Send verification email
      try {
        await sendVerificationEmail({
          to: normalizedEmail,
          name: validatedData.name,
          verificationToken,
        })
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Continue with registration even if email fails
      }

      // Audit log
      await logAudit({
        userId: session?.user?.id,
        action: 'admin_created',
        resource: 'admin',
        resourceId: newAdmin.id,
        details: { email: newAdmin.email },
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      })

      // Trigger admin notification for new admin registration
      try {
        await notificationCreators.userRegistered({
          userName: newAdmin.name,
          userEmail: newAdmin.email,
          userRole: 'admin',
        })
      } catch (notificationError) {
        console.error('Failed to create admin registration notification:', notificationError)
        // Don't fail the registration if notification fails
      }

      return NextResponse.json(
        { 
          success: true, 
          data: { ...newAdmin, role: 'admin' },
          message: 'Admin account created successfully. Please check your email to verify your account.',
          requiresVerification: true,
        },
        { 
          status: 201,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          }
        }
      )
    } else {
      // TECHNICIANS/ONBOARDING: Store in users table (not facilities or admins)
      // For non-facility roles, email is still required
      if (!normalizedEmail) {
        return NextResponse.json({ error: 'Email is required for this account type' }, { status: 400 })
      }
      
      // Check if user already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      if (existing[0]) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
      }

      // Generate email verification token
      const verificationToken = randomBytes(32).toString('hex')
      const verificationExpires = new Date()
      verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

      // Create user in users table
      const userId = randomUUID()
      const facilityId = 'facilityId' in validatedData ? validatedData.facilityId || null : null
      
      await db
        .insert(users)
        .values({
          id: userId,
          email: normalizedEmail,
          name: validatedData.name,
          password: hashedPassword,
          role: userRole,
          facilityId: facilityId,
          emailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
        })

      // Fetch the created user
      const [newUser] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          facilityId: users.facilityId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!newUser) {
        throw new Error('Failed to retrieve created user')
      }

      // Send verification email
      try {
        await sendVerificationEmail({
          to: normalizedEmail,
          name: validatedData.name,
          verificationToken,
        })
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Continue with registration even if email fails
      }

      // Audit log
      await logAudit({
        userId: session?.user?.id,
        action: 'user_created',
        resource: 'user',
        resourceId: newUser.id,
        details: { email: newUser.email, role: newUser.role },
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      })

      return NextResponse.json(
        { 
          success: true, 
          data: newUser,
          message: 'Account created successfully. Please check your email to verify your account.',
          requiresVerification: true,
        },
        { 
          status: 201,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          }
        }
      )
    }
  } catch (error) {
    // Audit log error
    const session = await getServerSession(authOptions)
    await logAudit({
      userId: session?.user?.id,
      action: 'user_created',
      resource: 'user',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      ipAddress: getClientIdentifier(request),
      userAgent: request.headers.get('user-agent') || undefined,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error }, { status: 400 })
    }
    console.error('Error creating user:', error)
    
    // Provide more detailed error information in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && errorStack && { stack: errorStack })
    }, { status: 500 })
  }
}

/**
 * GET /api/users
 * Get users and admins
 * - Admin can view all users
 * - Facility users can view users in their facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let facilityId = searchParams.get('facilityId')
    const role = searchParams.get('role')

    // If user is facility, they can only view their own facility's users
    if (session.user.role === 'facility' && session.user.facilityId) {
      facilityId = session.user.facilityId
    } else if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch users
    const userConditions = []
    if (facilityId) {
      userConditions.push(eq(users.facilityId, facilityId))
    }
    if (role) {
      userConditions.push(eq(users.role, role))
    }

    let userQuery = db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      facilityId: users.facilityId,
      phone: users.phone,
      emailVerified: users.emailVerified,
      invitationSentAt: users.invitationSentAt,
      invitationCount: users.invitationCount,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      subRole: users.subRole, // Include sub-role
      department: users.department, // Include department
    }).from(users)

    if (userConditions.length > 0) {
      userQuery = userQuery.where(and(...userConditions)) as any
    }

    const userList = await userQuery

    // Fetch admins
    const adminList = await db.select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      emailVerified: admins.emailVerified,
      invitationSentAt: admins.invitationSentAt,
      invitationCount: admins.invitationCount,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt,
    }).from(admins)

    // Combine users and admins, adding type field and role for admins
    const allUsers = [
      ...userList.map(user => ({ ...user, type: 'user' as const })),
      ...adminList.map(admin => ({ 
        ...admin, 
        type: 'admin' as const,
        role: 'admin',
        facilityId: null,
      }))
    ]

    // Apply role filter to combined list if needed
    let filteredList = allUsers
    if (role && role !== 'all') {
      filteredList = allUsers.filter(item => item.role === role)
    }

    return NextResponse.json({ success: true, data: filteredList })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

