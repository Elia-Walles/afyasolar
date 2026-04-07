import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarSubscribers } from '@/lib/db/afyasolar-subscribers-schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { afyaSolarPackages, afyaSolarPlans, afyaSolarPlanPricing, afyaSolarPackageSpecs } from '@/lib/db/afya-solar-schema'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schema for auto-creation
const createSubscriberSchema = z.object({
  // Facility IDs in this system are 36-char strings but not strict UUIDs,
  // so accept any non-empty string to avoid rejecting valid facilities.
  facilityId: z.string().min(1),
  facilityName: z.string().min(1),
  facilityEmail: z.string().email().optional(),
  facilityPhone: z.string().optional(),
  packageId: z.string(),
  packageName: z.string().min(1),
  packageCode: z.string().min(1),
  packageRatedKw: z.number().positive(),
  planType: z.enum(['CASH', 'INSTALLMENT', 'PAAS']),
  totalPackagePrice: z.number().positive(),
  paymentMethod: z.enum(['MNO', 'BANK', 'INVOICE', 'CASH']).optional(),
})

async function getAfyaSolarPackageAndPricing(args: { packageId: string }) {
  const pkgIdNum = Number.parseInt(args.packageId, 10)
  if (!Number.isFinite(pkgIdNum)) throw new Error('Invalid packageId')

  const rows = await db
    .select({
      packageId: afyaSolarPackages.id,
      code: afyaSolarPackages.code,
      name: afyaSolarPackages.name,
      ratedKw: afyaSolarPackages.ratedKw,
      suitableFor: afyaSolarPackages.suitableFor,
      planTypeCode: afyaSolarPlans.planTypeCode,
      cashPrice: afyaSolarPlanPricing.cashPrice,
      installmentDurationMonths: afyaSolarPlanPricing.installmentDurationMonths,
      defaultUpfrontPercent: afyaSolarPlanPricing.defaultUpfrontPercent,
      defaultMonthlyAmount: afyaSolarPlanPricing.defaultMonthlyAmount,
      eaasMonthlyFee: afyaSolarPlanPricing.eaasMonthlyFee,
      // Specs
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
    })
    .from(afyaSolarPackages)
    .leftJoin(afyaSolarPackageSpecs, eq(afyaSolarPackages.id, afyaSolarPackageSpecs.packageId))
    .leftJoin(afyaSolarPlans, eq(afyaSolarPackages.id, afyaSolarPlans.packageId))
    .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
    .where(eq(afyaSolarPackages.id, pkgIdNum))

  if (!rows.length) throw new Error('Package not found')

  const base = rows[0]
  const cashPlan = rows.find((r) => r.planTypeCode === 'CASH')
  const instPlan = rows.find((r) => r.planTypeCode === 'INSTALLMENT')
  const eaasPlan = rows.find((r) => r.planTypeCode === 'EAAS')

  const cashPrice = cashPlan?.cashPrice != null ? Number(cashPlan.cashPrice) : null
  const upfrontPercent = instPlan?.defaultUpfrontPercent != null ? Number(instPlan.defaultUpfrontPercent) : 40
  const installmentMonths = instPlan?.installmentDurationMonths != null ? Number(instPlan.installmentDurationMonths) : null
  const installmentMonthly = instPlan?.defaultMonthlyAmount != null ? Number(instPlan.defaultMonthlyAmount) : null
  const eaasMonthlyFee = eaasPlan?.eaasMonthlyFee != null ? Number(eaasPlan.eaasMonthlyFee) : null

  const specs = {
    solarPanelsDesc: base.solarPanelsDesc ?? null,
    totalCapacityKw: base.totalCapacityKw ?? null,
    batteryKwh: base.batteryKwh ?? null,
    inverterDesc: base.inverterDesc ?? null,
    dailyOutputKwhMin: base.dailyOutputKwhMin ?? null,
    dailyOutputKwhMax: base.dailyOutputKwhMax ?? null,
    backupHoursMin: base.backupHoursMin ?? null,
    backupHoursMax: base.backupHoursMax ?? null,
    mountingDesc: base.mountingDesc ?? null,
    cablingDesc: base.cablingDesc ?? null,
    warrantyMonths: base.warrantyMonths ?? null,
    trainingDesc: base.trainingDesc ?? null,
    remoteMonitoringDesc: base.remoteMonitoringDesc ?? null,
  }

  return {
    package: {
      id: String(base.packageId),
      code: base.code,
      name: base.name,
      ratedKw: Number(base.ratedKw),
      suitableFor: base.suitableFor ?? '',
      specs,
    },
    pricing: {
      cashPrice,
      upfrontPercent,
      installmentMonths,
      installmentMonthly,
      eaasMonthlyFee,
      eaasMinimumTermMonths: 60,
    },
  }
}

