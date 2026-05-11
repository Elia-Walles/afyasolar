import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { createAzamPayService } from '@/lib/payments/azam-pay'
import { db } from '@/lib/db'
import { serviceAccessPayments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { formatCurrency } from '@/lib/utils'
import { 
  createTransaction, 
  updateTransactionStatus,
  generateExternalId
} from '@/lib/payments/transaction-service'
import { afyaSolarPackages, afyaSolarPlans, afyaSolarPlanPricing } from '@/lib/db/afya-solar-schema'
import {
  getContractForFacility,
  getNextPendingEntry,
} from '@/lib/payg-financing/queries'

export const dynamic = "force-dynamic"
export const revalidate = 0

function maskSensitive(value: string, opts?: { keepStart?: number; keepEnd?: number }) {
  const keepStart = opts?.keepStart ?? 3
  const keepEnd = opts?.keepEnd ?? 2
  if (!value) return value
  const v = String(value)
  if (v.length <= keepStart + keepEnd) return '*'.repeat(v.length)
  return `${v.slice(0, keepStart)}${'*'.repeat(v.length - keepStart - keepEnd)}${v.slice(-keepEnd)}`
}

/**
 * Normalize mobile number to Azam Pay format (255XXXXXXXXX - 12 digits, no + sign)
 * Accepts: +255712345678, 0712345678, 255712345678, 255 712 345 678
 * Returns: 255712345678
 */
function normalizeMobileNumber(mobile: string): string {
  if (!mobile || typeof mobile !== 'string') {
    throw new Error('Mobile number is required and must be a string')
  }
  
  // Remove all spaces and non-digit characters except +
  let cleaned = mobile.replace(/\s/g, '').trim()
  
  // Remove + sign if present
  cleaned = cleaned.replace(/^\+/, '')
  
  // Extract only digits
  const digitsOnly = cleaned.replace(/\D/g, '')
  
  // If no digits found, throw error
  if (digitsOnly.length === 0) {
    throw new Error('Invalid mobile number format: no digits found')
  }
  
  // Handle different input formats
  let normalized: string
  
  if (digitsOnly.startsWith('255') && digitsOnly.length === 12) {
    // Already in correct format: 255712345678
    normalized = digitsOnly
  } else if (digitsOnly.startsWith('255') && digitsOnly.length > 12) {
    // Has 255 prefix but too many digits: take first 12
    normalized = digitsOnly.substring(0, 12)
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    // Local format: 0712345678 -> 255712345678
    normalized = '255' + digitsOnly.substring(1)
  } else if (digitsOnly.length === 9) {
    // 9 digits without prefix: 712345678 -> 255712345678
    normalized = '255' + digitsOnly
  } else if (digitsOnly.length === 10 && !digitsOnly.startsWith('0')) {
    // 10 digits without 0: take last 9 and add 255
    normalized = '255' + digitsOnly.substring(1)
  } else if (digitsOnly.length >= 9) {
    // Take last 9 digits and add 255 prefix
    const last9 = digitsOnly.slice(-9)
    normalized = '255' + last9
  } else {
    // Too few digits
    throw new Error(`Invalid mobile number format: expected 9-12 digits, got ${digitsOnly.length}`)
  }
  
  // Final validation: must be exactly 12 digits starting with 255
  if (!normalized.startsWith('255') || normalized.length !== 12) {
    throw new Error(`Failed to normalize mobile number: ${mobile} -> ${normalized}`)
  }
  
  return normalized
}

const initiatePaymentSchema = z.object({
  serviceName: z.enum(['afya-solar', 'equipment-resale', 'payg-financing']),
  amount: z.number().positive().optional(),
  mobile: z.string().min(9).max(15).optional(),
  accountNumber: z.string().optional(),
  provider: z.enum(['Airtel', 'Tigo', 'Mpesa', 'Halopesa']).optional(),
  paymentType: z.enum(['mobile', 'bank']),
  selectedBank: z.enum(['NMB', 'CRDB']).optional(), // Only NMB and CRDB are supported by Azam Pay
  // Bank payment specific fields (required for bank checkout)
  bankMobile: z.string().min(9).max(15).optional(), // Mobile number linked to bank account
  otp: z.string().min(4).max(8).optional(), // OTP for bank verification
  // For Afya Solar: package selection details
  packageId: z.string().optional(),
  packageName: z.string().optional(),
  paymentPlan: z.enum(['cash', 'installment', 'paas']).optional(),
  packageMetadata: z.record(z.any()).optional(), // Additional package details as JSON
  // For Equipment Resale: resale item ID
  resaleItemId: z.string().uuid().optional(),
  // For PAYG & Financing: contract + repayment mode (server resolves the amount)
  paygContractId: z.string().uuid().optional(),
  paygRepaymentMode: z.enum(['installment', 'full']).optional(),
})

async function getAfyaSolarExpectedAmount(args: {
  packageId: string
  paymentPlan: 'cash' | 'installment' | 'paas'
}) {
  const pkgIdNum = Number.parseInt(args.packageId, 10)
  if (!Number.isFinite(pkgIdNum)) {
    throw new Error('Invalid packageId for Afya Solar payment')
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
  const installmentMonthly =
    installmentPlan?.defaultMonthlyAmount != null ? Number(installmentPlan.defaultMonthlyAmount) : null
  const installmentMonths =
    installmentPlan?.installmentDurationMonths != null ? Number(installmentPlan.installmentDurationMonths) : null
  const eaasMonthlyFee = eaasPlan?.eaasMonthlyFee != null ? Number(eaasPlan.eaasMonthlyFee) : null

  if (args.paymentPlan === 'cash') {
    if (!cashPrice) throw new Error('Cash pricing not configured for this package')
    return {
      expectedAmount: cashPrice,
      pricing: { cashPrice, upfrontPercent, installmentMonthly, installmentMonths, eaasMonthlyFee },
    }
  }

  if (args.paymentPlan === 'installment') {
    if (!cashPrice) throw new Error('Cash pricing required to compute installment upfront amount')
    const expectedAmount = Math.round((upfrontPercent / 100) * cashPrice)
    return {
      expectedAmount,
      pricing: { cashPrice, upfrontPercent, installmentMonthly, installmentMonths, eaasMonthlyFee },
    }
  }

  // paas
  if (!eaasMonthlyFee) throw new Error('EaaS monthly fee not configured for this package')
  return {
    expectedAmount: eaasMonthlyFee,
    pricing: { cashPrice, upfrontPercent, installmentMonthly, installmentMonths, eaasMonthlyFee },
  }
}

/**
 * POST /api/payments/azam-pay/initiate
 * Initiate payment through Azam Pay with comprehensive transaction tracking
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
    // Avoid logging sensitive data (OTP, account numbers, phone numbers).
    console.log('[AfyaSolarPayment][INITIATE] Request received', {
      hasMobile: Boolean(body?.mobile),
      hasBankMobile: Boolean(body?.bankMobile),
      hasOtp: Boolean(body?.otp),
      hasAccountNumber: Boolean(body?.accountNumber),
      provider: body?.provider,
      paymentType: body?.paymentType,
      serviceName: body?.serviceName,
      packageId: body?.packageId,
      paymentPlan: body?.paymentPlan,
      amount: body?.amount,
    })
    const { 
      serviceName, 
      amount: clientAmount, 
      mobile, 
      accountNumber, 
      provider, 
      paymentType,
      selectedBank,
      bankMobile,
      otp,
      packageId,
      packageName,
      paymentPlan,
      packageMetadata,
      resaleItemId,
      paygContractId,
      paygRepaymentMode,
    } = initiatePaymentSchema.parse(body)

    // For Afya Solar, never trust the client-provided amount.
    // Always compute expected amount from DB pricing based on package + plan.
    let amount = clientAmount ?? 0
    let verifiedPricing: Record<string, any> | null = null
    let paygTargetEntryId: string | null = null
    let paygResolved: {
      contractId: string
      mode: 'installment' | 'full'
      targetEntryId: string | null
      outstandingBalance: number
    } | null = null

    if (serviceName === 'payg-financing') {
      if (!paygContractId || !paygRepaymentMode) {
        return NextResponse.json(
          { error: 'paygContractId and paygRepaymentMode are required for PAYG & Financing payments' },
          { status: 400 },
        )
      }

      const contract = await getContractForFacility(paygContractId, facilityId)
      if (!contract) {
        return NextResponse.json(
          { error: 'Contract not found or not owned by this facility' },
          { status: 403 },
        )
      }
      if (contract.status !== 'active') {
        return NextResponse.json(
          { error: `Contract is ${contract.status}; cannot accept further payments` },
          { status: 400 },
        )
      }

      const outstanding = Number(contract.outstandingBalance) || 0
      if (outstanding <= 0) {
        return NextResponse.json(
          { error: 'Contract has no outstanding balance' },
          { status: 400 },
        )
      }

      if (paygRepaymentMode === 'installment') {
        const nextEntry = await getNextPendingEntry(paygContractId)
        if (!nextEntry) {
          return NextResponse.json(
            { error: 'No pending installment found for this contract' },
            { status: 400 },
          )
        }
        amount = Math.min(Number(nextEntry.amount) || 0, outstanding)
        paygTargetEntryId = nextEntry.id
      } else {
        amount = outstanding
        paygTargetEntryId = null
      }

      if (amount <= 0) {
        return NextResponse.json(
          { error: 'Resolved repayment amount must be greater than zero' },
          { status: 400 },
        )
      }

      paygResolved = {
        contractId: paygContractId,
        mode: paygRepaymentMode,
        targetEntryId: paygTargetEntryId,
        outstandingBalance: outstanding,
      }

      console.log('[PaygFinancing][INITIATE] Resolved repayment amount', {
        facilityId,
        paygContractId,
        paygRepaymentMode,
        paygTargetEntryId,
        amount,
        outstanding,
      })
    } else if (serviceName === 'afya-solar') {
      if (!packageId || !paymentPlan) {
        return NextResponse.json(
          { error: 'packageId and paymentPlan are required for Afya Solar payments' },
          { status: 400 }
        )
      }
      const computed = await getAfyaSolarExpectedAmount({ packageId, paymentPlan })
      amount = computed.expectedAmount
      verifiedPricing = computed.pricing
      console.log('[AfyaSolarPayment][INITIATE] Verified Afya Solar pricing', {
        facilityId,
        packageId,
        packageName,
        paymentPlan,
        clientAmount,
        computedAmount: amount,
        pricing: verifiedPricing,
      })
    }

    // Validate payment type requirements
    if (paymentType === 'mobile' && (!mobile || !provider)) {
      return NextResponse.json(
        { error: 'Mobile number and provider are required for mobile payment' },
        { status: 400 }
      )
    }

    if (paymentType === 'bank') {
      if (!accountNumber || !selectedBank) {
        return NextResponse.json(
          { error: 'Bank selection and account number are required for bank payment' },
          { status: 400 }
        )
      }
      if (!bankMobile) {
        return NextResponse.json(
          { error: 'Mobile number linked to bank account is required' },
          { status: 400 }
        )
      }
      if (!otp) {
        return NextResponse.json(
          { error: 'OTP is required for bank payment' },
          { status: 400 }
        )
      }
    }

    // Check if facility already has a completed payment for this service
    // Skip this check for equipment-resale and payg-financing as they support multiple payments
    if (serviceName !== 'equipment-resale' && serviceName !== 'payg-financing') {
      const existingPayment = await db
        .select()
        .from(serviceAccessPayments)
        .where(
          and(
            eq(serviceAccessPayments.facilityId, facilityId),
            eq(serviceAccessPayments.serviceName, serviceName),
            eq(serviceAccessPayments.status, 'completed')
          )
        )
        .limit(1)

      if (existingPayment.length > 0) {
        return NextResponse.json(
          { error: 'Payment already completed for this service' },
          { status: 400 }
        )
      }
    }

    // Prepare request payload for logging
    const requestPayload = {
      serviceName,
      amount,
      paymentType,
      provider: paymentType === 'mobile' ? provider : selectedBank,
      mobileNumber: paymentType === 'mobile' ? mobile : bankMobile,
      ...(serviceName === 'afya-solar'
        ? {
            packageId,
            packageName,
            paymentPlan,
            verifiedPricing,
            clientAmount,
          }
        : null),
      ...(serviceName === 'payg-financing' && paygResolved
        ? {
            paygContractId: paygResolved.contractId,
            paygRepaymentMode: paygResolved.mode,
            paygTargetEntryId: paygResolved.targetEntryId,
            paygOutstandingAtInitiation: paygResolved.outstandingBalance,
          }
        : null),
      timestamp: new Date().toISOString(),
    }

    // =====================================================
    // STEP 1: Create Transaction in Database (Status: initiated)
    // =====================================================
    const transaction = await createTransaction({
      facilityId,
      serviceName,
      amount,
      currency: 'TZS',
      paymentType,
      paymentMethod: paymentType === 'mobile' ? provider!.toLowerCase() : selectedBank!.toLowerCase(),
      mobileNumber: paymentType === 'mobile' ? mobile : undefined,
      mobileProvider: paymentType === 'mobile' ? provider : undefined,
      bankName: paymentType === 'bank' ? selectedBank : undefined,
      bankAccountNumber: paymentType === 'bank' ? accountNumber : undefined,
      bankMobileNumber: paymentType === 'bank' ? bankMobile : undefined,
      requestPayload,
    })

    console.log('=== TRANSACTION CREATED ===')
    console.log({
      transactionId: transaction.id,
      externalId: transaction.externalId,
      status: transaction.status,
      facilityId,
      serviceName,
      amount,
    })

    // Create service access payment record linked to transaction
    const paymentId = crypto.randomUUID()
    
    // Prepare metadata based on service type
    let metadataObj: Record<string, any> = {}
    if (serviceName === 'afya-solar' && packageMetadata) {
      metadataObj = packageMetadata
    }
    if (serviceName === 'equipment-resale' && resaleItemId) {
      metadataObj.resaleItemId = resaleItemId
    }
    if (paymentType === 'bank' && selectedBank) {
      metadataObj.selectedBank = selectedBank
    }
    metadataObj.transactionId = transaction.id
    if (serviceName === 'afya-solar' && verifiedPricing) {
      metadataObj.verifiedPricing = verifiedPricing
      metadataObj.paymentPlan = paymentPlan
    }
    if (serviceName === 'payg-financing' && paygResolved) {
      metadataObj.paygContractId = paygResolved.contractId
      metadataObj.paygRepaymentMode = paygResolved.mode
      metadataObj.paygTargetEntryId = paygResolved.targetEntryId
    }

    await db.insert(serviceAccessPayments).values({
      id: paymentId,
      facilityId,
      serviceName,
      amount: String(amount),
      currency: 'TZS',
      paymentMethod: paymentType === 'mobile' ? provider?.toLowerCase() : 'bank',
      transactionId: transaction.externalId,
      status: 'pending',
      paidAt: null,
      // Package selection details (for Afya Solar and Afya Booking)
      packageId: packageId || null,
      packageName: packageName || null,
      paymentPlan: paymentPlan || null,
      metadata: Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null,
    })

    // =====================================================
    // STEP 2: Send to Azam Pay (Status: pending)
    // =====================================================
    await updateTransactionStatus({
      transactionId: transaction.id,
      status: 'pending',
      statusMessage: 'Payment request sent to Azam Pay',
      changedBy: 'system',
    })

    // Initialize Azam Pay service
    const azamPay = createAzamPayService()

    // Initiate payment based on type
    let checkoutResponse
    if (paymentType === 'mobile' && mobile && provider) {
      // Normalize mobile number to Azam Pay format (255XXXXXXXXX - no + sign)
      let normalizedMobile: string
      try {
        normalizedMobile = normalizeMobileNumber(mobile)
      } catch (error: any) {
        // Update transaction as failed due to invalid mobile number
        await updateTransactionStatus({
          transactionId: transaction.id,
          status: 'failed',
          statusMessage: error.message || 'Invalid mobile number format',
          failureReason: 'invalid_mobile_number',
          changedBy: 'system',
        })
        
        return NextResponse.json(
          { error: error.message || 'Invalid mobile number format. Please enter a valid Tanzania mobile number (e.g., +255712345678 or 0712345678)' },
          { status: 400 }
        )
      }
      
      console.log('Mobile number normalization:', {
        original: mobile,
        normalized: normalizedMobile,
        provider,
      })
      
      // For mobile checkout, accountNumber is the mobile number in international format
      checkoutResponse = await azamPay.mobileCheckout({
        amount,
        accountNumber: normalizedMobile, // Use normalized format (255XXXXXXXXX)
        externalId: transaction.externalId,
        provider,
        currency: 'TZS',
      })
    } else if (paymentType === 'bank' && accountNumber && selectedBank && bankMobile && otp) {
      // Normalize bank mobile number to Azam Pay format
      let normalizedBankMobile: string
      try {
        normalizedBankMobile = normalizeMobileNumber(bankMobile)
      } catch (error: any) {
        // Update transaction as failed due to invalid mobile number
        await updateTransactionStatus({
          transactionId: transaction.id,
          status: 'failed',
          statusMessage: error.message || 'Invalid bank mobile number format',
          failureReason: 'invalid_mobile_number',
          changedBy: 'system',
        })
        
        return NextResponse.json(
          { error: error.message || 'Invalid bank mobile number format. Please enter a valid Tanzania mobile number (e.g., +255712345678 or 0712345678)' },
          { status: 400 }
        )
      }
      
      console.log('Bank mobile number normalization:', {
        original: bankMobile,
        normalized: normalizedBankMobile,
        bank: selectedBank,
      })
      
      checkoutResponse = await azamPay.bankCheckout({
        amount,
        merchantAccountNumber: accountNumber,
        merchantMobileNumber: normalizedBankMobile, // Use normalized format (255XXXXXXXXX)
        otp,
        provider: selectedBank as 'CRDB' | 'NMB',
        referenceId: transaction.externalId,
        currency: 'TZS',
      })
    } else {
      // Update transaction as failed
      await updateTransactionStatus({
        transactionId: transaction.id,
        status: 'failed',
        statusMessage: 'Invalid payment type or missing required fields',
        failureReason: 'validation_error',
        changedBy: 'system',
      })

      return NextResponse.json(
        { error: 'Invalid payment type or missing required fields' },
        { status: 400 }
      )
    }

    console.log('=== AZAM PAY RESPONSE ===')
    console.log({
      success: checkoutResponse.success,
      transactionId: checkoutResponse.transactionId,
      message: checkoutResponse.message,
    })

    if (!checkoutResponse.success) {
      // =====================================================
      // STEP 3a: Payment initiation failed
      // =====================================================
      const errorMessage = checkoutResponse.message || 'Failed to initiate payment with Azam Pay'
      
      // Provide user-friendly error messages for common issues
      let userFriendlyError = errorMessage
      if (errorMessage.toLowerCase().includes('min and max amount') || errorMessage.toLowerCase().includes('min and max')) {
        userFriendlyError = `The payment amount (${formatCurrency(amount)}) exceeds the transaction limits for ${provider || 'mobile money'}. For large amounts, please use Bank Transfer instead, or contact support for assistance.`
      } else if (errorMessage.toLowerCase().includes('insufficient') || errorMessage.toLowerCase().includes('balance')) {
        userFriendlyError = 'Insufficient balance in your mobile money account. Please ensure you have enough funds and try again.'
      } else if (errorMessage.toLowerCase().includes('invalid') && errorMessage.toLowerCase().includes('account')) {
        userFriendlyError = 'Invalid mobile number or account. Please check your mobile number and try again.'
      }
      
      await updateTransactionStatus({
        transactionId: transaction.id,
        status: 'failed',
        statusMessage: userFriendlyError,
        failureReason: errorMessage, // Store original error message
        responsePayload: checkoutResponse.data,
        changedBy: 'azam_pay',
      })

      // Update service access payment status
      await db
        .update(serviceAccessPayments)
        .set({
          status: 'failed',
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(serviceAccessPayments.id, paymentId))

      return NextResponse.json(
        { error: userFriendlyError },
        { status: 400 }
      )
    }

    // =====================================================
    // STEP 3b: Payment sent successfully - awaiting customer confirmation
    // =====================================================
    await updateTransactionStatus({
      transactionId: transaction.id,
      status: 'awaiting_confirmation',
      statusMessage: `PIN prompt sent to customer phone (${paymentType === 'mobile' ? normalizeMobileNumber(mobile!) : normalizeMobileNumber(bankMobile!)}). Please check your phone and enter PIN to complete payment.`,
      azamTransactionId: checkoutResponse.transactionId,
      responsePayload: checkoutResponse.data,
      changedBy: 'azam_pay',
    })

    // Update service access payment with Azam Pay transaction ID
    await db
      .update(serviceAccessPayments)
      .set({
        transactionId: checkoutResponse.transactionId || transaction.externalId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(serviceAccessPayments.id, paymentId))

    return NextResponse.json({
      success: true,
      message: `Payment initiated successfully. Please check your phone (${paymentType === 'mobile' ? normalizeMobileNumber(mobile!) : normalizeMobileNumber(bankMobile!)}) for the PIN prompt to complete the payment.`,
      payment: {
        id: paymentId,
        transactionId: transaction.id,
        externalId: transaction.externalId,
        azamTransactionId: checkoutResponse.transactionId || null,
        status: 'awaiting_confirmation',
        expiresAt: transaction.expiresAt,
      },
      checkoutData: checkoutResponse.data,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error initiating Azam Pay payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
