import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarClientServices,
  afyaSolarInstallmentContracts,
  afyaSolarInstallmentSchedule,
  afyaSolarEaasContracts,
  afyaSolarPlans,
  afyaSolarPlanPricing
} from '@/lib/db/afya-solar-schema'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schemas
const createInstallmentContractSchema = z.object({
  clientServiceId: z.number().positive(),
  contractTotalPrice: z.number().positive(),
  durationMonths: z.number().int().min(1).max(60),
  upfrontAmountAgreed: z.number().min(0),
  upfrontDueDate: z.string().datetime().optional()
})

const createEaasContractSchema = z.object({
  clientServiceId: z.number().positive(),
  billingModel: z.enum(['FIXED_MONTHLY', 'METERED']),
  monthlyFee: z.number().positive(),
  // Allow up to 72 months (6 years) for EAAS minimum term
  minimumTermMonths: z.number().int().min(1).max(72).optional()
})

/**
 * POST /api/afya-solar/contracts
 * Create a contract
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  
  if (type === 'eaas') {
    return createEaasContract(request)
  } else {
    return createInstallmentContract(request)
  }
}

/**
 * Create an installment contract and payment schedule (internal helper)
 */
async function createInstallmentContract(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createInstallmentContractSchema.parse(body)

    // Verify client service exists and is eligible for installment contract
    const [service] = await db
      .select({
        id: afyaSolarClientServices.id,
        facilityId: afyaSolarClientServices.facilityId,
        packageId: afyaSolarClientServices.packageId,
        planId: afyaSolarClientServices.planId,
        status: afyaSolarClientServices.status
      })
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.id, validated.clientServiceId))
      .limit(1)

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Verify plan type is INSTALLMENT
    const [plan] = await db
      .select({
        planTypeCode: afyaSolarPlans.planTypeCode,
        pricing: {
          installmentDurationMonths: afyaSolarPlanPricing.installmentDurationMonths,
          defaultUpfrontPercent: afyaSolarPlanPricing.defaultUpfrontPercent,
          defaultMonthlyAmount: afyaSolarPlanPricing.defaultMonthlyAmount
        }
      })
      .from(afyaSolarPlans)
      .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
      .where(eq(afyaSolarPlans.id, service.planId))
      .limit(1)

    if (!plan || plan.planTypeCode !== 'INSTALLMENT') {
      return NextResponse.json({ error: 'Service plan is not installment type' }, { status: 400 })
    }

    // Calculate contract details
    const upfrontPercent = validated.upfrontAmountAgreed / validated.contractTotalPrice * 100
    const balanceAmount = validated.contractTotalPrice - validated.upfrontAmountAgreed
    const monthlyAmount = Math.floor(balanceAmount / validated.durationMonths)
    const roundingAdjustment = balanceAmount - (monthlyAmount * validated.durationMonths)

    // Start a transaction
    await db.transaction(async (tx) => {
      // Create installment contract
      const [contractResult] = await tx.insert(afyaSolarInstallmentContracts).values({
        clientServiceId: validated.clientServiceId,
        contractTotalPrice: validated.contractTotalPrice,
        durationMonths: validated.durationMonths,
        upfrontAmountAgreed: validated.upfrontAmountAgreed,
        upfrontDueDate: validated.upfrontDueDate ? new Date(validated.upfrontDueDate) : new Date(),
        balanceAmount,
        monthlyAmount,
        roundingAdjustment,
        contractStatus: 'ACTIVE'
      })

      const contractId = contractResult.insertId

      // Generate payment schedule
      const schedule = []
      let currentDate = new Date()
      
      // Add upfront payment if not already paid
      if (validated.upfrontAmountAgreed > 0) {
        schedule.push({
          installmentContractId: contractId,
          periodNo: 0,
          dueDate: validated.upfrontDueDate ? new Date(validated.upfrontDueDate) : currentDate,
          amountDue: validated.upfrontAmountAgreed,
          status: 'PENDING'
        })
        currentDate = new Date(currentDate.getTime() + (30 * 24 * 60 * 60 * 1000)) // Next month
      }

      // Add monthly installments
      for (let i = 1; i <= validated.durationMonths; i++) {
        const amount = i === validated.durationMonths ? 
          monthlyAmount + roundingAdjustment : // Add remainder to last payment
          monthlyAmount

        schedule.push({
          installmentContractId: contractId,
          periodNo: i,
          dueDate: new Date(currentDate),
          amountDue: amount,
          status: 'PENDING'
        })
        
        // Move to next month
        currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1))
      }

      // Insert payment schedule
      await tx.insert(afyaSolarInstallmentSchedule).values(schedule)

      // Update service status to ACTIVE if it was PENDING_INSTALL
      if (service.status === 'PENDING_INSTALL') {
        await tx
          .update(afyaSolarClientServices)
          .set({
            status: 'ACTIVE',
            startDate: new Date(),
            updatedAt: new Date()
          })
          .where(eq(afyaSolarClientServices.id, validated.clientServiceId))
      }

      return contractId
    })

    return NextResponse.json({
      success: true,
      message: 'Installment contract created successfully'
    })

  } catch (error) {
    console.error('Error creating installment contract:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Create an EAAS contract (internal helper)
 */
async function createEaasContract(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createEaasContractSchema.parse(body)

    // Verify client service exists and is eligible for EAAS contract
    const [service] = await db
      .select({
        id: afyaSolarClientServices.id,
        facilityId: afyaSolarClientServices.facilityId,
        packageId: afyaSolarClientServices.packageId,
        planId: afyaSolarClientServices.planId,
        status: afyaSolarClientServices.status
      })
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.id, validated.clientServiceId))
      .limit(1)

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Verify plan type is EAAS
    const [plan] = await db
      .select({
        planTypeCode: afyaSolarPlans.planTypeCode,
        pricing: {
          eaasMonthlyFee: afyaSolarPlanPricing.eaasMonthlyFee,
          eaasBillingModel: afyaSolarPlanPricing.eaasBillingModel
        }
      })
      .from(afyaSolarPlans)
      .leftJoin(afyaSolarPlanPricing, eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId))
      .where(eq(afyaSolarPlans.id, service.planId))
      .limit(1)

    if (!plan || plan.planTypeCode !== 'EAAS') {
      return NextResponse.json({ error: 'Service plan is not EAAS type' }, { status: 400 })
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Create EAAS contract
      await tx.insert(afyaSolarEaasContracts).values({
        clientServiceId: validated.clientServiceId,
        billingModel: validated.billingModel,
        monthlyFee: validated.monthlyFee,
        // Pricing framework: EAAS minimum contract term is 5 years (60 months)
        minimumTermMonths: validated.minimumTermMonths ?? 60,
        contractStatus: 'ACTIVE'
      })

      // Update service status to ACTIVE if it was PENDING_INSTALL
      if (service.status === 'PENDING_INSTALL') {
        await tx
          .update(afyaSolarClientServices)
          .set({
            status: 'ACTIVE',
            startDate: new Date(),
            updatedAt: new Date()
          })
          .where(eq(afyaSolarClientServices.id, validated.clientServiceId))
      }
    })

    return NextResponse.json({
      success: true,
      message: 'EAAS contract created successfully'
    })

  } catch (error) {
    console.error('Error creating EAAS contract:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/afya-solar/contracts
 * Fetch contracts with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'installment' | 'eaas'
    const serviceId = searchParams.get('serviceId')
    const status = searchParams.get('status')

    // Allow null for optional fields (DB returns null for nullable columns)
    let contracts: Array<{
      type: string
      id: number
      clientServiceId: number
      contractTotalPrice?: number | null
      durationMonths?: number | null
      upfrontAmountAgreed?: number | null
      balanceAmount?: number | null
      monthlyAmount?: number | null
      roundingAdjustment?: number | null
      contractStatus?: string | null
      billingModel?: string | null
      monthlyFee?: number | null
      minimumTermMonths?: number | null
      createdAt: Date | null
      updatedAt?: Date | null
      service: any
      isActive: boolean
    }> = []

    if (type === 'installment' || !type) {
      // Fetch installment contracts
      const installmentContracts = await db
        .select({
          id: afyaSolarInstallmentContracts.id,
          clientServiceId: afyaSolarInstallmentContracts.clientServiceId,
          contractTotalPrice: afyaSolarInstallmentContracts.contractTotalPrice,
          durationMonths: afyaSolarInstallmentContracts.durationMonths,
          upfrontAmountAgreed: afyaSolarInstallmentContracts.upfrontAmountAgreed,
          upfrontDueDate: afyaSolarInstallmentContracts.upfrontDueDate,
          balanceAmount: afyaSolarInstallmentContracts.balanceAmount,
          monthlyAmount: afyaSolarInstallmentContracts.monthlyAmount,
          roundingAdjustment: afyaSolarInstallmentContracts.roundingAdjustment,
          contractStatus: afyaSolarInstallmentContracts.contractStatus,
          createdAt: afyaSolarInstallmentContracts.createdAt,
          updatedAt: afyaSolarInstallmentContracts.updatedAt,
          service: {
            id: afyaSolarClientServices.id,
            facilityId: afyaSolarClientServices.facilityId,
            status: afyaSolarClientServices.status,
            siteName: afyaSolarClientServices.siteName
          }
        })
        .from(afyaSolarInstallmentContracts)
        .leftJoin(afyaSolarClientServices, eq(afyaSolarInstallmentContracts.clientServiceId, afyaSolarClientServices.id))
        .where(
          serviceId ? eq(afyaSolarInstallmentContracts.clientServiceId, parseInt(serviceId)) :
          status ? eq(afyaSolarInstallmentContracts.contractStatus, status) :
          undefined
        )
        .orderBy(desc(afyaSolarInstallmentContracts.createdAt))

      contracts = installmentContracts.map(contract => ({
        ...contract,
        type: 'INSTALLMENT',
        isActive: contract.contractStatus === 'ACTIVE'
      }))
    }

    if (type === 'eaas' || !type) {
      // Fetch EAAS contracts
      const eaasContracts = await db
        .select({
          id: afyaSolarEaasContracts.id,
          clientServiceId: afyaSolarEaasContracts.clientServiceId,
          billingModel: afyaSolarEaasContracts.billingModel,
          monthlyFee: afyaSolarEaasContracts.monthlyFee,
          minimumTermMonths: afyaSolarEaasContracts.minimumTermMonths,
          contractStatus: afyaSolarEaasContracts.contractStatus,
          createdAt: afyaSolarEaasContracts.createdAt,
          updatedAt: afyaSolarEaasContracts.updatedAt,
          service: {
            id: afyaSolarClientServices.id,
            facilityId: afyaSolarClientServices.facilityId,
            status: afyaSolarClientServices.status,
            siteName: afyaSolarClientServices.siteName
          }
        })
        .from(afyaSolarEaasContracts)
        .leftJoin(afyaSolarClientServices, eq(afyaSolarEaasContracts.clientServiceId, afyaSolarClientServices.id))
        .where(
          serviceId ? eq(afyaSolarEaasContracts.clientServiceId, parseInt(serviceId)) :
          status ? eq(afyaSolarEaasContracts.contractStatus, status) :
          undefined
        )
        .orderBy(desc(afyaSolarEaasContracts.createdAt))

      contracts = [
        ...contracts,
        ...eaasContracts.map(contract => ({
          ...contract,
          type: 'EAAS',
          isActive: contract.contractStatus === 'ACTIVE',
          minimumTermMonths: contract.minimumTermMonths ?? undefined
        }))
      ]
    }

    return NextResponse.json({
      success: true,
      data: contracts
    })

  } catch (error) {
    console.error('Error fetching contracts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
