import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarPackages, 
  afyaSolarPackageSpecs,
  afyaSolarPlans,
  afyaSolarPlanPricing
} from '@/lib/db/afya-solar-schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { afyaSolarClientServices } from '@/lib/db/afya-solar-schema'

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PackageWithDetails {
  id: number
  code: string
  name: string
  ratedKw: string
  suitableFor: string | null
  isActive: boolean
  createdAt: Date | null
  updatedAt: Date | null
  specs: {
    solarPanelsDesc: string | null
    totalCapacityKw: string | null
    batteryKwh: string | null
    inverterDesc: string | null
    dailyOutputKwhMin: string | null
    dailyOutputKwhMax: string | null
    backupHoursMin: string | null
    backupHoursMax: string | null
    mountingDesc: string | null
    cablingDesc: string | null
    warrantyMonths: number | null
    trainingDesc: string | null
    remoteMonitoringDesc: string | null
  } | null
  plans: Array<{
    id: number
    planTypeCode: string
    currency: string | null
    isActive: boolean
    pricing: {
      id: number
      cashPrice: number | null
      installmentDurationMonths: number | null
      defaultUpfrontPercent: string | null
      defaultMonthlyAmount: number | null
      eaasMonthlyFee: number | null
      eaasBillingModel: string | null
      includesShipping: boolean
      includesInstallation: boolean
      includesCommissioning: boolean
      includesMaintenance: boolean
      effectiveFrom: Date | null
      effectiveTo: Date | null
      notes: string | null
    } | null
  }>
}

