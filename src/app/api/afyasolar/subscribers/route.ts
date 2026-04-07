import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarSubscribers } from '@/lib/db/afyasolar-subscribers-schema'
import { eq, and, desc, like, or } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schemas
const createSubscriberSchema = z.object({
  facilityId: z.string().uuid(),
  packageId: z.string(),
  packageName: z.string(),
  packageCode: z.string(),
  packageRatedKw: z.number().positive(),
  planType: z.enum(['CASH', 'INSTALLMENT', 'PAAS']),
  totalPackagePrice: z.number().positive(),
  paymentMethod: z.enum(['MNO', 'BANK', 'INVOICE', 'CASH']).optional(),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  contractDurationMonths: z.number().int().min(1).max(60).optional(),
})

const updateSubscriberSchema = z.object({
  paymentStatus: z.enum(['pending', 'completed', 'failed']).optional(),
  subscriptionStatus: z.enum(['active', 'expired', 'suspended', 'cancelled']).optional(),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  systemStatus: z.enum(['active', 'inactive', 'maintenance']).optional(),
  systemHealth: z.enum(['optimal', 'warning', 'critical']).optional(),
  installationStatus: z.enum(['pending', 'scheduled', 'completed']).optional(),
  notes: z.string().optional(),
  adminNotes: z.string().optional(),
})

/**
 * GET /api/afyasolar/subscribers
 * Fetch Afya Solar subscribers with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const facilityId = searchParams.get('facilityId')
    const packageCode = searchParams.get('packageCode')
    const subscriptionStatus = searchParams.get('subscriptionStatus')
    const paymentStatus = searchParams.get('paymentStatus')
    const planType = searchParams.get('planType')
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    // Build query conditions
    const conditions = []
    if (facilityId) {
      conditions.push(eq(afyaSolarSubscribers.facilityId, facilityId))
    }
    if (packageCode) {
      conditions.push(eq(afyaSolarSubscribers.packageCode, packageCode))
    }
    if (subscriptionStatus) {
      conditions.push(eq(afyaSolarSubscribers.subscriptionStatus, subscriptionStatus))
    }
    if (paymentStatus) {
      conditions.push(eq(afyaSolarSubscribers.paymentStatus, paymentStatus))
    }
    if (planType) {
      conditions.push(eq(afyaSolarSubscribers.planType, planType))
    }
    if (search) {
      conditions.push(or(
        like(afyaSolarSubscribers.facilityName, `%${search}%`),
        like(afyaSolarSubscribers.packageName, `%${search}%`),
        like(afyaSolarSubscribers.packageCode, `%${search}%`)
      ))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch subscribers
    const subscribers = await db
      .select()
      .from(afyaSolarSubscribers)
      .where(whereCondition)
      .orderBy(desc(afyaSolarSubscribers.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const totalCount = await db
      .select({ count: afyaSolarSubscribers.id })
      .from(afyaSolarSubscribers)
      .where(whereCondition)

    return NextResponse.json({
      success: true,
      data: {
        subscribers,
        pagination: {
          page,
          limit,
          total: totalCount.length,
          pages: Math.ceil(totalCount.length / limit)
        }
      }
    })

  } catch (error) {
    console.error('Error fetching Afya Solar subscribers:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/afyasolar/subscribers
 * Create a new Afya Solar subscriber
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSubscriberSchema.parse(body)

    // Check if facility already has a subscription
    const existingSubscriber = await db
      .select()
      .from(afyaSolarSubscribers)
      .where(eq(afyaSolarSubscribers.facilityId, validatedData.facilityId))
      .limit(1)

    if (existingSubscriber.length > 0) {
      return NextResponse.json(
        { error: 'Facility already has an Afya Solar subscription' },
        { status: 409 }
      )
    }

    // Create new subscriber record
    const [newSubscriber] = await db.insert(afyaSolarSubscribers).values({
      ...validatedData,
      subscriptionStatus: 'active',
      isActive: 1,
      subscriptionStartDate: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      systemStatus: 'pending_install',
      systemHealth: 'optimal',
      installationStatus: 'pending',
      contractStatus: 'active',
      minimumTermMonths: 12,
      autoRenew: 1,
      packageSpecs: {
        // Default package specs based on package type
        '2KW': {
          panels: '4 x 550W',
          battery: '2.56 kWh',
          inverter: '24V / 2 kW hybrid',
          dailyOutput: '6-8 kWh',
          backupHours: '6-10 hours'
        },
        '4.2KW': {
          panels: '6 x 550W',
          battery: '5.12 kWh',
          inverter: '48V / 4.2 kW hybrid',
          dailyOutput: '10-14 kWh',
          backupHours: '8-12 hours'
        },
        '6KW': {
          panels: '10 x 550W',
          battery: '10.24 kWh',
          inverter: '48V / 6 kW hybrid',
          dailyOutput: '18-22 kWh',
          backupHours: '12-18 hours'
        },
        '10KW': {
          panels: '16 x 550W',
          battery: '20.48 kWh',
          inverter: '48V / 10 kW hybrid',
          dailyOutput: '30-36 kWh',
          backupHours: '18-24 hours'
        }
      }[validatedData.packageCode] || {},
      paymentHistory: [],
      bills: [],
      metadata: {
        createdBy: session.user.email,
        source: 'dashboard'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        subscriber: {
          id: newSubscriber.insertId,
          ...validatedData
        }
      },
      message: 'Afya Solar subscription created successfully'
    })

  } catch (error) {
    console.error('Error creating Afya Solar subscriber:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
