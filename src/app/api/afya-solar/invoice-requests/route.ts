import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarInvoiceRequests, facilities } from '@/lib/db/schema'
import { afyaSolarSubscribers } from '@/lib/db/afyasolar-subscribers-schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { generateId } from '@/lib/utils'
import { notificationCreators } from '@/lib/notifications/event-notifications'
import { afyaSolarPackages, afyaSolarPlans, afyaSolarPlanPricing } from '@/lib/db/afya-solar-schema'

export const dynamic = 'force-dynamic'

/**
 * GET /api/afya-solar/invoice-requests
 * Facility lists their own invoice requests (to check pending / show modal)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const requests = await db
      .select()
      .from(afyaSolarInvoiceRequests)
      .where(eq(afyaSolarInvoiceRequests.facilityId, facilityId))
      .orderBy(desc(afyaSolarInvoiceRequests.createdAt))

    return NextResponse.json({
      success: true,
      data: requests,
    })
  } catch (error) {
    console.error('Error fetching facility invoice requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const createInvoiceRequestSchema = z.object({
  packageId: z.string(),
  packageName: z.string(),
  paymentPlan: z.enum(['cash', 'installment', 'paas']),
  amount: z.number().positive().optional(),
  currency: z.string().default('TZS'),
  packageMetadata: z.record(z.unknown()).optional(),
})

async function getAfyaSolarExpectedAmount(args: {
  packageId: string
  paymentPlan: 'cash' | 'installment' | 'paas'
}) {
  const pkgIdNum = Number.parseInt(args.packageId, 10)
  if (!Number.isFinite(pkgIdNum)) {
    throw new Error('Invalid packageId for Afya Solar invoice request')
  }

  const rows = await db
    .select({
      planTypeCode: afyaSolarPlans.planTypeCode,
      cashPrice: afyaSolarPlanPricing.cashPrice,
      installmentDurationMonths: afyaSolarPlanPricing.installmentDurationMonths,
      defaultUpfrontPercent: afyaSolarPlanPricing.defaultUpfrontPercent,
      defaultMonthlyAmount: afyaSolarPlanPricing.defaultMonthlyAmount,
      eaasMonthlyFee: afyaSolarPlanPricing.eaasMonthlyFee,
    })
    .from(afyaSolarPackages)
    .leftJoin(afyaSolarPlans, eq(afyaSolarPackages.id, afyaSolarPlans.packageId))
    .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
    .where(eq(afyaSolarPackages.id, pkgIdNum))

  if (!rows.length) {
    throw new Error('Afya Solar package not found')
  }

  const cashPlan = rows.find((r) => r.planTypeCode === 'CASH')
  const installmentPlan = rows.find((r) => r.planTypeCode === 'INSTALLMENT')
  const eaasPlan = rows.find((r) => r.planTypeCode === 'EAAS')

  const cashPrice = cashPlan?.cashPrice != null ? Number(cashPlan.cashPrice) : null
  const upfrontPercent =
    installmentPlan?.defaultUpfrontPercent != null ? Number(installmentPlan.defaultUpfrontPercent) : 40
  const eaasMonthlyFee = eaasPlan?.eaasMonthlyFee != null ? Number(eaasPlan.eaasMonthlyFee) : null

  if (args.paymentPlan === 'cash') {
    if (!cashPrice) throw new Error('Cash pricing not configured for this package')
    return cashPrice
  }
  if (args.paymentPlan === 'installment') {
    if (!cashPrice) throw new Error('Cash pricing required to compute installment upfront amount')
    return Math.round((upfrontPercent / 100) * cashPrice)
  }
  if (!eaasMonthlyFee) throw new Error('EaaS monthly fee not configured for this package')
  return eaasMonthlyFee
}

/**
 * POST /api/afya-solar/invoice-requests
 * Facility submits a "Pay By Invoice" request for a package. Creates record and sends email to info@ubuntuafyalink.co.tz
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'facility') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = createInvoiceRequestSchema.parse(body)
    const computedAmount = await getAfyaSolarExpectedAmount({
      packageId: parsed.packageId,
      paymentPlan: parsed.paymentPlan,
    })

    const [facilityRow] = await db
      .select({
        name: facilities.name,
        email: facilities.email,
        phone: facilities.phone,
      })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facilityRow) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    const id = randomUUID()
    await db.insert(afyaSolarInvoiceRequests).values({
      id,
      facilityId,
      facilityName: facilityRow.name,
      facilityEmail: facilityRow.email ?? null,
      facilityPhone: facilityRow.phone ?? null,
      packageId: parsed.packageId,
      packageName: parsed.packageName,
      paymentPlan: parsed.paymentPlan,
      amount: String(computedAmount),
      currency: parsed.currency,
      packageMetadata: parsed.packageMetadata ? JSON.stringify(parsed.packageMetadata) : null,
      status: 'pending',
    })

    // Ensure Afya Solar subscriber record exists / is updated for this facility
    try {
      const [existingSubscriber] = await db
        .select()
        .from(afyaSolarSubscribers)
        .where(eq(afyaSolarSubscribers.facilityId, facilityId))
        .limit(1)

      const planType =
        parsed.paymentPlan === 'cash'
          ? 'CASH'
          : parsed.paymentPlan === 'installment'
          ? 'INSTALLMENT'
          : 'PAAS'

      const packageRatedKw =
        (parsed.packageMetadata && typeof parsed.packageMetadata.ratedKw === 'number'
          ? parsed.packageMetadata.ratedKw
          : undefined) ?? 0

      const baseSubscriberData = {
        facilityId,
        facilityName: facilityRow.name,
        facilityEmail: facilityRow.email ?? null,
        facilityPhone: facilityRow.phone ?? null,
        packageId: parsed.packageId,
        packageName: parsed.packageName,
        packageCode:
          (parsed.packageMetadata &&
            typeof parsed.packageMetadata.code === 'string' &&
            parsed.packageMetadata.code) ||
          parsed.packageId,
        packageRatedKw,
        planType,
        totalPackagePrice: computedAmount,
        paymentMethod: 'INVOICE',
        paymentStatus: 'pending',
        isPaymentCompleted: 0,
        remainingBalance: computedAmount,
      } as const

      if (existingSubscriber) {
        await db
          .update(afyaSolarSubscribers)
          .set({
            ...baseSubscriberData,
            updatedAt: new Date(),
            subscriptionStatus: existingSubscriber.subscriptionStatus || 'active',
            isActive: existingSubscriber.isActive ?? 1,
          })
          .where(eq(afyaSolarSubscribers.id, existingSubscriber.id))
      } else {
        const now = new Date()
        const minimumTermMonths = planType === 'PAAS' ? 60 : 12
        await db.insert(afyaSolarSubscribers).values({
          ...baseSubscriberData,
          facilityRegion: '', // can be enriched later via sync
          facilityCity: '',
          packageDescription: `${parsed.packageName}`,
          packageSpecs: parsed.packageMetadata ?? {},
          subscriptionStatus: 'active',
          isActive: 1,
          subscriptionStartDate: now,
          nextBillingDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          gracePeriodDays: 7,
          contractStatus: 'active',
          contractDurationMonths: planType === 'PAAS' ? 60 : undefined,
          minimumTermMonths,
          autoRenew: 1,
          installationStatus: 'pending',
          systemStatus: 'pending_install',
          systemHealth: 'optimal',
          paymentHistory: [],
          bills: [],
          metadata: {
            createdBy: session.user.email,
            source: 'invoice-request',
            invoiceRequestId: id,
            createdAt: now.toISOString(),
          },
          notes: `Created from Afya Solar invoice request ${id}`,
          adminNotes: 'Awaiting invoice payment',
        })
      }
    } catch (subscriberError) {
      console.error('Error ensuring Afya Solar subscriber from invoice request:', subscriberError)
      // Do not fail the main request if subscriber sync fails
    }

    // Create unified admin notification for new invoice request (will trigger email)
    try {
      await notificationCreators.solarInvoiceRequestCreated({
        requestId: id,
        facilityName: facilityRow.name,
        facilityId,
        facilityEmail: facilityRow.email ?? '',
        facilityPhone: facilityRow.phone ?? '',
        packageName: parsed.packageName,
        packageId: parsed.packageId,
        paymentPlan: parsed.paymentPlan,
        amount: String(computedAmount),
        currency: parsed.currency,
        packageMetadata: parsed.packageMetadata ?? undefined,
      })
    } catch (notificationError) {
      console.error('Error creating admin notification for invoice request:', notificationError)
      // Don't fail the request if notification creation fails
    }

    // Send SMS notification to facility
    try {
      const { sendSolarPackagePurchaseSMS } = await import('@/lib/sms')
      
      if (facilityRow.phone) {
        await sendSolarPackagePurchaseSMS(facilityRow.phone, {
          packageName: parsed.packageName,
          amount: String(computedAmount),
          paymentPlan: parsed.paymentPlan
        })
      }
    } catch (smsError) {
      console.error('Error sending SMS notification:', smsError)
      // Don't fail the request if SMS fails
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice request submitted. Our team will send the invoice to your email and SMS.',
      data: { id },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating Afya Solar invoice request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
