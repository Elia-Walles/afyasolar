import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { afyaSolarInvoiceRequests, serviceAccessPayments } from '@/lib/db/schema'
import { afyaSolarSubscribers } from '@/lib/db/afyasolar-subscribers-schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'approved', 'rejected']),
  adminNotes: z.string().optional(),
})

/**
 * PATCH /api/admin/solar/invoice-requests/[id]
 * Admin updates invoice request status. When status is 'paid', also creates serviceAccessPayment
 * so the facility gets full Afya Solar dashboard access.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = updateStatusSchema.parse(body)

    const [invoice] = await db
      .select()
      .from(afyaSolarInvoiceRequests)
      .where(eq(afyaSolarInvoiceRequests.id, id))
      .limit(1)

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice request not found' }, { status: 404 })
    }

    await db
      .update(afyaSolarInvoiceRequests)
      .set({
        status: parsed.status,
        ...(parsed.adminNotes !== undefined && { adminNotes: parsed.adminNotes }),
      })
      .where(eq(afyaSolarInvoiceRequests.id, id))

    if (parsed.status === 'paid') {
      // Create service access payment so facility gets full dashboard access (legacy ledger)
      const paymentId = randomUUID()
      const now = new Date()
      await db.insert(serviceAccessPayments).values({
        id: paymentId,
        facilityId: invoice.facilityId,
        serviceName: 'afya-solar',
        amount: invoice.amount,
        currency: invoice.currency ?? 'TZS',
        paymentMethod: 'invoice',
        status: 'completed',
        paidAt: now,
        packageId: invoice.packageId,
        packageName: invoice.packageName,
        paymentPlan: invoice.paymentPlan,
        metadata: invoice.packageMetadata,
      })

      // Update centralized Afya Solar subscriber record to mark payment as completed
      try {
        const [subscriber] = await db
          .select()
          .from(afyaSolarSubscribers)
          .where(eq(afyaSolarSubscribers.facilityId, invoice.facilityId))
          .limit(1)

        const paymentCompletedAt = now

        if (subscriber) {
          await db
            .update(afyaSolarSubscribers)
            .set({
              paymentStatus: 'completed',
              isPaymentCompleted: 1,
              paymentCompletedAt,
              paymentMethod: 'INVOICE',
              transactionId: paymentId,
              updatedAt: new Date(),
            })
            .where(eq(afyaSolarSubscribers.id, subscriber.id))
        } else {
          // Fallback: create a minimal subscriber record from invoice if none exists
          await db.insert(afyaSolarSubscribers).values({
            facilityId: invoice.facilityId,
            facilityName: invoice.facilityName,
            facilityEmail: invoice.facilityEmail,
            facilityPhone: invoice.facilityPhone,
            packageId: invoice.packageId,
            packageName: invoice.packageName,
            packageCode: invoice.packageId,
            packageRatedKw: 0,
            planType:
              invoice.paymentPlan === 'cash'
                ? 'CASH'
                : invoice.paymentPlan === 'installment'
                ? 'INSTALLMENT'
                : 'PAAS',
            totalPackagePrice: invoice.amount,
            paymentStatus: 'completed',
            isPaymentCompleted: 1,
            paymentCompletedAt,
            paymentMethod: 'INVOICE',
            transactionId: paymentId,
            remainingBalance: 0,
            subscriptionStatus: 'active',
            isActive: 1,
            subscriptionStartDate: paymentCompletedAt,
            nextBillingDate: new Date(paymentCompletedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
            billingCycle: 'monthly',
            gracePeriodDays: 7,
            contractStatus: 'active',
            contractDurationMonths: invoice.paymentPlan === 'paas' ? 60 : undefined,
            minimumTermMonths: invoice.paymentPlan === 'paas' ? 60 : 12,
            autoRenew: 1,
            installationStatus: 'pending',
            systemStatus: 'pending_install',
            systemHealth: 'optimal',
            paymentHistory: [],
            bills: [],
            metadata: {
              createdBy: session.user.email,
              source: 'invoice-paid',
              invoiceRequestId: invoice.id,
              paymentId,
              createdAt: paymentCompletedAt.toISOString(),
            },
            notes: 'Created from paid Afya Solar invoice request',
            adminNotes: 'Automatically created when marking invoice as paid',
          })
        }
      } catch (subscriberError) {
        console.error('Error updating Afya Solar subscriber on invoice paid:', subscriberError)
      }
    }

    return NextResponse.json({
      success: true,
      message: parsed.status === 'paid'
        ? 'Invoice marked as paid. Facility now has full Afya Solar dashboard access.'
        : 'Invoice request updated.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error updating invoice request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