/**
 * POST /api/afyasolar/subscribers/auto-create
 * Automatically create Afya Solar subscriber record when user subscribes
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSubscriberSchema.parse(body)

    // Check if subscriber already exists
    const existingSubscriber = await db
      .select()
      .from(afyaSolarSubscribers)
      .where(eq(afyaSolarSubscribers.facilityId, validatedData.facilityId))
      .limit(1)

    if (existingSubscriber.length > 0) {
      console.log('[AfyaSolarSubscriber][AUTO_CREATE] Subscriber already exists for facility', {
        facilityId: validatedData.facilityId,
        existingId: existingSubscriber[0].id,
      })
      return NextResponse.json(
        { error: 'Subscriber already exists' },
        { status: 409 }
      )
    }

    // Get facility information for additional details
    const facilityResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/facility/${validatedData.facilityId}`, {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    })

    let facilityInfo = null
    if (facilityResponse.ok) {
      facilityInfo = await facilityResponse.json()
    }

    // Look up pricing from DB so subscriber record matches the pricing framework
    const { package: pkg, pricing } = await getAfyaSolarPackageAndPricing({
      packageId: validatedData.packageId,
    })

    const cashPrice = pricing.cashPrice ?? validatedData.totalPackagePrice
    const upfrontPercent = pricing.upfrontPercent ?? 40
    const installmentMonths = pricing.installmentMonths
    const installmentMonthly = pricing.installmentMonthly
    const eaasMonthlyFee = pricing.eaasMonthlyFee

    let upfrontPaymentAmount: number | null = null
    let monthlyPaymentAmount: number | null = null
    let remainingBalance: number = cashPrice
    let minimumTermMonths: number = 12
    let contractDurationMonths: number | null = null

    if (validatedData.planType === 'CASH') {
      upfrontPaymentAmount = cashPrice
      remainingBalance = 0
      contractDurationMonths = null
      minimumTermMonths = 12
    } else if (validatedData.planType === 'INSTALLMENT') {
      upfrontPaymentAmount = Math.round((upfrontPercent / 100) * cashPrice)
      monthlyPaymentAmount = installmentMonthly ?? null
      remainingBalance = Math.max(cashPrice - (upfrontPaymentAmount || 0), 0)
      contractDurationMonths = installmentMonths ?? null
      minimumTermMonths = installmentMonths ?? 12
    } else if (validatedData.planType === 'PAAS') {
      // EaaS (Power-as-a-Service): fixed monthly fee, minimum term 60 months
      upfrontPaymentAmount = 0
      monthlyPaymentAmount = eaasMonthlyFee ?? null
      remainingBalance = 0
      contractDurationMonths = 60
      minimumTermMonths = 60
    }

    // Create new subscriber record
    const [newSubscriber] = await db.insert(afyaSolarSubscribers).values({
      ...validatedData,
      packageCode: pkg.code || validatedData.packageCode,
      packageName: validatedData.packageName || pkg.name,
      packageRatedKw: validatedData.packageRatedKw || pkg.ratedKw,
      facilityEmail: validatedData.facilityEmail || facilityInfo?.data?.email || '',
      facilityPhone: validatedData.facilityPhone || facilityInfo?.data?.phone || '',
      facilityRegion: facilityInfo?.data?.region || '',
      facilityCity: facilityInfo?.data?.city || '',
      packageDescription: `${validatedData.packageName} - ${validatedData.packageRatedKw}kW system`,
      packageSpecs: pkg.specs || {},
      // Online payments that reach this endpoint are already completed,
      // so mark the subscriber as fully paid.
      paymentStatus: 'completed',
      isPaymentCompleted: 1,
      paymentCompletedAt: new Date(),
      upfrontPaymentAmount,
      monthlyPaymentAmount,
      remainingBalance,
      subscriptionStatus: 'active',
      isActive: 1,
      subscriptionStartDate: new Date(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      billingCycle: 'monthly',
      gracePeriodDays: 7,
      contractStatus: 'active',
      contractDurationMonths,
      minimumTermMonths,
      autoRenew: 1,
      installationStatus: 'pending',
      systemStatus: 'pending_install',
      systemHealth: 'optimal',
      paymentHistory: [],
      bills: [],
      metadata: {
        createdBy: session.user.email,
        source: 'auto-subscription',
        createdAt: new Date().toISOString()
      },
      notes: `Auto-created subscription for ${validatedData.packageName}`,
      adminNotes: 'Automatically generated when user subscribed to Afya Solar'
    })

    console.log('[AfyaSolarSubscriber][AUTO_CREATE] Created subscriber record', {
      insertId: newSubscriber.insertId,
      facilityId: validatedData.facilityId,
      packageId: validatedData.packageId,
      planType: validatedData.planType,
      cashPrice,
      upfrontPercent,
      installmentMonths,
      installmentMonthly,
      eaasMonthlyFee,
      upfrontPaymentAmount,
      monthlyPaymentAmount,
      remainingBalance,
      minimumTermMonths,
    })

    return NextResponse.json({
      success: true,
      data: {
        subscriber: {
          id: newSubscriber.insertId,
          ...validatedData
        }
      },
      message: 'Afya Solar subscriber record created automatically'
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
