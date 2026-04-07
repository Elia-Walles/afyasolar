import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarClientServices,
  afyaSolarServiceStatusHistory,
  afyaSolarPackages,
  afyaSolarPlans,
  afyaSolarPackageSpecs,
  afyaSolarPlanPricing,
  afyaSolarInstallmentContracts,
  afyaSolarInstallmentSchedule,
  afyaSolarEaasContracts,
  afyaSolarSmartmeters
} from '@/lib/db/afya-solar-schema'
import { facilities } from '@/lib/db/schema'
import { eq, and, desc, like, or } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schemas
const createServiceSchema = z.object({
  facilityId: z.string().uuid(),
  packageId: z.number().positive(),
  planId: z.number().positive(),
  siteName: z.string().optional(),
  serviceLocation: z.string().optional(),
  smartmeterId: z.number().positive().optional(),
  autoSuspendEnabled: z.boolean().default(true),
  graceDays: z.number().int().min(0).max(30).default(7),
  adminNotes: z.string().optional()
})

const updateServiceSchema = z.object({
  status: z.enum(['PENDING_INSTALL', 'ACTIVE', 'SUSPENDED_OVERDUE', 'SUSPENDED_ADMIN', 'CANCELLED', 'COMPLETED']).optional(),
  siteName: z.string().optional(),
  serviceLocation: z.string().optional(),
  smartmeterId: z.number().positive().optional(),
  autoSuspendEnabled: z.boolean().optional(),
  graceDays: z.number().int().min(0).max(30).optional(),
  adminNotes: z.string().optional()
})

