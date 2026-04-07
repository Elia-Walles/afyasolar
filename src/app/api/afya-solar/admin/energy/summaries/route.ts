import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { energyData, facilities, serviceSubscriptions, devices } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, isNull } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get time range for last 24 hours
    const now = new Date()
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get all facilities with active solar services
    const facilitiesWithServices = await db
      .select({
        facilityId: facilities.id,
        facilityName: facilities.name,
        location: sql`${facilities.city || ''}, ${facilities.region || ''}`.as('location'),
        serviceStatus: serviceSubscriptions.status
      })
      .from(facilities)
      .leftJoin(serviceSubscriptions, and(
        eq(serviceSubscriptions.facilityId, facilities.id),
        eq(serviceSubscriptions.serviceName, 'afya-solar'),
        eq(serviceSubscriptions.status, 'ACTIVE')
      ))
      .where(isNull(serviceSubscriptions.cancelledAt))

    // Get energy summaries for each facility
    const summaries = await Promise.all(
      facilitiesWithServices.map(async (facility) => {
        // Get latest energy data for the facility
        const latestEnergyData = await db
          .select({
            id: energyData.id,
            timestamp: energyData.timestamp,
            power: energyData.power,
            energy: energyData.energy,
            voltage: energyData.voltage,
            current: energyData.current,
            solarGeneration: energyData.solarGeneration,
            batteryLevel: energyData.batteryLevel,
            gridStatus: energyData.gridStatus,
            creditBalance: energyData.creditBalance
          })
          .from(energyData)
          .innerJoin(devices, eq(energyData.deviceId, devices.id))
          .where(and(
            eq(devices.facilityId, facility.facilityId),
            gte(energyData.timestamp, startTime)
          ))
          .orderBy(desc(energyData.timestamp))
          .limit(1)

        // Get aggregated energy data for the time period
        const aggregatedData = await db
          .select({
            totalConsumption: sql<number>`SUM(CAST(${energyData.energy} AS DECIMAL(10,2)))`.as('totalConsumption'),
            totalSolarGeneration: sql<number>`SUM(COALESCE(CAST(${energyData.solarGeneration} AS DECIMAL(10,2)), 0))`.as('totalSolarGeneration'),
            avgBatteryLevel: sql<number>`AVG(COALESCE(CAST(${energyData.batteryLevel} AS DECIMAL(5,2)), 0))`.as('avgBatteryLevel'),
            avgPower: sql<number>`AVG(COALESCE(CAST(${energyData.power} AS DECIMAL(10,2)), 0))`.as('avgPower'),
            maxPower: sql<number>`MAX(COALESCE(CAST(${energyData.power} AS DECIMAL(10,2)), 0))`.as('maxPower'),
            readingCount: sql<number>`COUNT(*)`.as('readingCount')
          })
          .from(energyData)
          .innerJoin(devices, eq(energyData.deviceId, devices.id))
          .where(and(
            eq(devices.facilityId, facility.facilityId),
            gte(energyData.timestamp, startTime)
          ))

        const latest = latestEnergyData[0]
        const aggregated = aggregatedData[0]

        const totalConsumption = Number(aggregated?.totalConsumption || 0)
        const totalSolarGeneration = Number(aggregated?.totalSolarGeneration || 0)
        const gridConsumption = totalConsumption - totalSolarGeneration
        const efficiency = totalConsumption > 0 ? (totalSolarGeneration / totalConsumption) * 100 : 0

        // Determine facility status
        let status: 'online' | 'offline' | 'warning' = 'offline'
        if (latest) {
          const lastUpdate = new Date(latest.timestamp)
          const timeDiff = now.getTime() - lastUpdate.getTime()
          
          if (timeDiff < 60 * 60 * 1000) { // Less than 1 hour
            if (latest.batteryLevel && Number(latest.batteryLevel) < 20) {
              status = 'warning'
            } else {
              status = 'online'
            }
          } else {
            status = 'offline'
          }
        }

        return {
          facilityId: facility.facilityId,
          facilityName: facility.facilityName,
          location: facility.location,
          totalConsumption,
          solarGeneration: totalSolarGeneration,
          gridConsumption,
          avgBatteryLevel: Number(aggregated?.avgBatteryLevel || 0),
          avgPower: Number(aggregated?.avgPower || 0),
          maxPower: Number(aggregated?.maxPower || 0),
          efficiency,
          lastUpdate: latest?.timestamp || now.toISOString(),
          status,
          serviceStatus: facility.serviceStatus,
          readingCount: Number(aggregated?.readingCount || 0)
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: summaries,
      meta: {
        count: summaries.length,
        timeRangeStart: startTime.toISOString(),
        timeRangeEnd: now.toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching energy summaries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch energy summaries' },
      { status: 500 }
    )
  }
}
