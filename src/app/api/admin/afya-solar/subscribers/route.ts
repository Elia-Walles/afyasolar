import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities, serviceSubscriptions, devices, energyData, subscriptionPayments, paymentTransactions, serviceAccessPayments } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get facilities with Afya Solar access (active subscriptions OR completed payments)
    const subscribers = await db
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
        
        // Subscription info (may be null)
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
          eq(serviceSubscriptions.serviceName, 'afya-solar'),
          eq(serviceSubscriptions.facilityId, facilities.id)
        )
      )
      .leftJoin(
        devices,
        and(
          eq(devices.facilityId, facilities.id),
          eq(devices.type, 'afyasolar')
        )
      )
      .where(
        // Get facilities that either have active Afya Solar subscriptions OR have completed Afya Solar payments
        sql`(
          ${serviceSubscriptions.id} IS NOT NULL AND ${serviceSubscriptions.status} = 'active'
        ) OR (
          EXISTS (
            SELECT 1 FROM ${serviceAccessPayments} sp
            WHERE sp.facility_id = ${facilities.id} 
            AND sp.service_name = 'afya-solar' 
            AND sp.status = 'completed'
          )
        )`
      )
      .orderBy(desc(facilities.createdAt))

    // If no subscribers found, return empty array quickly
    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Get all facility IDs to batch fetch payment data
    const facilityIds = subscribers.map(s => s.id)
    const subscriptionIds = subscribers.filter(s => s.subscriptionId).map(s => s.subscriptionId!)

    // Batch fetch all payment data in single queries
    const smartMeterSerials = subscribers.filter(s => s.smartmeterSerial)
    const [facilityPayments, subscriptionPaymentsData, energyConsumptionData] = await Promise.all([
      // Get latest facility payments
      db
        .select({
          facilityId: serviceAccessPayments.facilityId,
          paymentDate: serviceAccessPayments.paidAt,
          amount: serviceAccessPayments.amount,
          packageId: serviceAccessPayments.packageId,
          packageName: serviceAccessPayments.packageName,
          paymentStatus: serviceAccessPayments.status,
        })
        .from(serviceAccessPayments)
        .where(and(
          eq(serviceAccessPayments.serviceName, 'afya-solar'),
          facilityIds.length > 0 ? sql`${serviceAccessPayments.facilityId} IN (${sql.raw(facilityIds.map(id => `'${id}'`).join(','))})` : sql`1=0`
        ))
        .orderBy(desc(serviceAccessPayments.paidAt)),

      // Get latest subscription payments
      db
        .select({
          subscriptionId: subscriptionPayments.subscriptionId,
          paymentDate: subscriptionPayments.createdAt,
          amount: subscriptionPayments.amount,
          paymentStatus: sql<string>`${paymentTransactions.status}`,
          packageId: sql<string>`${serviceAccessPayments.packageId}`,
          packageName: sql<string>`${serviceAccessPayments.packageName}`,
        })
        .from(subscriptionPayments)
        .leftJoin(
          paymentTransactions,
          eq(paymentTransactions.id, subscriptionPayments.transactionId)
        )
        .leftJoin(
          serviceAccessPayments,
          eq(serviceAccessPayments.transactionId, subscriptionPayments.transactionId)
        )
        .where(
          subscriptionIds.length > 0 ? sql`${subscriptionPayments.subscriptionId} IN (${sql.raw(subscriptionIds.map(id => `'${id}'`).join(','))})` : sql`1=0`
        )
        .orderBy(desc(subscriptionPayments.createdAt)),

      // Get energy consumption for all smart meters (only if smart meters exist)
      ...(smartMeterSerials.length > 0 ? [
        db
          .select({
            deviceId: energyData.deviceId,
            totalConsumption: sql<number>`SUM(${energyData.energy})`,
          })
          .from(energyData)
          .where(
            sql`${energyData.deviceId} IN (${sql.raw(smartMeterSerials.map(s => `'${s.smartmeterSerial}'`).join(','))})`
          )
          .groupBy(energyData.deviceId)
      ] : [Promise.resolve([])])
    ])

    // Create lookup maps for efficient data access
    const facilityPaymentMap = new Map()
    facilityPayments.forEach(payment => {
      if (!facilityPaymentMap.has(payment.facilityId)) {
        facilityPaymentMap.set(payment.facilityId, payment)
      }
    })

    const subscriptionPaymentMap = new Map()
    subscriptionPaymentsData.forEach(payment => {
      if (!subscriptionPaymentMap.has(payment.subscriptionId)) {
        subscriptionPaymentMap.set(payment.subscriptionId, payment)
      }
    })

    const energyConsumptionMap = new Map()
    if (energyConsumptionData && energyConsumptionData.length > 0) {
      energyConsumptionData.forEach(data => {
        energyConsumptionMap.set(data.deviceId, data.totalConsumption)
      })
    }

    // Process subscribers efficiently using the lookup maps
    const uniqueSubscribersMap = new Map()
    const duplicateIds = new Set()
    
    subscribers.forEach((subscriber) => {
      if (uniqueSubscribersMap.has(subscriber.id)) {
        duplicateIds.add(subscriber.id)
        console.warn(`Duplicate subscriber ID found: ${subscriber.id}`)
      } else {
        uniqueSubscribersMap.set(subscriber.id, subscriber)
      }
    })

    if (duplicateIds.size > 0) {
      console.log(`Found ${duplicateIds.size} duplicate subscriber IDs:`, Array.from(duplicateIds))
    }

    const subscribersWithMetrics = Array.from(uniqueSubscribersMap.values()).map((subscriber) => {
      try {
        let paymentData = null
        let totalEnergyConsumption = 0

        // Get payment data from subscription or facility payment
        if (subscriber.subscriptionId && subscriptionPaymentMap.has(subscriber.subscriptionId)) {
          paymentData = subscriptionPaymentMap.get(subscriber.subscriptionId)
        } else if (facilityPaymentMap.has(subscriber.id)) {
          paymentData = facilityPaymentMap.get(subscriber.id)
        }

        // Get energy consumption
        if (subscriber.smartmeterSerial && energyConsumptionMap.has(subscriber.smartmeterSerial)) {
          totalEnergyConsumption = energyConsumptionMap.get(subscriber.smartmeterSerial)
        }

        return {
          ...subscriber,
          registeredDate: subscriber.createdAt?.toISOString() || new Date().toISOString(),
          lastPaymentDate: paymentData?.paymentDate?.toISOString(),
          monthlyRevenue: paymentData?.amount,
          totalEnergyConsumption,
          subscriptionStatus: subscriber.subscriptionStatus || (paymentData ? 'active' : 'inactive'),
          paymentStatus: paymentData?.paymentStatus || 'pending',
          packageName: paymentData?.packageName,
          packageId: paymentData?.packageId,
          contactEmail: subscriber.email,
          contactPhone: subscriber.phone,
        }
      } catch (error) {
        console.error(`Error processing subscriber ${subscriber.id}:`, error)
        // Return subscriber with basic info even if processing fails
        return {
          ...subscriber,
          registeredDate: subscriber.createdAt?.toISOString() || new Date().toISOString(),
          lastPaymentDate: null,
          monthlyRevenue: null,
          totalEnergyConsumption: 0,
          subscriptionStatus: subscriber.subscriptionStatus || 'inactive',
          paymentStatus: 'error',
          packageName: null,
          packageId: null,
          contactEmail: subscriber.email,
          contactPhone: subscriber.phone,
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: subscribersWithMetrics,
    })

  } catch (error) {
    console.error('Error fetching Afya Solar subscribers:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch subscribers',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
