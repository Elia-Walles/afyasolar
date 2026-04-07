import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { 
  afyaSolarClientServices,
  afyaSolarServiceStatusHistory,
  afyaSolarPackages,
  afyaSolarPlans,
  afyaSolarPlanPricing,
  afyaSolarInstallmentContracts,
  afyaSolarInstallmentSchedule,
  afyaSolarEaasContracts,
  afyaSolarSmartmeters
} from '@/lib/db/afya-solar-schema'
import { facilities } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = "force-dynamic"
export const revalidate = 0

// Validation schema
const updateServiceSchema = z.object({
  status: z.enum(['PENDING_INSTALL', 'ACTIVE', 'SUSPENDED_OVERDUE', 'SUSPENDED_ADMIN', 'CANCELLED', 'COMPLETED']).optional(),
  siteName: z.string().optional(),
  serviceLocation: z.string().optional(),
  smartmeterId: z.number().positive().optional(),
  autoSuspendEnabled: z.boolean().optional(),
  graceDays: z.number().int().min(0).max(30).optional(),
  adminNotes: z.string().optional(),
  reasonCode: z.string().optional(),
  reasonText: z.string().optional()
})

/**
 * GET /api/afya-solar/client-services/[id]
 * Fetch a specific client service with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceId = parseInt(params.id)
    if (isNaN(serviceId)) {
      return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 })
    }

    // Fetch service with full details
    const [service] = await db
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
        smId: afyaSolarSmartmeters.id,
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
      .where(eq(afyaSolarClientServices.id, serviceId))
      .limit(1)

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Fetch status history
    const statusHistory = await db
      .select({
        id: afyaSolarServiceStatusHistory.id,
        oldStatus: afyaSolarServiceStatusHistory.oldStatus,
        newStatus: afyaSolarServiceStatusHistory.newStatus,
        reasonCode: afyaSolarServiceStatusHistory.reasonCode,
        reasonText: afyaSolarServiceStatusHistory.reasonText,
        changedByUserId: afyaSolarServiceStatusHistory.changedByUserId,
        createdAt: afyaSolarServiceStatusHistory.createdAt
      })
      .from(afyaSolarServiceStatusHistory)
      .where(eq(afyaSolarServiceStatusHistory.clientServiceId, serviceId))
      .orderBy(desc(afyaSolarServiceStatusHistory.createdAt))

    // Fetch contracts (installment or EAAS)
    let contracts = null
    if (service.planTypeCode === 'INSTALLMENT') {
      const [installmentContract] = await db
        .select({
          id: afyaSolarInstallmentContracts.id,
          contractTotalPrice: afyaSolarInstallmentContracts.contractTotalPrice,
          durationMonths: afyaSolarInstallmentContracts.durationMonths,
          upfrontAmountAgreed: afyaSolarInstallmentContracts.upfrontAmountAgreed,
          upfrontDueDate: afyaSolarInstallmentContracts.upfrontDueDate,
          balanceAmount: afyaSolarInstallmentContracts.balanceAmount,
          monthlyAmount: afyaSolarInstallmentContracts.monthlyAmount,
          roundingAdjustment: afyaSolarInstallmentContracts.roundingAdjustment,
          contractStatus: afyaSolarInstallmentContracts.contractStatus,
          createdAt: afyaSolarInstallmentContracts.createdAt
        })
        .from(afyaSolarInstallmentContracts)
        .where(eq(afyaSolarInstallmentContracts.clientServiceId, serviceId))
        .limit(1)

      if (installmentContract) {
        // Fetch payment schedule
        const paymentSchedule = await db
          .select({
            id: afyaSolarInstallmentSchedule.id,
            periodNo: afyaSolarInstallmentSchedule.periodNo,
            dueDate: afyaSolarInstallmentSchedule.dueDate,
            amountDue: afyaSolarInstallmentSchedule.amountDue,
            invoiceId: afyaSolarInstallmentSchedule.invoiceId,
            status: afyaSolarInstallmentSchedule.status,
            createdAt: afyaSolarInstallmentSchedule.createdAt
          })
          .from(afyaSolarInstallmentSchedule)
          .where(eq(afyaSolarInstallmentSchedule.installmentContractId, installmentContract.id))
          .orderBy(afyaSolarInstallmentSchedule.periodNo)

        contracts = {
          type: 'INSTALLMENT',
          contract: installmentContract,
          paymentSchedule
        }
      }
    } else if (service.planTypeCode === 'EAAS') {
      const [eaasContract] = await db
        .select({
          id: afyaSolarEaasContracts.id,
          billingModel: afyaSolarEaasContracts.billingModel,
          monthlyFee: afyaSolarEaasContracts.monthlyFee,
          minimumTermMonths: afyaSolarEaasContracts.minimumTermMonths,
          contractStatus: afyaSolarEaasContracts.contractStatus,
          createdAt: afyaSolarEaasContracts.createdAt
        })
        .from(afyaSolarEaasContracts)
        .where(eq(afyaSolarEaasContracts.clientServiceId, serviceId))
        .limit(1)

      contracts = {
        type: 'EAAS',
        contract: eaasContract
      }
    }

    // Transform flat response into nested structure
    const transformedService = {
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
      smartmeter: service.smId ? {
        id: service.smId,
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
      smId: undefined,
      smartmeterSerial: undefined,
      smartmeterVendor: undefined,
      smartmeterSiteAddress: undefined,
      smartmeterInstalledAt: undefined,
      smartmeterLastSeenAt: undefined,
      statusHistory,
      contracts,
      autoSuspendEnabled: service.autoSuspendEnabled === 1
    }

    return NextResponse.json({
      success: true,
      data: transformedService
    })

  } catch (error) {
    console.error('Error fetching client service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/afya-solar/client-services/[id]
 * Update a client service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceId = parseInt(params.id)
    if (isNaN(serviceId)) {
      return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 })
    }

    const body = await request.json()
    const validated = updateServiceSchema.parse(body)

    // Check if service exists
    const [existingService] = await db
      .select()
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.id, serviceId))
      .limit(1)

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      const oldStatus = existingService.status
      const newStatus = validated.status

      // Update service
      await tx
        .update(afyaSolarClientServices)
        .set({
          status: newStatus,
          siteName: validated.siteName,
          serviceLocation: validated.serviceLocation,
          smartmeterId: validated.smartmeterId,
          autoSuspendEnabled: validated.autoSuspendEnabled !== undefined ? (validated.autoSuspendEnabled ? 1 : 0) : existingService.autoSuspendEnabled,
          graceDays: validated.graceDays !== undefined ? validated.graceDays : existingService.graceDays,
          adminNotes: validated.adminNotes,
          updatedAt: new Date()
        })
        .where(eq(afyaSolarClientServices.id, serviceId))

      // Create status history entry if status changed
      if (newStatus && newStatus !== oldStatus) {
        await tx.insert(afyaSolarServiceStatusHistory).values({
          clientServiceId: serviceId,
          oldStatus,
          newStatus,
          reasonCode: validated.reasonCode || 'ADMIN_UPDATE',
          reasonText: validated.reasonText || 'Service updated by admin',
          changedByUserId: session.user.id
        })

        // Handle status-specific actions
        if (newStatus === 'ACTIVE' && oldStatus === 'PENDING_INSTALL') {
          // TODO: Create contracts when service becomes active
          // This will be implemented in Contract Management System
        } else if (newStatus === 'CANCELLED' || newStatus === 'COMPLETED') {
          // TODO: Handle service termination
          // This will be implemented in Contract Management System
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Service updated successfully'
    })

  } catch (error) {
    console.error('Error updating client service:', error)
    
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
 * DELETE /api/afya-solar/client-services/[id]
 * Delete a client service (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceId = parseInt(params.id)
    if (isNaN(serviceId)) {
      return NextResponse.json({ error: 'Invalid service ID' }, { status: 400 })
    }

    // Check if service exists
    const [existingService] = await db
      .select()
      .from(afyaSolarClientServices)
      .where(eq(afyaSolarClientServices.id, serviceId))
      .limit(1)

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Check if service can be deleted (not active contracts)
    if (existingService.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot delete active service. Cancel or complete the service first.' },
        { status: 400 }
      )
    }

    // Start a transaction to delete all related data
    await db.transaction(async (tx) => {
      // Delete status history
      await tx
        .delete(afyaSolarServiceStatusHistory)
        .where(eq(afyaSolarServiceStatusHistory.clientServiceId, serviceId))

      // Delete contracts and schedules
      const [installmentContract] = await tx
        .select()
        .from(afyaSolarInstallmentContracts)
        .where(eq(afyaSolarInstallmentContracts.clientServiceId, serviceId))
        .limit(1)

      if (installmentContract) {
        // Delete payment schedule
        await tx
          .delete(afyaSolarInstallmentSchedule)
          .where(eq(afyaSolarInstallmentSchedule.installmentContractId, installmentContract.id))

        // Delete installment contract
        await tx
          .delete(afyaSolarInstallmentContracts)
          .where(eq(afyaSolarInstallmentContracts.clientServiceId, serviceId))
      }

      // Delete EAAS contract if exists
      await tx
        .delete(afyaSolarEaasContracts)
        .where(eq(afyaSolarEaasContracts.clientServiceId, serviceId))

      // Delete service
      await tx
        .delete(afyaSolarClientServices)
        .where(eq(afyaSolarClientServices.id, serviceId))
    })

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting client service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
