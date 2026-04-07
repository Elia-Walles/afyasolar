import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarPackages, 
  afyaSolarPackageSpecs,
  afyaSolarPlans,
  afyaSolarPlanPricing,
  afyaSolarPlanTypes
} from '@/lib/db/afya-solar-schema'
import { eq, and, desc } from 'drizzle-orm'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/afya-solar/packages
 * Fetch all solar packages with their specifications and pricing
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const packageId = searchParams.get('packageId')

    // Build query conditions
    const whereConditions = includeInactive ? undefined : eq(afyaSolarPackages.isActive, 1)
    if (packageId) {
      const packageIdCondition = eq(afyaSolarPackages.id, parseInt(packageId))
      const finalCondition = whereConditions 
        ? and(whereConditions, packageIdCondition)
        : packageIdCondition
    }

    try {
      // Fetch packages with specifications
      const packages = await db
        .select({
          // Package info
          id: afyaSolarPackages.id,
          code: afyaSolarPackages.code,
          name: afyaSolarPackages.name,
          ratedKw: afyaSolarPackages.ratedKw,
          suitableFor: afyaSolarPackages.suitableFor,
          isActive: afyaSolarPackages.isActive,
          createdAt: afyaSolarPackages.createdAt,
          updatedAt: afyaSolarPackages.updatedAt,
          // Specs info
          specsId: afyaSolarPackageSpecs.id,
          solarPanelsDesc: afyaSolarPackageSpecs.solarPanelsDesc,
          totalCapacityKw: afyaSolarPackageSpecs.totalCapacityKw,
          batteryKwh: afyaSolarPackageSpecs.batteryKwh,
          inverterDesc: afyaSolarPackageSpecs.inverterDesc,
          dailyOutputKwhMin: afyaSolarPackageSpecs.dailyOutputKwhMin,
          dailyOutputKwhMax: afyaSolarPackageSpecs.dailyOutputKwhMax,
          backupHoursMin: afyaSolarPackageSpecs.backupHoursMin,
          backupHoursMax: afyaSolarPackageSpecs.backupHoursMax,
          mountingDesc: afyaSolarPackageSpecs.mountingDesc,
          cablingDesc: afyaSolarPackageSpecs.cablingDesc,
          warrantyMonths: afyaSolarPackageSpecs.warrantyMonths,
          trainingDesc: afyaSolarPackageSpecs.trainingDesc,
          remoteMonitoringDesc: afyaSolarPackageSpecs.remoteMonitoringDesc,
          // Plans info
          planId: afyaSolarPlans.id,
          planTypeCode: afyaSolarPlans.planTypeCode,
          planCurrency: afyaSolarPlans.currency,
          planIsActive: afyaSolarPlans.isActive,
          // Pricing info
          pricingId: afyaSolarPlanPricing.id,
          cashPrice: afyaSolarPlanPricing.cashPrice,
          installmentDurationMonths: afyaSolarPlanPricing.installmentDurationMonths,
          defaultUpfrontPercent: afyaSolarPlanPricing.defaultUpfrontPercent,
          defaultMonthlyAmount: afyaSolarPlanPricing.defaultMonthlyAmount,
          eaasMonthlyFee: afyaSolarPlanPricing.eaasMonthlyFee,
          eaasBillingModel: afyaSolarPlanPricing.eaasBillingModel,
          includesShipping: afyaSolarPlanPricing.includesShipping,
          includesInstallation: afyaSolarPlanPricing.includesInstallation,
          includesCommissioning: afyaSolarPlanPricing.includesCommissioning,
          includesMaintenance: afyaSolarPlanPricing.includesMaintenance,
          effectiveFrom: afyaSolarPlanPricing.effectiveFrom,
          effectiveTo: afyaSolarPlanPricing.effectiveTo,
          notes: afyaSolarPlanPricing.notes
        })
        .from(afyaSolarPackages)
        .leftJoin(afyaSolarPackageSpecs, eq(afyaSolarPackages.id, afyaSolarPackageSpecs.packageId))
        .leftJoin(afyaSolarPlans, eq(afyaSolarPackages.id, afyaSolarPlans.packageId))
        .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
        .where(whereConditions)
        .orderBy(desc(afyaSolarPackages.ratedKw))

      // Group by package and collect all plans for each package
      const packageMap = new Map()
      
      packages.forEach(pkg => {
        const packageKey = pkg.id
        
        if (!packageMap.has(packageKey)) {
          packageMap.set(packageKey, {
            id: pkg.id,
            code: pkg.code,
            name: pkg.name,
            ratedKw: pkg.ratedKw,
            suitableFor: pkg.suitableFor,
            isActive: pkg.isActive,
            createdAt: pkg.createdAt,
            updatedAt: pkg.updatedAt,
            specs: null,
            plans: []
          })
        }
        
        const packageEntry = packageMap.get(packageKey)
        
        // Add specs if present
        if (pkg.specsId && !packageEntry.specs) {
          packageEntry.specs = {
            id: pkg.specsId,
            solarPanelsDesc: pkg.solarPanelsDesc,
            totalCapacityKw: pkg.totalCapacityKw,
            batteryKwh: pkg.batteryKwh,
            inverterDesc: pkg.inverterDesc,
            dailyOutputKwhMin: pkg.dailyOutputKwhMin,
            dailyOutputKwhMax: pkg.dailyOutputKwhMax,
            backupHoursMin: pkg.backupHoursMin,
            backupHoursMax: pkg.backupHoursMax,
            mountingDesc: pkg.mountingDesc,
            cablingDesc: pkg.cablingDesc,
            warrantyMonths: pkg.warrantyMonths,
            trainingDesc: pkg.trainingDesc,
            remoteMonitoringDesc: pkg.remoteMonitoringDesc
          }
        }
        
        // Add plan if present
        if (pkg.planId) {
          packageEntry.plans.push({
            id: pkg.planId,
            planTypeCode: pkg.planTypeCode,
            currency: pkg.planCurrency,
            isActive: pkg.planIsActive,
            pricing: pkg.pricingId ? {
              id: pkg.pricingId,
              cashPrice: pkg.cashPrice,
              installmentDurationMonths: pkg.installmentDurationMonths,
              defaultUpfrontPercent: pkg.defaultUpfrontPercent,
              defaultMonthlyAmount: pkg.defaultMonthlyAmount,
              eaasMonthlyFee: pkg.eaasMonthlyFee,
              eaasBillingModel: pkg.eaasBillingModel,
              includesShipping: pkg.includesShipping,
              includesInstallation: pkg.includesInstallation,
              includesCommissioning: pkg.includesCommissioning,
              includesMaintenance: pkg.includesMaintenance,
              effectiveFrom: pkg.effectiveFrom,
              effectiveTo: pkg.effectiveTo,
              notes: pkg.notes
            } : null
          })
        }
      })
      
      const transformedPackages = Array.from(packageMap.values())

      return NextResponse.json({
        success: true,
        data: {
          packages: transformedPackages
        }
      })

    } catch (dbError: any) {
      console.error('Database error in Afya Solar packages API:', dbError)
      // In case of DB error, do NOT return hard-coded demo packages;
      // just return an empty list so the UI doesn't show phantom data.
      return NextResponse.json({
        success: false,
        data: {
          packages: [],
        },
        error: 'Database error while loading packages',
        message: dbError?.message,
      })
    }

  } catch (error: any) {
    console.error('Error in Afya Solar packages API:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/afya-solar/packages
 * Create a new solar package (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      code,
      name,
      ratedKw,
      suitableFor,
      specs,
      plans
    } = body

    // Validate required fields
    if (!code || !name || !ratedKw) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, ratedKw' },
        { status: 400 }
      )
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Create package
      const [packageResult] = await tx.insert(afyaSolarPackages).values({
        code,
        name,
        ratedKw: ratedKw.toString(),
        suitableFor,
        isActive: 1
      })

      const packageId = packageResult.insertId

      // Create specifications if provided
      if (specs) {
        await tx.insert(afyaSolarPackageSpecs).values({
          packageId,
          solarPanelsDesc: specs.solarPanelsDesc,
          totalCapacityKw: specs.totalCapacityKw?.toString(),
          batteryKwh: specs.batteryKwh?.toString(),
          inverterDesc: specs.inverterDesc,
          dailyOutputKwhMin: specs.dailyOutputKwhMin?.toString(),
          dailyOutputKwhMax: specs.dailyOutputKwhMax?.toString(),
          backupHoursMin: specs.backupHoursMin?.toString(),
          backupHoursMax: specs.backupHoursMax?.toString(),
          mountingDesc: specs.mountingDesc,
          cablingDesc: specs.cablingDesc,
          warrantyMonths: specs.warrantyMonths,
          trainingDesc: specs.trainingDesc,
          remoteMonitoringDesc: specs.remoteMonitoringDesc
        })
      }

      // Create plans if provided
      if (plans && Array.isArray(plans)) {
        for (const plan of plans) {
          // Create plan
          const [planResult] = await tx.insert(afyaSolarPlans).values({
            packageId,
            planTypeCode: plan.planTypeCode,
            currency: plan.currency || 'TZS',
            isActive: 1
          })

          const planId = planResult.insertId

          // Create pricing if provided
          if (plan.pricing) {
            await tx.insert(afyaSolarPlanPricing).values({
              planId,
              cashPrice: plan.pricing.cashPrice,
              installmentDurationMonths: plan.pricing.installmentDurationMonths,
              defaultUpfrontPercent: plan.pricing.defaultUpfrontPercent?.toString(),
              defaultMonthlyAmount: plan.pricing.defaultMonthlyAmount,
              eaasMonthlyFee: plan.pricing.eaasMonthlyFee,
              eaasBillingModel: plan.pricing.eaasBillingModel || 'FIXED_MONTHLY',
              includesShipping: plan.pricing.includesShipping ?? true,
              includesInstallation: plan.pricing.includesInstallation ?? true,
              includesCommissioning: plan.pricing.includesCommissioning ?? true,
              includesMaintenance: plan.pricing.includesMaintenance ?? false,
              effectiveFrom: plan.pricing.effectiveFrom ? new Date(plan.pricing.effectiveFrom) : new Date(),
              notes: plan.pricing.notes
            })
          }
        }
      }

      return packageId
    })

    return NextResponse.json({
      success: true,
      message: 'Package created successfully'
    })

  } catch (error) {
    console.error('Error creating Afya Solar package:', error)
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Package code already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