/**
 * GET /api/afya-solar/packages/[id]
 * Fetch a specific solar package with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const packageId = parseInt(id)
    if (isNaN(packageId)) {
      return NextResponse.json({ error: 'Invalid package ID' }, { status: 400 })
    }

    // Fetch package with specifications
    const [packageResult] = await db
      .select({
        id: afyaSolarPackages.id,
        code: afyaSolarPackages.code,
        name: afyaSolarPackages.name,
        ratedKw: afyaSolarPackages.ratedKw,
        suitableFor: afyaSolarPackages.suitableFor,
        isActive: afyaSolarPackages.isActive,
        createdAt: afyaSolarPackages.createdAt,
        updatedAt: afyaSolarPackages.updatedAt,
        specs: {
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
        }
      })
      .from(afyaSolarPackages)
      .leftJoin(afyaSolarPackageSpecs, eq(afyaSolarPackages.id, afyaSolarPackageSpecs.packageId))
      .where(eq(afyaSolarPackages.id, packageId))
      .limit(1)

    if (!packageResult) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Fetch plans and pricing
    const plans = await db
      .select({
        id: afyaSolarPlans.id,
        planTypeCode: afyaSolarPlans.planTypeCode,
        currency: afyaSolarPlans.currency,
        isActive: afyaSolarPlans.isActive,
        pricing: {
          id: afyaSolarPlanPricing.id,
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
          notes: afyaSolarPlanPricing.notes,
        }
      })
      .from(afyaSolarPlans)
      .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
      .where(eq(afyaSolarPlans.packageId, packageId))

    const packageData: PackageWithDetails = {
      ...packageResult,
      isActive: packageResult.isActive === 1,
      plans: plans.map(plan => ({
        ...plan,
        isActive: plan.isActive === 1,
        pricing: plan.pricing ? {
          ...plan.pricing,
          includesShipping: plan.pricing.includesShipping === 1,
          includesInstallation: plan.pricing.includesInstallation === 1,
          includesCommissioning: plan.pricing.includesCommissioning === 1,
          includesMaintenance: plan.pricing.includesMaintenance === 1
        } : plan.pricing
      }))
    }

    return NextResponse.json({
      success: true,
      data: packageData
    })

  } catch (error) {
    console.error('Error fetching Afya Solar package:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/afya-solar/packages/[id]
 * Update a solar package (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const packageId = parseInt(id)
    if (isNaN(packageId)) {
      return NextResponse.json({ error: 'Invalid package ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      code,
      name,
      ratedKw,
      suitableFor,
      isActive,
      specs,
      plans
    } = body

    // Check if package exists
    const [existingPackage] = await db
      .select()
      .from(afyaSolarPackages)
      .where(eq(afyaSolarPackages.id, packageId))
      .limit(1)

    if (!existingPackage) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Update package
      await tx
        .update(afyaSolarPackages)
        .set({
          code,
          name,
          ratedKw: ratedKw.toString(),
          suitableFor,
          isActive: isActive !== undefined ? (isActive ? 1 : 0) : existingPackage.isActive,
          updatedAt: new Date()
        })
        .where(eq(afyaSolarPackages.id, packageId))

      // Update specifications if provided
      if (specs) {
        const [existingSpecs] = await tx
          .select()
          .from(afyaSolarPackageSpecs)
          .where(eq(afyaSolarPackageSpecs.packageId, packageId))
          .limit(1)

        if (existingSpecs) {
          // Update existing specs
          await tx
            .update(afyaSolarPackageSpecs)
            .set({
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
              remoteMonitoringDesc: specs.remoteMonitoringDesc,
              updatedAt: new Date()
            })
            .where(eq(afyaSolarPackageSpecs.packageId, packageId))
        } else {
          // Create new specs
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
      }

      // Update plans if provided
      if (plans && Array.isArray(plans)) {
        for (const plan of plans) {
          if (plan.id) {
            // Update existing plan
            await tx
              .update(afyaSolarPlans)
              .set({
                planTypeCode: plan.planTypeCode,
                currency: plan.currency || 'TZS',
                isActive: plan.isActive !== undefined ? (plan.isActive ? 1 : 0) : 1,
                updatedAt: new Date()
              })
              .where(eq(afyaSolarPlans.id, plan.id))

            // Update pricing if provided
            if (plan.pricing) {
              const [existingPricing] = await tx
                .select()
                .from(afyaSolarPlanPricing)
                .where(eq(afyaSolarPlanPricing.planId, plan.id))
                .limit(1)

              if (existingPricing) {
                await tx
                  .update(afyaSolarPlanPricing)
                  .set({
                    cashPrice: plan.pricing.cashPrice,
                    installmentDurationMonths: plan.pricing.installmentDurationMonths,
                    defaultUpfrontPercent: plan.pricing.defaultUpfrontPercent?.toString(),
                    defaultMonthlyAmount: plan.pricing.defaultMonthlyAmount,
                    eaasMonthlyFee: plan.pricing.eaasMonthlyFee,
                    eaasBillingModel: plan.pricing.eaasBillingModel || 'FIXED_MONTHLY',
                    includesShipping: plan.pricing.includesShipping,
                    includesInstallation: plan.pricing.includesInstallation,
                    includesCommissioning: plan.pricing.includesCommissioning,
                    includesMaintenance: plan.pricing.includesMaintenance,
                    effectiveFrom: plan.pricing.effectiveFrom ? new Date(plan.pricing.effectiveFrom) : existingPricing.effectiveFrom,
                    notes: plan.pricing.notes,
                    updatedAt: new Date()
                  })
                  .where(eq(afyaSolarPlanPricing.planId, plan.id))
              } else {
                await tx.insert(afyaSolarPlanPricing).values({
                  planId: plan.id,
                  cashPrice: plan.pricing.cashPrice,
                  installmentDurationMonths: plan.pricing.installmentDurationMonths,
                  defaultUpfrontPercent: plan.pricing.defaultUpfrontPercent?.toString(),
                  defaultMonthlyAmount: plan.pricing.defaultMonthlyAmount,
                  eaasMonthlyFee: plan.pricing.eaasMonthlyFee,
                  eaasBillingModel: plan.pricing.eaasBillingModel || 'FIXED_MONTHLY',
                  includesShipping: plan.pricing.includesShipping,
                  includesInstallation: plan.pricing.includesInstallation,
                  includesCommissioning: plan.pricing.includesCommissioning,
                  includesMaintenance: plan.pricing.includesMaintenance,
                  effectiveFrom: plan.pricing.effectiveFrom ? new Date(plan.pricing.effectiveFrom) : new Date(),
                  notes: plan.pricing.notes
                })
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Package updated successfully'
    })

  } catch (error) {
    console.error('Error updating Afya Solar package:', error)
    
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

/**
 * DELETE /api/afya-solar/packages/[id]
 * Delete a solar package (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const packageId = parseInt(id)
    if (isNaN(packageId)) {
      return NextResponse.json({ error: 'Invalid package ID' }, { status: 400 })
    }

    // Check if package exists
    const [existingPackage] = await db
      .select()
      .from(afyaSolarPackages)
      .where(eq(afyaSolarPackages.id, packageId))
      .limit(1)

    if (!existingPackage) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    // Check if package has any client services
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.packageId, packageId))

    if (count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete package with existing client services' },
        { status: 400 }
      )
    }

    // Start a transaction to delete all related data
    await db.transaction(async (tx) => {
      // Find all plan IDs for this package
      const plans = await tx
        .select({ id: afyaSolarPlans.id })
        .from(afyaSolarPlans)
        .where(eq(afyaSolarPlans.packageId, packageId))

      const planIds = plans.map((p) => p.id)

      if (planIds.length > 0) {
        // Delete pricing records linked to these plans
        await tx
          .delete(afyaSolarPlanPricing)
          .where(inArray(afyaSolarPlanPricing.planId, planIds))

        // Delete plans
        await tx
          .delete(afyaSolarPlans)
          .where(inArray(afyaSolarPlans.id, planIds))
      }

      // Delete specifications
      await tx
        .delete(afyaSolarPackageSpecs)
        .where(eq(afyaSolarPackageSpecs.packageId, packageId))

      // Finally, delete the package record itself
      await tx
        .delete(afyaSolarPackages)
        .where(eq(afyaSolarPackages.id, packageId))
    })

    return NextResponse.json({
      success: true,
      message: 'Package deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting Afya Solar package:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
