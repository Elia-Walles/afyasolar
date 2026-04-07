import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { energyData, facilities, clientServices } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const facilityId = searchParams.get('facility') || 'all'
    const status = searchParams.get('status') || 'all'

    // Calculate time range
    const now = new Date()
    let startTime: Date
    
    switch (timeRange) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default: // 24h
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Build query conditions
    const conditions = [
      gte(energyData.timestamp, startTime),
      lte(energyData.timestamp, now)
    ]

    if (facilityId !== 'all') {
      conditions.push(eq(energyData.facilityId, facilityId))
    }

    // Fetch energy data with facility information
    const energyQuery = db
      .select({
        id: energyData.id,
        facilityId: energyData.facilityId,
        facilityName: facilities.name,
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
      .leftJoin(facilities, eq(energyData.facilityId, facilities.id))
      .where(and(...conditions))
      .orderBy(desc(energyData.timestamp))
      .limit(1000)

    const data = await energyQuery

    // Apply status filter if needed
    const filteredData = status === 'all' 
      ? data 
      : data.filter(item => {
          if (status === 'online') return item.gridStatus === 'connected'
          if (status === 'offline') return item.gridStatus === 'disconnected'
          if (status === 'warning') return item.batteryLevel && Number(item.batteryLevel) < 20
          return true
        })

    return NextResponse.json({
      success: true,
      data: filteredData,
      meta: {
        timeRange,
        facilityId,
        status,
        count: filteredData.length,
        timeRangeStart: startTime.toISOString(),
        timeRangeEnd: now.toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching admin energy data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch energy data' },
      { status: 500 }
    )
  }
}
