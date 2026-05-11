import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { paymentTransactions, serviceAccessPayments, serviceSubscriptions, maintenanceRequests, maintenancePlanPayments, maintenancePlanProposals, maintenancePlanRequests, resaleInventory } from '@/lib/db/schema'
import { eq, or, sql, and } from 'drizzle-orm'
import { 
  updateTransactionStatus,
  findTransactionByReference,
  type TransactionStatus
} from '@/lib/payments/transaction-service'
import { createAzamPayService } from '@/lib/payments/azam-pay'
import { sendPaymentVerificationSMS } from '@/lib/sms'
import { applyPayment as applyPaygPayment } from '@/lib/payg-financing/queries'

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
 * Azam Pay Callback Request Structure (from official docs)
 * 
 * Required fields:
 * - message: Transaction description message
 * - transactionstatus: Transaction status (success or failure)
 * - operator: Mobile network operator (Airtel, Tigo, Mpesa, etc.)
 * - reference: Transaction reference ID (Azam Pay's internal reference)
 * - externalreference: External reference ID (our externalId/transactionId)
 * - utilityref: Utility reference ID (belongs to our application)
 * - amount: Transaction amount
 * - transid: Transaction ID
 * - msisdn: Mobile Subscriber ISDN Number (phone number)
 * - mnoreference: Mobile network operator reference
 */
interface AzamPayCallback {
  message?: string
  transactionstatus: string // 'success' | 'failed' | 'pending'
  operator?: string
  reference?: string // Azam Pay's reference
  externalreference?: string // Our external ID
  utilityref?: string // Our utility reference
  amount?: string
  transid?: string // Transaction ID
  msisdn?: string // Phone number
  mnoreference?: string
  submerchantAcc?: string
  additionalProperties?: Record<string, any>
  // Alternative field names (some callbacks use these)
  transactionId?: string
  externalId?: string
  status?: string
}

/**
 * POST /api/payments/azam-pay/callback
 * Webhook endpoint for Azam Pay payment callbacks
 */
export async function POST(request: NextRequest) {
  const callbackStartTime = Date.now()
  const sourceIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const requestId = `CB-${Date.now()}-${Math.random().toString(36).substring(7)}`

    console.log('═══════════════════════════════════════════════════')
    console.log('       AZAM PAY CALLBACK RECEIVED')
    console.log('═══════════════════════════════════════════════════')
  console.log(`[${requestId}] Callback Request Started`)
  console.log(`[${requestId}] Timestamp:`, new Date().toISOString())
  console.log(`[${requestId}] Source IP:`, sourceIp)
  console.log(`[${requestId}] Request Headers:`, {
    'content-type': request.headers.get('content-type'),
    'user-agent': request.headers.get('user-agent'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
    'x-real-ip': request.headers.get('x-real-ip'),
  })
  
  try {
    const rawBody = await request.text()
    // Avoid logging raw webhook payload; it can contain PII (e.g., msisdn).
    console.log(`[${requestId}] Raw callback received (bytes):`, rawBody.length)
    
    let body: AzamPayCallback
    try {
      body = JSON.parse(rawBody)
    } catch (parseError: any) {
      console.error(`[${requestId}] ❌ JSON Parse Error:`, {
        error: parseError.message,
        rawBody: rawBody.substring(0, 500),
      })
      return NextResponse.json(
        { error: 'Invalid JSON in callback body' },
        { status: 400 }
      )
    }

    // Log a redacted callback summary for debugging without PII leakage.
    const redacted = {
      ...body,
      msisdn: body.msisdn ? maskSensitive(body.msisdn) : undefined,
      bankAccountNumber: (body as any).bankAccountNumber ? maskSensitive(String((body as any).bankAccountNumber)) : undefined,
    }
    console.log(`[${requestId}] Parsed callback body (redacted):`, JSON.stringify(redacted, null, 2))
    console.log(`[${requestId}] Callback body keys:`, Object.keys(body))
    console.log('═══════════════════════════════════════════════════')

    // Extract transaction identifiers (Azam Pay may use different field names)
    // NOTE: AzamPay docs say `utilityref` is OUR application's reference (PAY-xxx)
    // while `externalreference` is supposed to mirror it. In practice some
    // providers (e.g. Halopesa) put AzamPay's own reference into
    // `externalreference` and leave OUR PAY-xxx ID only in `utilityref`.
    // We therefore prefer `utilityref` when it looks like our own ID, and we
    // always retry every candidate field below.
    const transactionId = body.transid || body.transactionId || body.reference
    const utilityRef = body.utilityref || null
    const rawExternalRef = body.externalreference || body.externalId || null
    const looksLikeOurExternalId = (s?: string | null) =>
      !!s && /^PAY[-_]/i.test(s)
    const externalReference =
      (looksLikeOurExternalId(utilityRef) ? utilityRef : null) ||
      rawExternalRef ||
      utilityRef
    const transactionStatus = body.transactionstatus || body.status
    const azamReference = body.reference
    const mnoReference = body.mnoreference

    console.log(`[${requestId}] ========== IDENTIFIER EXTRACTION ==========`)
    console.log(`[${requestId}] Extracted identifiers:`, {
      transactionId,
      externalReference,
      utilityRef,
      rawExternalRef,
      azamReference,
      mnoReference,
      transactionStatus,
      'body.transid': body.transid,
      'body.transactionId': body.transactionId,
      'body.reference': body.reference,
      'body.externalreference': body.externalreference,
      'body.externalId': body.externalId,
      'body.utilityref': body.utilityref,
      'body.transactionstatus': body.transactionstatus,
      'body.status': body.status,
    })
    console.log(`[${requestId}] ==========================================`)

    if (!transactionId && !externalReference && !utilityRef) {
      console.error(`[${requestId}] ❌ Callback missing identifiers`)
      console.error(`[${requestId}] Full body:`, JSON.stringify(body, null, 2))
      console.error(`[${requestId}] All body keys:`, Object.keys(body))
      return NextResponse.json(
        { error: 'Transaction ID or External Reference required', requestId },
        { status: 400 }
      )
    }

    // =====================================================
    // Find the transaction in our database
    // =====================================================
    console.log(`[${requestId}] ========== TRANSACTION SEARCH START ==========`)
    let transaction = null
    const searchAttempts: Array<{ method: string; identifier: string; found: boolean; result?: any }> = []

    // Try to find by external reference first (our PAY-xxx ID)
    if (externalReference) {
      console.log(`[${requestId}] 🔍 Attempt 1: Searching by externalReference: "${externalReference}"`)
      try {
      transaction = await findTransactionByReference(externalReference)
        const found = !!transaction
        searchAttempts.push({ method: 'externalReference', identifier: externalReference, found, result: transaction ? { id: transaction.id, externalId: transaction.externalId } : null })
        console.log(`[${requestId}] ${found ? '✅' : '❌'} Search by externalReference:`, externalReference, found ? 'FOUND' : 'NOT FOUND')
        if (transaction) {
          console.log(`[${requestId}] Transaction details:`, {
            id: transaction.id,
            externalId: transaction.externalId,
            azamTransactionId: transaction.azamTransactionId,
            azamReference: transaction.azamReference,
            status: transaction.status,
          })
        }
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Error searching by externalReference:`, error.message, error.stack)
        searchAttempts.push({ method: 'externalReference', identifier: externalReference, found: false })
      }
    }

    // Attempt 1b: explicitly try `utilityref` if it differs from the
    // externalReference we already searched. Some providers (Halopesa) put
    // AzamPay's own reference into `externalreference` and our PAY-xxx ID
    // only into `utilityref`, so this is the most reliable fallback.
    if (!transaction && utilityRef && utilityRef !== externalReference) {
      console.log(`[${requestId}] 🔍 Attempt 1b: Searching by utilityref: "${utilityRef}"`)
      try {
        transaction = await findTransactionByReference(utilityRef)
        const found = !!transaction
        searchAttempts.push({
          method: 'utilityRef',
          identifier: utilityRef,
          found,
          result: transaction ? { id: transaction.id, externalId: transaction.externalId } : null,
        })
        console.log(`[${requestId}] ${found ? '✅' : '❌'} Search by utilityref:`, utilityRef, found ? 'FOUND' : 'NOT FOUND')
        if (transaction) {
          console.log(`[${requestId}] Transaction details:`, {
            id: transaction.id,
            externalId: transaction.externalId,
            azamTransactionId: transaction.azamTransactionId,
            azamReference: transaction.azamReference,
            status: transaction.status,
          })
        }
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Error searching by utilityref:`, error.message, error.stack)
        searchAttempts.push({ method: 'utilityRef', identifier: utilityRef, found: false })
      }
    }

    // If not found, try by Azam reference (this is the reference number from SMS)
    // The 'reference' field from callback is Azam Pay's internal reference, which appears in SMS
    if (!transaction && azamReference) {
      console.log(`[${requestId}] 🔍 Attempt 2: Searching by azamReference: "${azamReference}"`)
      try {
        // Try to find by azamReference field first (this is where we should store it)
        console.log(`[${requestId}]   → Querying paymentTransactions.azamReference = "${azamReference}"`)
        const [byAzamRef] = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.azamReference, azamReference))
          .limit(1)
        
        if (byAzamRef) {
          transaction = byAzamRef
          searchAttempts.push({ method: 'azamReference (field)', identifier: azamReference, found: true, result: { id: transaction.id, externalId: transaction.externalId } })
          console.log(`[${requestId}] ✅ Found by azamReference field:`, azamReference)
          console.log(`[${requestId}] Transaction details:`, {
            id: transaction.id,
            externalId: transaction.externalId,
            azamTransactionId: transaction.azamTransactionId,
            status: transaction.status,
          })
        } else {
          console.log(`[${requestId}]   → Not found in azamReference field, trying externalId`)
          // Try to find by matching azamReference in externalId (fallback)
          const [byExternalId] = await db
            .select()
            .from(paymentTransactions)
            .where(eq(paymentTransactions.externalId, azamReference))
            .limit(1)
          
          if (byExternalId) {
            transaction = byExternalId
            searchAttempts.push({ method: 'azamReference (as externalId)', identifier: azamReference, found: true, result: { id: transaction.id, externalId: transaction.externalId } })
            console.log(`[${requestId}] ✅ Found by azamReference as externalId:`, azamReference)
          } else {
            searchAttempts.push({ method: 'azamReference', identifier: azamReference, found: false })
            console.log(`[${requestId}] ❌ Not found by azamReference (tried both field and externalId)`)
          }
        }
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Error searching by azamReference:`, error.message, error.stack)
        searchAttempts.push({ method: 'azamReference', identifier: azamReference, found: false })
      }
    }

    // If not found, try by Azam transaction ID
    if (!transaction && transactionId) {
      console.log(`[${requestId}] 🔍 Attempt 3: Searching by transactionId: "${transactionId}"`)
      try {
      transaction = await findTransactionByReference(transactionId)
        const found = !!transaction
        searchAttempts.push({ method: 'transactionId', identifier: transactionId, found, result: transaction ? { id: transaction.id, externalId: transaction.externalId } : null })
        console.log(`[${requestId}] ${found ? '✅' : '❌'} Search by transactionId:`, transactionId, found ? 'FOUND' : 'NOT FOUND')
        if (transaction) {
          console.log(`[${requestId}] Transaction details:`, {
            id: transaction.id,
            externalId: transaction.externalId,
            azamTransactionId: transaction.azamTransactionId,
            status: transaction.status,
          })
        }
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Error searching by transactionId:`, error.message, error.stack)
        searchAttempts.push({ method: 'transactionId', identifier: transactionId, found: false })
      }
    }

    // If still not found, try searching in service_access_payments
    if (!transaction) {
      console.log(`[${requestId}] 🔍 Attempt 4: Searching in serviceAccessPayments table`)
      try {
        const searchConditions = []
        const triedIds = new Set<string>()
        const addCondition = (id: string | null | undefined) => {
          if (!id || triedIds.has(id)) return
          triedIds.add(id)
          searchConditions.push(eq(serviceAccessPayments.transactionId, id))
          console.log(`[${requestId}]   → Searching serviceAccessPayments.transactionId = "${id}"`)
        }
        addCondition(externalReference)
        addCondition(utilityRef)
        addCondition(transactionId)
        addCondition(azamReference)
        
        if (searchConditions.length > 0) {
      const [accessPayment] = await db
        .select()
        .from(serviceAccessPayments)
            .where(or(...searchConditions))
        .limit(1)

      if (accessPayment) {
            console.log(`[${requestId}] ✅ Found serviceAccessPayment:`, {
              id: accessPayment.id,
              transactionId: accessPayment.transactionId,
              facilityId: accessPayment.facilityId,
              serviceName: accessPayment.serviceName,
            })
            
        // Find the related transaction
            console.log(`[${requestId}]   → Looking up related paymentTransaction by externalId: "${accessPayment.transactionId}"`)
        const [relatedTransaction] = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.externalId, accessPayment.transactionId || ''))
          .limit(1)
        
            if (relatedTransaction) {
        transaction = relatedTransaction
              searchAttempts.push({ method: 'serviceAccessPayments', identifier: accessPayment.transactionId || '', found: true, result: { id: transaction.id, externalId: transaction.externalId } })
              console.log(`[${requestId}] ✅ Found related transaction via serviceAccessPayments`)
            } else {
              console.log(`[${requestId}] ❌ ServiceAccessPayment found but no related transaction`)
              searchAttempts.push({ method: 'serviceAccessPayments', identifier: accessPayment.transactionId || '', found: false })
            }
          } else {
            console.log(`[${requestId}] ❌ Not found in serviceAccessPayments`)
            searchAttempts.push({ method: 'serviceAccessPayments', identifier: externalReference || transactionId || '', found: false })
          }
        }
      } catch (error: any) {
        console.error(`[${requestId}] ❌ Error searching in serviceAccessPayments:`, error.message, error.stack)
        searchAttempts.push({ method: 'serviceAccessPayments', identifier: externalReference || transactionId || '', found: false })
      }
    }
    
    console.log(`[${requestId}] ========== TRANSACTION SEARCH SUMMARY ==========`)
    console.log(`[${requestId}] Search attempts:`, JSON.stringify(searchAttempts, null, 2))
    console.log(`[${requestId}] Final result:`, transaction ? '✅ TRANSACTION FOUND' : '❌ TRANSACTION NOT FOUND')
    console.log(`[${requestId}] ================================================`)

    if (!transaction) {
      console.error(`[${requestId}] ❌❌❌ TRANSACTION NOT FOUND ❌❌❌`)
      console.error(`[${requestId}] All search attempts failed. Summary:`, JSON.stringify(searchAttempts, null, 2))
      console.error(`[${requestId}] Callback identifiers:`, {
        transactionId, 
        externalReference,
        azamReference,
        mnoReference,
        transactionStatus,
      })
      console.error(`[${requestId}] Full callback body:`, JSON.stringify(body, null, 2))
      return NextResponse.json(
        { error: 'Payment not found', requestId, searchAttempts },
        { status: 404 }
      )
    }

    console.log(`[${requestId}] ========== TRANSACTION FOUND ==========`)
    console.log(`[${requestId}] ✅ Transaction found:`, {
      id: transaction.id,
      externalId: transaction.externalId,
      azamTransactionId: transaction.azamTransactionId,
      azamReference: transaction.azamReference,
      mnoReference: transaction.mnoReference,
      currentStatus: transaction.status,
      facilityId: transaction.facilityId,
      serviceName: transaction.serviceName,
      amount: transaction.amount,
      currency: transaction.currency,
      billingCycle: transaction.billingCycle,
    })
    console.log(`[${requestId}] =======================================`)

    // =====================================================
    // Map Azam Pay status to our status
    // =====================================================
    console.log(`[${requestId}] ========== STATUS MAPPING ==========`)
    console.log(`[${requestId}] Raw transactionStatus from callback:`, transactionStatus)
    console.log(`[${requestId}] Current transaction status in DB:`, transaction.status)
    
    let newStatus: TransactionStatus = 'pending'
    const statusLower = (transactionStatus || '').toLowerCase().trim()
    
    console.log(`[${requestId}] Normalized status (lowercase):`, statusLower)
    
    // Handle various success status formats
    if (statusLower === 'success' || 
        statusLower === 'completed' || 
        statusLower === 'successful' ||
        statusLower === 'paid' ||
        statusLower === 'approved' ||
        statusLower === 'confirmed') {
      newStatus = 'completed'
      console.log(`[${requestId}] ✅ Mapped to: completed (success status)`)
    } 
    // Handle various failure status formats
    else if (statusLower === 'failed' || 
             statusLower === 'failure' || 
             statusLower === 'cancelled' || 
             statusLower === 'rejected' ||
             statusLower === 'declined' ||
             statusLower === 'error') {
      newStatus = 'failed'
      console.log(`[${requestId}] ❌ Mapped to: failed (failure status)`)
    } 
    // Handle processing/pending statuses
    else if (statusLower === 'pending' || 
             statusLower === 'processing' ||
             statusLower === 'in_progress' ||
             statusLower === 'awaiting') {
      newStatus = 'processing'
      console.log(`[${requestId}] ⏳ Mapped to: processing (pending status)`)
    } else {
      console.warn(`[${requestId}] ⚠️ Unknown status "${statusLower}", defaulting to: pending`)
    }
    
    console.log(`[${requestId}] Status mapping result: "${transactionStatus}" (${statusLower}) -> ${newStatus}`)
    console.log(`[${requestId}] Status change: ${transaction.status} -> ${newStatus}`)
    console.log(`[${requestId}] ====================================`)

    // =====================================================
    // Update transaction status
    // =====================================================
    console.log(`[${requestId}] ========== UPDATING TRANSACTION STATUS ==========`)
    console.log(`[${requestId}] Calling updateTransactionStatus with:`, {
      transactionId: transaction.id,
      status: newStatus,
      statusMessage: body.message || `Payment ${newStatus}`,
      azamTransactionId: transactionId || undefined,
      azamReference: azamReference || undefined,
      mnoReference: mnoReference || undefined,
      changedBy: 'azam_callback',
      sourceIp,
    })
    
    let updateResult
    try {
      updateResult = await updateTransactionStatus({
      transactionId: transaction.id,
      status: newStatus,
      statusMessage: body.message || `Payment ${newStatus}`,
      azamTransactionId: transactionId || undefined,
      azamReference: azamReference || undefined,
      mnoReference: mnoReference || undefined,
      callbackPayload: body,
      changedBy: 'azam_callback',
      sourceIp,
      failureReason: newStatus === 'failed' ? (body.message || 'Payment failed') : undefined,
    })

      console.log(`[${requestId}] ✅ updateTransactionStatus completed:`, {
        previousStatus: updateResult.previousStatus,
        newStatus: updateResult.newStatus,
        success: updateResult.success,
      })
    } catch (updateError: any) {
      console.error(`[${requestId}] ❌❌❌ ERROR in updateTransactionStatus ❌❌❌`)
      console.error(`[${requestId}] Error message:`, updateError.message)
      console.error(`[${requestId}] Error stack:`, updateError.stack)
      console.error(`[${requestId}] Transaction ID:`, transaction.id)
      throw updateError // Re-throw to be caught by outer try-catch
    }
    console.log(`[${requestId}] ==================================================`)

    // Also directly update service access payment status as a safety measure
    // (handlePaymentCompleted should handle this, but this ensures it's updated)
    // IMPORTANT: serviceAccessPayments.transactionId can be either:
    // 1. transaction.externalId (our PAY-xxx ID) - set initially
    // 2. checkoutResponse.transactionId (Azam transaction ID) - updated after payment initiation
    // So we need to search by both!
    if (newStatus === 'completed') {
      console.log(`[${requestId}] ========== UPDATING SERVICE ACCESS PAYMENT ==========`)
      // Build conditions array (filter out undefined)
      const conditions = [eq(serviceAccessPayments.transactionId, transaction.externalId)]
      console.log(`[${requestId}] Condition 1: serviceAccessPayments.transactionId = "${transaction.externalId}"`)
      
      if (transaction.azamTransactionId) {
        conditions.push(eq(serviceAccessPayments.transactionId, transaction.azamTransactionId))
        console.log(`[${requestId}] Condition 2: serviceAccessPayments.transactionId = "${transaction.azamTransactionId}"`)
      }
      if (transactionId && transactionId !== transaction.azamTransactionId) {
        conditions.push(eq(serviceAccessPayments.transactionId, transactionId))
        console.log(`[${requestId}] Condition 3: serviceAccessPayments.transactionId = "${transactionId}"`)
      }
      if (azamReference) {
        conditions.push(eq(serviceAccessPayments.transactionId, azamReference))
        console.log(`[${requestId}] Condition 4: serviceAccessPayments.transactionId = "${azamReference}"`)
      }
      
      console.log(`[${requestId}] Total search conditions:`, conditions.length)
      console.log(`[${requestId}] Executing UPDATE query...`)
      
      try {
        const updateResult = await db
          .update(serviceAccessPayments)
          .set({
            status: 'completed',
            paidAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(or(...conditions))
        
        console.log(`[${requestId}] UPDATE query executed`)
        
        // Verify the update by checking if record exists
        console.log(`[${requestId}] Verifying update by querying serviceAccessPayments...`)
        const [updatedAccessPayment] = await db
          .select()
          .from(serviceAccessPayments)
          .where(or(...conditions))
          .limit(1)
        
        if (updatedAccessPayment) {
          console.log(`[${requestId}] ✅ ServiceAccessPayment record found after update:`, {
            id: updatedAccessPayment.id,
            transactionId: updatedAccessPayment.transactionId,
            status: updatedAccessPayment.status,
            facilityId: updatedAccessPayment.facilityId,
            serviceName: updatedAccessPayment.serviceName,
            paidAt: updatedAccessPayment.paidAt,
          })
          
          if (updatedAccessPayment.status === 'completed') {
            console.log(`[${requestId}] ✅✅✅ Service access payment successfully updated to completed ✅✅✅`)
          } else {
            console.warn(`[${requestId}] ⚠️ ServiceAccessPayment found but status is "${updatedAccessPayment.status}" (expected "completed")`)
          }
        } else {
          console.warn(`[${requestId}] ⚠️⚠️⚠️ ServiceAccessPayment NOT FOUND after update ⚠️⚠️⚠️`)
          console.warn(`[${requestId}] This means the UPDATE query did not match any records`)
          console.warn(`[${requestId}] Search conditions used:`, {
            condition1: transaction.externalId,
            condition2: transaction.azamTransactionId,
            condition3: transactionId,
            condition4: azamReference,
          })
        }
      } catch (updateError: any) {
        console.error(`[${requestId}] ❌❌❌ ERROR updating service access payment ❌❌❌`)
        console.error(`[${requestId}] Error message:`, updateError.message)
        console.error(`[${requestId}] Error stack:`, updateError.stack)
        console.error(`[${requestId}] Transaction details:`, {
          externalId: transaction.externalId,
          azamTransactionId: transaction.azamTransactionId || transactionId,
          azamReference,
        })
        // Don't fail the entire callback if this update fails
      }
      console.log(`[${requestId}] =====================================================`)
    } else if (newStatus === 'failed') {
      // Build conditions array (filter out undefined)
      const conditions = [eq(serviceAccessPayments.transactionId, transaction.externalId)]
      
      if (transaction.azamTransactionId) {
        conditions.push(eq(serviceAccessPayments.transactionId, transaction.azamTransactionId))
      }
      if (transactionId && transactionId !== transaction.azamTransactionId) {
        conditions.push(eq(serviceAccessPayments.transactionId, transactionId))
      }
      if (azamReference) {
        conditions.push(eq(serviceAccessPayments.transactionId, azamReference))
      }
      
      await db
        .update(serviceAccessPayments)
        .set({
          status: 'failed',
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(or(...conditions))
      
      console.log('❌ Service access payment updated to failed', {
        externalId: transaction.externalId,
        azamTransactionId: transaction.azamTransactionId || transactionId,
        searchConditions: conditions.length,
      })

      // Send SMS notification for failed payment
      try {
        const { sendPaymentFailedSMS } = await import('@/lib/sms')
        
        // Get user phone from transaction or subscription
        let userPhone = null
        if (transaction.mobileNumber) {
          userPhone = transaction.mobileNumber
        }

        if (userPhone) {
          await sendPaymentFailedSMS(userPhone, {
            amount: String(transaction.amount),
            transactionId: transaction.externalId,
            serviceName: transaction.serviceName || 'Service Access'
          })
          console.log(`[${requestId}] Payment failed SMS sent to: ${userPhone}`)
        }
      } catch (smsError) {
        console.error(`[${requestId}] Failed to send payment failed SMS:`, smsError)
        // Don't fail the entire callback if SMS fails
      }
    }

    // Handle maintenance payments (removed)
    if (newStatus === 'completed' && transaction.serviceName === '__removed__' && transaction.requestPayload) {
      console.log(`[${requestId}] ========== HANDLING MAINTENANCE PAYMENT ==========`)
      try {
        const requestPayload = typeof transaction.requestPayload === 'string' 
          ? JSON.parse(transaction.requestPayload) 
          : transaction.requestPayload
        
        const maintenancePaymentType = requestPayload?.maintenancePaymentType
        const maintenanceRequestId = requestPayload?.requestId
        const maintenanceProposalId = requestPayload?.proposalId

        if (maintenancePaymentType === 'advance' && maintenanceRequestId) {
          console.log(`[${requestId}] Processing advance payment for request: ${maintenanceRequestId}`)
          const [request] = await db
            .select()
            .from(maintenanceRequests)
            .where(eq(maintenanceRequests.id, maintenanceRequestId))
            .limit(1)

          if (request && request.facilityId === transaction.facilityId && request.advancePaymentStatus !== 'paid') {
            await db
              .update(maintenanceRequests)
              .set({
                advancePaymentStatus: 'paid',
                advancePaidAt: sql`CURRENT_TIMESTAMP`,
                status: 'advance_paid',
              })
              .where(eq(maintenanceRequests.id, maintenanceRequestId))
            console.log(`[${requestId}] ✅ Advance payment recorded for request: ${maintenanceRequestId}`)
          }
        } else if (maintenancePaymentType === 'final' && maintenanceRequestId) {
          console.log(`[${requestId}] Processing final payment for request: ${maintenanceRequestId}`)
          const [request] = await db
            .select()
            .from(maintenanceRequests)
            .where(eq(maintenanceRequests.id, maintenanceRequestId))
            .limit(1)

          if (request && request.facilityId === transaction.facilityId && request.finalPaymentStatus !== 'paid') {
            await db
              .update(maintenanceRequests)
              .set({
                status: 'completed',
                finalPaymentStatus: 'paid',
                finalPaidAt: sql`CURRENT_TIMESTAMP`,
                paymentCompletedAt: sql`CURRENT_TIMESTAMP`,
              })
              .where(eq(maintenanceRequests.id, maintenanceRequestId))
            console.log(`[${requestId}] ✅ Final payment recorded for request: ${maintenanceRequestId}`)
          }
        } else if (maintenancePaymentType === 'maintenance_plan' && maintenanceProposalId) {
          console.log(`[${requestId}] Processing maintenance plan payment for proposal: ${maintenanceProposalId}`)
          const [proposal] = await db
            .select()
            .from(maintenancePlanProposals)
            .where(eq(maintenancePlanProposals.id, maintenanceProposalId))
            .limit(1)

          if (proposal) {
            const [planRequest] = await db
              .select()
              .from(maintenancePlanRequests)
              .where(eq(maintenancePlanRequests.id, proposal.requestId))
              .limit(1)

            if (planRequest && planRequest.facilityId === transaction.facilityId) {
              // Calculate payment amount based on payment type (half/full)
              const totalAmount = Number(proposal.totalCost)
              const paymentAmount = transaction.amount ? Number(transaction.amount) : totalAmount
              const paymentType = paymentAmount < totalAmount ? 'half' : 'full'

              // Check if payment already exists
              const [existingPayment] = await db
                .select()
                .from(maintenancePlanPayments)
                .where(
                  and(
                    eq(maintenancePlanPayments.proposalId, maintenanceProposalId),
                    eq(maintenancePlanPayments.transactionId, transaction.externalId)
                  )
                )
                .limit(1)

              if (!existingPayment) {
                const paymentId = crypto.randomUUID()
                await db.insert(maintenancePlanPayments).values({
                  id: paymentId,
                  proposalId: maintenanceProposalId,
                  requestId: proposal.requestId,
                  facilityId: transaction.facilityId,
                  paymentType,
                  amount: String(paymentAmount),
                  totalAmount: String(totalAmount),
                  currency: 'TZS',
                  paymentMethod: transaction.paymentMethod || null,
                  transactionId: transaction.externalId,
                  paymentStatus: 'paid',
                  paidAt: sql`CURRENT_TIMESTAMP`,
                })

                // Update request status if not already payment_pending
                if (planRequest.status !== 'payment_pending') {
                  await db
                    .update(maintenancePlanRequests)
                    .set({
                      status: 'payment_pending',
                      updatedAt: sql`CURRENT_TIMESTAMP`,
                    })
                    .where(eq(maintenancePlanRequests.id, proposal.requestId))
                }

                console.log(`[${requestId}] ✅ Maintenance plan payment recorded: ${paymentId}`)
              } else {
                console.log(`[${requestId}] ⚠️ Maintenance plan payment already exists for this transaction`)
              }
            }
          }
        }
      } catch (maintenanceError: any) {
        console.error(`[${requestId}] ❌ Error handling maintenance payment:`, maintenanceError.message)
        console.error(`[${requestId}] Error stack:`, maintenanceError.stack)
        // Don't fail the callback if maintenance payment update fails
      }
      console.log(`[${requestId}] =====================================================`)
    }

    // =====================================================
    // Handle PAYG & Financing repayment completion
    // =====================================================
    if (
      newStatus === 'completed' &&
      transaction.serviceName === 'payg-financing' &&
      updateResult.previousStatus !== 'completed'
    ) {
      console.log(`[${requestId}] ========== HANDLING PAYG FINANCING REPAYMENT ==========`)
      try {
        let metaContractId: string | undefined
        let metaMode: 'installment' | 'full' | undefined
        let metaTargetEntryId: string | null | undefined

        // Prefer requestPayload (set at initiate time, authoritative).
        if (transaction.requestPayload) {
          try {
            const reqPayload = typeof transaction.requestPayload === 'string'
              ? JSON.parse(transaction.requestPayload)
              : transaction.requestPayload
            metaContractId = reqPayload?.paygContractId
            metaMode = reqPayload?.paygRepaymentMode
            metaTargetEntryId = reqPayload?.paygTargetEntryId ?? null
          } catch (e: any) {
            console.warn(`[${requestId}] Could not parse requestPayload for payg metadata:`, e.message)
          }
        }

        // Fallback to service_access_payments.metadata if not present on transaction.
        if (!metaContractId) {
          const [accessPayment] = await db
            .select()
            .from(serviceAccessPayments)
            .where(
              or(
                eq(serviceAccessPayments.transactionId, transaction.externalId),
                transaction.azamTransactionId
                  ? eq(serviceAccessPayments.transactionId, transaction.azamTransactionId)
                  : undefined,
              ),
            )
            .limit(1)
          if (accessPayment?.metadata) {
            try {
              const md = JSON.parse(accessPayment.metadata)
              metaContractId = md.paygContractId
              metaMode = md.paygRepaymentMode
              metaTargetEntryId = md.paygTargetEntryId ?? null
            } catch (e: any) {
              console.warn(`[${requestId}] Could not parse access payment metadata for payg:`, e.message)
            }
          }
        }

        if (!metaContractId || !metaMode) {
          console.error(`[${requestId}] ❌ Missing PAYG metadata on transaction; cannot apply payment`, {
            externalId: transaction.externalId,
            metaContractId,
            metaMode,
          })
        } else {
          const amount = Number(transaction.amount) || 0
          const result = await applyPaygPayment({
            contractId: metaContractId,
            amount,
            mode: metaMode,
            targetEntryId: metaTargetEntryId ?? null,
          })
          console.log(`[${requestId}] ✅ PAYG repayment applied:`, result)
        }
      } catch (paygError: any) {
        console.error(`[${requestId}] ❌ Error applying PAYG repayment:`, paygError.message)
        console.error(`[${requestId}] Error stack:`, paygError.stack)
        // Don't fail the callback if PAYG apply fails; the transaction remains completed
        // and a retry / admin tool can reconcile.
      }
      console.log(`[${requestId}] =====================================================`)
    }

    // Handle equipment resale purchase completion (removed)
    if (newStatus === 'completed' && transaction.serviceName === '__removed__') {
      console.log(`[${requestId}] ========== HANDLING EQUIPMENT RESALE PURCHASE ==========`)
      try {
        // Find the service access payment to get metadata with resaleItemId
        const [accessPayment] = await db
          .select()
          .from(serviceAccessPayments)
          .where(
            or(
              eq(serviceAccessPayments.transactionId, transaction.externalId),
              transaction.azamTransactionId ? eq(serviceAccessPayments.transactionId, transaction.azamTransactionId) : undefined
            )
          )
          .limit(1)

        if (accessPayment && accessPayment.metadata) {
          try {
            const metadata = JSON.parse(accessPayment.metadata)
            const resaleItemId = metadata.resaleItemId

            if (resaleItemId) {
              console.log(`[${requestId}] Processing equipment resale purchase for item: ${resaleItemId}`)
              
              // Check if item is still available
              const [item] = await db
                .select()
                .from(resaleInventory)
                .where(eq(resaleInventory.id, resaleItemId))
                .limit(1)

              if (item && item.status === 'listed') {
                // Complete the purchase
                await db
                  .update(resaleInventory)
                  .set({
                    status: 'sold',
                    reservedByFacilityId: transaction.facilityId,
                    soldAt: sql`CURRENT_TIMESTAMP`,
                    salePrice: item.listPrice,
                  })
                  .where(eq(resaleInventory.id, resaleItemId))

                console.log(`[${requestId}] ✅ Equipment resale purchase completed for item: ${resaleItemId}`)
              } else {
                console.warn(`[${requestId}] ⚠️ Equipment resale item ${resaleItemId} is no longer available (status: ${item?.status || 'not found'})`)
              }
            } else {
              console.warn(`[${requestId}] ⚠️ No resaleItemId found in payment metadata`)
            }
          } catch (parseError: any) {
            console.error(`[${requestId}] ❌ Error parsing payment metadata:`, parseError.message)
          }
        } else {
          console.warn(`[${requestId}] ⚠️ Service access payment not found or missing metadata`)
        }
      } catch (resaleError: any) {
        console.error(`[${requestId}] ❌ Error handling equipment resale purchase:`, resaleError.message)
        console.error(`[${requestId}] Error stack:`, resaleError.stack)
        // Don't fail the callback if resale purchase update fails
      }
      console.log(`[${requestId}] =====================================================`)
    }

    console.log(`[${requestId}] ========== FINAL SUMMARY ==========`)
    console.log(`[${requestId}] ✅✅✅ PAYMENT STATUS UPDATED SUCCESSFULLY ✅✅✅`)
    console.log(`[${requestId}] Transaction Details:`, {
      transactionId: transaction.id,
      externalId: transaction.externalId,
      azamTransactionId: transaction.azamTransactionId,
      azamReference: transaction.azamReference,
      facilityId: transaction.facilityId,
      serviceName: transaction.serviceName,
      previousStatus: updateResult.previousStatus,
      newStatus: updateResult.newStatus,
      amount: body.amount,
      currency: transaction.currency,
      operator: body.operator,
      msisdn: body.msisdn,
      message: body.message,
    })
    console.log(`[${requestId}] ====================================`)

    // Send SMS notification if payment is completed
    if (newStatus === 'completed' || updateResult?.newStatus === 'completed') {
      console.log(`[${requestId}] ========== SMS NOTIFICATION ==========`)
      // Note: handlePaymentCompleted is automatically called by updateTransactionStatus
      // Wait a moment for subscription to be created (with retry logic)
      let subscription = null
      const maxRetries = 3
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[${requestId}] Attempt ${attempt}/${maxRetries}: Waiting for subscription creation...`)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)) // Exponential backoff
        
        try {
          const [foundSubscription] = await db
            .select()
            .from(serviceSubscriptions)
            .where(
              and(
                eq(serviceSubscriptions.facilityId, transaction.facilityId),
                eq(serviceSubscriptions.serviceName, transaction.serviceName)
              )
            )
            .limit(1)
          
          if (foundSubscription && foundSubscription.expiryDate) {
            subscription = foundSubscription
            console.log(`[${requestId}] ✅ Subscription found on attempt ${attempt}:`, {
              id: subscription.id,
              status: subscription.status,
              expiryDate: subscription.expiryDate,
              startDate: subscription.startDate,
            })
            break
          } else if (foundSubscription) {
            console.warn(`[${requestId}] ⚠️ Subscription found but expiryDate is missing on attempt ${attempt}`)
          } else {
            console.warn(`[${requestId}] ⚠️ Subscription not found on attempt ${attempt}`)
          }
        } catch (subError: any) {
          console.error(`[${requestId}] ❌ Error querying subscription on attempt ${attempt}:`, subError.message)
        }
      }
      
      try {
        // Get phone number from callback or transaction
        const phoneNumber = body.msisdn || transaction.mobileNumber || transaction.bankMobileNumber
        console.log(`[${requestId}] Phone number sources:`, {
          'body.msisdn': body.msisdn,
          'transaction.mobileNumber': transaction.mobileNumber,
          'transaction.bankMobileNumber': transaction.bankMobileNumber,
          selected: phoneNumber,
        })
        
        if (!phoneNumber) {
          console.warn(`[${requestId}] ⚠️ No phone number found in callback or transaction, cannot send SMS`)
        } else if (!subscription) {
          console.warn(`[${requestId}] ⚠️ Subscription not found after ${maxRetries} attempts, cannot send SMS`)
          console.warn(`[${requestId}] Searched for:`, {
            facilityId: transaction.facilityId,
            serviceName: transaction.serviceName,
          })
        } else if (!subscription.expiryDate) {
          console.warn(`[${requestId}] ⚠️ Subscription expiry date is missing, cannot send SMS`)
        } else {
          // Map service name to display name
        const serviceDisplayNames: Record<string, string> = {
          'afya-booking': 'Afya Booking',
          'afya-solar': 'Afya Solar',
        }
        
        const serviceDisplayName = serviceDisplayNames[transaction.serviceName] || transaction.serviceName
        
        // Normalize phone number (ensure it starts with country code)
        let normalizedPhone = phoneNumber.replace(/\s/g, '')
        if (!normalizedPhone.startsWith('255') && !normalizedPhone.startsWith('+255')) {
          if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '255' + normalizedPhone.substring(1)
          } else {
            normalizedPhone = '255' + normalizedPhone
          }
        }
        normalizedPhone = normalizedPhone.replace(/^\+/, '') // Remove + if present
        
        console.log(`[${requestId}] Normalized phone:`, normalizedPhone)
        console.log(`[${requestId}] Sending SMS to:`, normalizedPhone)
        
        const smsResult = await sendPaymentVerificationSMS(normalizedPhone, {
          transactionId: transaction.id,
          externalId: transaction.externalId,
          amount: String(transaction.amount),
          currency: transaction.currency || 'TZS',
          serviceName: transaction.serviceName,
          serviceDisplayName,
          billingCycle: transaction.billingCycle as 'monthly' | 'yearly' | null,
          subscriptionStartDate: subscription.startDate instanceof Date ? subscription.startDate : new Date(subscription.startDate),
          subscriptionEndDate: subscription.expiryDate instanceof Date ? subscription.expiryDate : new Date(subscription.expiryDate),
          paymentMethod: transaction.paymentMethod || undefined,
        })
        
          if (smsResult.success) {
            console.log(`[${requestId}] ✅✅✅ SMS sent successfully to: ${normalizedPhone} ✅✅✅`)
          } else {
            console.error(`[${requestId}] ❌ Failed to send SMS:`, smsResult.message)
          }
        }
      } catch (smsError: any) {
        console.error(`[${requestId}] ❌❌❌ Error sending SMS ❌❌❌`)
        console.error(`[${requestId}] Error message:`, smsError.message)
        console.error(`[${requestId}] Error stack:`, smsError.stack)
        // Don't fail the callback if SMS fails
      }
      console.log(`[${requestId}] ======================================`)
    }

    const response = {
      success: true,
      message: 'Payment status updated',
      requestId,
      data: {
        transactionId: transaction.id,
        externalId: transaction.externalId,
        previousStatus: updateResult.previousStatus,
        newStatus: updateResult.newStatus,
      }
    }
    
    const processingTime = Date.now() - callbackStartTime
    console.log(`[${requestId}] ========== SENDING SUCCESS RESPONSE ==========`)
    console.log(`[${requestId}] Response:`, JSON.stringify(response, null, 2))
    console.log(`[${requestId}] Total processing time: ${processingTime}ms`)
    console.log(`[${requestId}] ==============================================`)
    
    return NextResponse.json(response)
  } catch (error: any) {
    const processingTime = Date.now() - callbackStartTime
    console.error(`[${requestId}] ❌❌❌ ERROR PROCESSING CALLBACK ❌❌❌`)
    console.error(`[${requestId}] Error type:`, error?.constructor?.name || typeof error)
    console.error(`[${requestId}] Error message:`, error?.message || String(error))
    console.error(`[${requestId}] Error stack:`, error?.stack)
    console.error(`[${requestId}] Processing time before error: ${processingTime}ms`)
    console.error(`[${requestId}] Request ID:`, requestId)
    console.error(`[${requestId}] Source IP:`, sourceIp)
    
    // Try to log the request body if we got that far
    try {
      const bodyText = await request.clone().text().catch(() => null)
      if (bodyText) {
        console.error(`[${requestId}] Raw callback body:`, bodyText.substring(0, 1000))
        try {
          const body = JSON.parse(bodyText)
          console.error(`[${requestId}] Parsed callback body:`, JSON.stringify(body, null, 2))
        } catch (e) {
          console.error(`[${requestId}] Could not parse body as JSON`)
        }
      }
    } catch (e) {
      console.error(`[${requestId}] Could not read request body for error logging`)
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        requestId,
        message: error?.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payments/azam-pay/callback
 * For checking payment status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const transactionId = searchParams.get('transactionId')
  const externalId = searchParams.get('externalId')

  if (!transactionId && !externalId) {
    return NextResponse.json(
      { error: 'Transaction ID or External ID required' },
      { status: 400 }
    )
  }

  try {
    // Find transaction
    let transaction = await findTransactionByReference(transactionId || externalId || '')

    // Note: Azam Pay checkout API does not have a verify endpoint.
    // Status is only communicated via callbacks. If callbacks aren't received,
    // transactions can be manually updated using the admin endpoint:
    // POST /api/admin/transactions/update-by-reference

    if (!transaction) {
      // Try service access payments as fallback
      const [accessPayment] = await db
        .select()
        .from(serviceAccessPayments)
        .where(
          or(
            transactionId ? eq(serviceAccessPayments.transactionId, transactionId) : undefined,
            externalId ? eq(serviceAccessPayments.transactionId, externalId) : undefined
          )
        )
        .limit(1)

      if (accessPayment) {
        return NextResponse.json({
          payment: accessPayment,
          source: 'service_access_payments',
        })
      }

      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    // Also find the related service access payment
    const [accessPayment] = await db
      .select()
      .from(serviceAccessPayments)
      .where(eq(serviceAccessPayments.transactionId, transaction.externalId))
      .limit(1)

    // Return transaction with service access payment status
    // Frontend expects 'payment' object with status
    return NextResponse.json({
      payment: {
        id: accessPayment?.id || transaction.id,
        transactionId: transaction.externalId,
        externalId: transaction.externalId,
        facilityId: transaction.facilityId,
        serviceName: transaction.serviceName,
        amount: transaction.amount,
        currency: transaction.currency,
        // Use service access payment status if available, otherwise use transaction status
        status: accessPayment?.status || transaction.status,
        statusMessage: transaction.statusMessage,
        paymentType: transaction.paymentType,
        paymentMethod: transaction.paymentMethod,
        billingCycle: transaction.billingCycle,
        initiatedAt: transaction.initiatedAt,
        completedAt: transaction.completedAt,
        failedAt: transaction.failedAt,
        paidAt: accessPayment?.paidAt || null,
      },
      transaction: {
        id: transaction.id,
        externalId: transaction.externalId,
        facilityId: transaction.facilityId,
        serviceName: transaction.serviceName,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        statusMessage: transaction.statusMessage,
        paymentType: transaction.paymentType,
        paymentMethod: transaction.paymentMethod,
        billingCycle: transaction.billingCycle,
        initiatedAt: transaction.initiatedAt,
        completedAt: transaction.completedAt,
        failedAt: transaction.failedAt,
      },
      source: 'payment_transactions',
    })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
