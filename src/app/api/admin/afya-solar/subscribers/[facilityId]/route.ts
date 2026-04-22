import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  facilities,
  serviceSubscriptions,
  devices,
  energyData,
  subscriptionPayments,
  paymentTransactions,
} from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facilityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { facilityId } = await params

    // Get facility with Afya Solar subscription
    const subscriber = await db
      .select({
        // Facility info
        id: facilities.id,
        name: facilities.name,
        city: facilities.city,
        region: facilities.region,
        phone: facilities.phone,
        email: facilities.email,
        status: facilities.status,
        creditBalance: facilities.creditBalance,
        monthlyConsumption: facilities.monthlyConsumption,
        systemSize: facilities.systemSize,
        createdAt: facilities.createdAt,
        
        // Subscription info
        subscriptionId: serviceSubscriptions.id,
        subscriptionStatus: serviceSubscriptions.status,
        subscriptionStartDate: serviceSubscriptions.startDate,
        subscriptionExpiry: serviceSubscriptions.expiryDate,
        subscriptionAmount: serviceSubscriptions.amount,
        
        // Device info (smart meter)
        smartmeterSerial: devices.serialNumber,
      })
      .from(facilities)
      .leftJoin(
        serviceSubscriptions,
        and(
          eq(serviceSubscriptions.facilityId, facilities.id),
          eq(serviceSubscriptions.serviceName, 'afya-solar')
        )
      )
      .leftJoin(
        devices,
        and(
          eq(devices.facilityId, facilities.id),
          eq(devices.type, 'afyasolar')
        )
      )
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!subscriber[0]) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
    }

    const subId = subscriber[0].subscriptionId

    // Get additional metrics
    const lastPayment =
      subId != null
        ? await db
            .select({
              paymentDate: subscriptionPayments.createdAt,
              amount: subscriptionPayments.amount,
            })
            .from(subscriptionPayments)
            .where(eq(subscriptionPayments.subscriptionId, subId))
            .orderBy(desc(subscriptionPayments.createdAt))
            .limit(1)
        : []

    const subscriptionPaymentHistory =
      subId != null
        ? await db
            .select({
              id: subscriptionPayments.id,
              createdAt: subscriptionPayments.createdAt,
              amount: subscriptionPayments.amount,
              currency: subscriptionPayments.currency,
              status: subscriptionPayments.status,
              billingCycle: subscriptionPayments.billingCycle,
              periodStart: subscriptionPayments.periodStart,
              periodEnd: subscriptionPayments.periodEnd,
              isRenewal: subscriptionPayments.isRenewal,
              transactionStatus: paymentTransactions.status,
              transactionId: paymentTransactions.id,
            })
            .from(subscriptionPayments)
            .leftJoin(paymentTransactions, eq(paymentTransactions.id, subscriptionPayments.transactionId))
            .where(eq(subscriptionPayments.subscriptionId, subId))
            .orderBy(desc(subscriptionPayments.createdAt))
            .limit(50)
        : []

    const meterSerial = subscriber[0].smartmeterSerial
    const totalEnergyResult = meterSerial
      ? await db
          .select({
            totalConsumption: sql<number>`SUM(${energyData.energy})`,
          })
          .from(energyData)
          .where(eq(energyData.deviceId, meterSerial))
          .limit(1)
      : [{ totalConsumption: 0 as number | null }]

    const subscriberWithMetrics = {
      ...subscriber[0],
      lastPaymentDate: lastPayment[0]?.paymentDate?.toISOString(),
      monthlyRevenue: lastPayment[0]?.amount,
      totalEnergyConsumption: totalEnergyResult[0]?.totalConsumption || 0,
      subscriptionStatus: subscriber[0].subscriptionStatus || 'active',
      subscriptionPaymentHistory,
    }

    return NextResponse.json({
      success: true,
      data: subscriberWithMetrics,
    })

  } catch (error) {
    console.error('Error fetching subscriber details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscriber details' },
      { status: 500 }
    )
  }
}