/**
 * GET /api/afya-solar/client-services
 * Fetch all client services with filtering and pagination
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
    const status = searchParams.get('status')
    const facilityId = searchParams.get('facilityId')
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    // Build query conditions
    const conditions = []
    if (status) {
      conditions.push(eq(afyaSolarClientServices.status, status))
    }
    if (facilityId) {
      conditions.push(eq(afyaSolarClientServices.facilityId, facilityId))
    }
    if (search) {
      conditions.push(or(
        like(afyaSolarClientServices.siteName, `%${search}%`),
        like(afyaSolarClientServices.serviceLocation, `%${search}%`),
        like(facilities.name, `%${search}%`)
      ))
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch client services with full details
    const services = await db
      .select({
        // Service info
        id: afyaSolarClientServices.id,
        facilityId: afyaSolarClientServices.facilityId,
        packageId: afyaSolarClientServices.packageId,
        planId: afyaSolarClientServices.planId,
        status: afyaSolarClientServices.status,
        startDate: afyaSolarClientServices.startDate,
        endDate: afyaSolarClientServices.endDate,
        siteName: afyaSolarClientServices.siteName,
        serviceLocation: afyaSolarClientServices.serviceLocation,
        smartmeterId: afyaSolarClientServices.smartmeterId,
        autoSuspendEnabled: afyaSolarClientServices.autoSuspendEnabled,
        graceDays: afyaSolarClientServices.graceDays,
        adminNotes: afyaSolarClientServices.adminNotes,
        createdAt: afyaSolarClientServices.createdAt,
        updatedAt: afyaSolarClientServices.updatedAt,
        // Package info
        pkgId: afyaSolarPackages.id,
        packageCode: afyaSolarPackages.code,
        packageName: afyaSolarPackages.name,
        packageRatedKw: afyaSolarPackages.ratedKw,
        packageSuitableFor: afyaSolarPackages.suitableFor,
        // Plan info
        plnId: afyaSolarPlans.id,
        planTypeCode: afyaSolarPlans.planTypeCode,
        currency: afyaSolarPlans.currency,
        cashPrice: afyaSolarPlanPricing.cashPrice,
        installmentDurationMonths: afyaSolarPlanPricing.installmentDurationMonths,
        defaultUpfrontPercent: afyaSolarPlanPricing.defaultUpfrontPercent,
        defaultMonthlyAmount: afyaSolarPlanPricing.defaultMonthlyAmount,
        eaasMonthlyFee: afyaSolarPlanPricing.eaasMonthlyFee,
        eaasBillingModel: afyaSolarPlanPricing.eaasBillingModel,
        // Facility info
        facId: facilities.id,
        facilityName: facilities.name,
        facilityCity: facilities.city,
        facilityRegion: facilities.region,
        facilityPhone: facilities.phone,
        facilityEmail: facilities.email,
        // Smart meter info
        smartmeterSerial: afyaSolarSmartmeters.meterSerial,
        smartmeterVendor: afyaSolarSmartmeters.vendor,
        smartmeterSiteAddress: afyaSolarSmartmeters.siteAddress,
        smartmeterInstalledAt: afyaSolarSmartmeters.installedAt,
        smartmeterLastSeenAt: afyaSolarSmartmeters.lastSeenAt
      })
      .from(afyaSolarClientServices)
      .leftJoin(afyaSolarPackages, eq(afyaSolarClientServices.packageId, afyaSolarPackages.id))
      .leftJoin(afyaSolarPlans, eq(afyaSolarClientServices.planId, afyaSolarPlans.id))
      .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
      .leftJoin(facilities, eq(afyaSolarClientServices.facilityId, facilities.id))
      .leftJoin(afyaSolarSmartmeters, eq(afyaSolarClientServices.smartmeterId, afyaSolarSmartmeters.id))
      .where(whereCondition)
      .orderBy(desc(afyaSolarClientServices.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const totalCount = await db
      .select({ count: afyaSolarClientServices.id })
      .from(afyaSolarClientServices)
      .leftJoin(facilities, eq(afyaSolarClientServices.facilityId, facilities.id))
      .where(whereCondition)

    // Transform flat response into nested structure
    const transformedServices = services.map(service => ({
      ...service,
      package: {
        id: service.pkgId,
        code: service.packageCode,
        name: service.packageName,
        ratedKw: service.packageRatedKw,
        suitableFor: service.packageSuitableFor
      },
      plan: {
        id: service.plnId,
        planTypeCode: service.planTypeCode,
        currency: service.currency,
        pricing: {
          cashPrice: service.cashPrice,
          installmentDurationMonths: service.installmentDurationMonths,
          defaultUpfrontPercent: service.defaultUpfrontPercent,
          defaultMonthlyAmount: service.defaultMonthlyAmount,
          eaasMonthlyFee: service.eaasMonthlyFee,
          eaasBillingModel: service.eaasBillingModel
        }
      },
      facility: {
        id: service.facId,
        name: service.facilityName,
        city: service.facilityCity,
        region: service.facilityRegion,
        phone: service.facilityPhone,
        email: service.facilityEmail
      },
      smartmeter: service.smartmeterId ? {
        id: service.smartmeterId,
        meterSerial: service.smartmeterSerial,
        vendor: service.smartmeterVendor,
        siteAddress: service.smartmeterSiteAddress,
        installedAt: service.smartmeterInstalledAt,
        lastSeenAt: service.smartmeterLastSeenAt
      } : null,
      // Remove flat fields
      pkgId: undefined,
      packageCode: undefined,
      packageName: undefined,
      packageRatedKw: undefined,
      packageSuitableFor: undefined,
      plnId: undefined,
      planTypeCode: undefined,
      currency: undefined,
      cashPrice: undefined,
      installmentDurationMonths: undefined,
      defaultUpfrontPercent: undefined,
      defaultMonthlyAmount: undefined,
      eaasMonthlyFee: undefined,
      eaasBillingModel: undefined,
      facId: undefined,
      facilityName: undefined,
      facilityCity: undefined,
      facilityRegion: undefined,
      facilityPhone: undefined,
      facilityEmail: undefined,
      smartmeterSerial: undefined,
      smartmeterVendor: undefined,
      smartmeterSiteAddress: undefined,
      smartmeterInstalledAt: undefined,
      smartmeterLastSeenAt: undefined
    }))

    return NextResponse.json({
      success: true,
      data: {
        services: transformedServices,
        pagination: {
          page,
          limit,
          total: totalCount.length,
          pages: Math.ceil(totalCount.length / limit)
        }
      }
    })

  } catch (error) {
    console.error('Error fetching client services:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/afya-solar/client-services
 * Create a new client service
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createServiceSchema.parse(body)

    // Verify package and plan exist
    const [packageExists] = await db
      .select()
      .from(afyaSolarPackages)
      .where(and(
        eq(afyaSolarPackages.id, validated.packageId),
        eq(afyaSolarPackages.isActive, 1)
      ))
      .limit(1)

    if (!packageExists) {
      return NextResponse.json({ error: 'Package not found or inactive' }, { status: 404 })
    }

    const [planExists] = await db
      .select()
      .from(afyaSolarPlans)
      .where(and(
        eq(afyaSolarPlans.id, validated.planId),
        eq(afyaSolarPlans.packageId, validated.packageId),
        eq(afyaSolarPlans.isActive, 1)
      ))
      .limit(1)

    if (!planExists) {
      return NextResponse.json({ error: 'Plan not found or inactive' }, { status: 404 })
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Create client service
      const [serviceResult] = await tx.insert(afyaSolarClientServices).values({
        facilityId: validated.facilityId,
        packageId: validated.packageId,
        planId: validated.planId,
        status: 'PENDING_INSTALL',
        siteName: validated.siteName,
        serviceLocation: validated.serviceLocation,
        smartmeterId: validated.smartmeterId,
        autoSuspendEnabled: validated.autoSuspendEnabled ? 1 : 0,
        graceDays: validated.graceDays,
        adminNotes: validated.adminNotes
      })

      const serviceId = serviceResult.insertId

      // Create status history entry
      await tx.insert(afyaSolarServiceStatusHistory).values({
        clientServiceId: serviceId,
        oldStatus: 'NONE',
        newStatus: 'PENDING_INSTALL',
        reasonCode: 'SERVICE_CREATED',
        reasonText: 'Service created and pending installation',
        changedByUserId: session.user.id
      })

      // TODO: Create contract based on plan type
      // This will be implemented in the Contract Management System

      return serviceId
    })

    return NextResponse.json({
      success: true,
      message: 'Client service created successfully'
    })

  } catch (error) {
    console.error('Error creating client service:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
