import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

export async function GET(request: NextRequest) {
  let connection: mysql.Connection | null = null

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'afya_link',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    })

    // Fetch all simulated facilities
    const [facilities] = await connection.execute(`
      SELECT 
        id,
        name,
        location,
        region,
        status,
        solar_status,
        payg_status,
        installation_date,
        payg_operational_date,
        energy_consumption_before,
        energy_consumption_after,
        monthly_energy_savings,
        electricity_cost_before,
        electricity_cost_after,
        monthly_cost_savings,
        carbon_emission_reduction,
        solar_capacity,
        battery_capacity,
        smart_meter_serial,
        facility_type,
        notes,
        created_at,
        updated_at
      FROM simulated_facilities 
      ORDER BY installation_date DESC
    `)

    // Calculate overall statistics
    const [statsResult] = await connection.execute(`
      SELECT 
        COUNT(*) as total_facilities,
        SUM(monthly_energy_savings) as total_energy_savings,
        SUM(monthly_cost_savings) as total_cost_savings,
        SUM(carbon_emission_reduction) as total_carbon_reduction,
        SUM(solar_capacity) as total_solar_capacity,
        AVG(CASE WHEN energy_consumption_before > 0 
            THEN (monthly_energy_savings * 100.0 / energy_consumption_before) 
            ELSE 0 END) as average_energy_reduction,
        AVG(CASE WHEN electricity_cost_before > 0 
            THEN (monthly_cost_savings * 100.0 / electricity_cost_before) 
            ELSE 0 END) as average_cost_reduction
      FROM simulated_facilities
    `)

    const stats = statsResult[0]

    // Format the response
    const response = {
      success: true,
      data: {
        facilities: facilities.map((facility: any) => ({
          ...facility,
          electricityCostBefore: facility.electricity_cost_before,
          electricityCostAfter: facility.electricity_cost_after,
          monthlyCostSavings: facility.monthly_cost_savings,
          carbonEmissionReduction: facility.carbon_emission_reduction,
          solarCapacity: facility.solar_capacity,
          batteryCapacity: facility.battery_capacity,
          smartMeterSerial: facility.smart_meter_serial,
          facilityType: facility.facility_type,
          installationDate: facility.installation_date,
          paygOperationalDate: facility.payg_operational_date,
          solarStatus: facility.solar_status,
          paygStatus: facility.payg_status
        })),
        stats: {
          totalFacilities: Number(stats.total_facilities),
          totalEnergySavings: Number(stats.total_energy_savings),
          totalCostSavings: Number(stats.total_cost_savings),
          totalCarbonReduction: Number(stats.total_carbon_reduction),
          totalSolarCapacity: Number(stats.total_solar_capacity),
          averageEnergyReduction: Math.round(Number(stats.average_energy_reduction)),
          averageCostReduction: Math.round(Number(stats.average_cost_reduction))
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching simulated facilities:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch simulated facilities data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
