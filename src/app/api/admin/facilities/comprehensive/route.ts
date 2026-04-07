import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db, getRawConnection } from '@/lib/db'
import { facilities, devices, users, departments, doctors, appointments } from '@/lib/db/schema'
import { eq, desc, sql, and, or, like } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/facilities/comprehensive
 * Get all facilities with comprehensive information including:
 * - Device counts
 * - User counts
 * - Department counts (for booking)
 * - Doctor counts (for booking)
 * - Appointment statistics
 * - Last login information
 * - Referral information
 * - Booking system status
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const statusFilter = searchParams.get('status') || 'all'

    const connection = getRawConnection()

    // Build base query with all facility fields and aggregated counts
    let query = `
      SELECT 
        f.id,
        f.name,
        f.address,
        f.city,
        f.region,
        f.phone,
        f.email,
        f.status,
        f.payment_model as paymentModel,
        f.credit_balance as creditBalance,
        f.monthly_consumption as monthlyConsumption,
        f.system_size as systemSize,
        f.is_booking_enabled as isBookingEnabled,
        f.booking_slug as bookingSlug,
        f.booking_timezone as bookingTimezone,
        f.booking_whatsapp_number as bookingWhatsappNumber,
        f.logo_url as logoUrl,
        f.category,
        f.latitude,
        f.longitude,
        f.referral_code as referralCode,
        f.referred_by as referredBy,
        f.referral_benefit_applied as referralBenefitApplied,
        f.last_login_at as lastLoginAt,
        f.created_at as createdAt,
        f.updated_at as updatedAt,
        f.accept_terms as acceptTerms,
        f.email_verified as emailVerified,
        -- Device counts
        COALESCE(device_stats.device_count, 0) as deviceCount,
        COALESCE(device_stats.active_devices, 0) as activeDevices,
        COALESCE(device_stats.inactive_devices, 0) as inactiveDevices,
        -- User counts
        COALESCE(user_stats.user_count, 0) as userCount,
        -- Department counts (for booking)
        COALESCE(dept_stats.department_count, 0) as departmentCount,
        -- Doctor counts (for booking)
        COALESCE(doctor_stats.doctor_count, 0) as doctorCount,
        -- Appointment statistics
        COALESCE(appt_stats.total_appointments, 0) as totalAppointments,
        COALESCE(appt_stats.pending_appointments, 0) as pendingAppointments,
        COALESCE(appt_stats.confirmed_appointments, 0) as confirmedAppointments,
        COALESCE(appt_stats.completed_appointments, 0) as completedAppointments,
        -- Payment statistics
        COALESCE(payment_stats.total_payments, 0) as totalPayments,
        COALESCE(payment_stats.completed_payments, 0) as completedPayments,
        COALESCE(payment_stats.pending_payments, 0) as pendingPayments,
        COALESCE(payment_stats.failed_payments, 0) as failedPayments,
        COALESCE(payment_stats.total_paid_amount, 0) as totalPaidAmount
      FROM facilities f
      -- Device statistics
      LEFT JOIN (
        SELECT 
          facility_id,
          COUNT(*) as device_count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_devices,
          SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) as inactive_devices
        FROM devices
        GROUP BY facility_id
      ) device_stats ON device_stats.facility_id = f.id
      -- User statistics
      LEFT JOIN (
        SELECT 
          facility_id,
          COUNT(*) as user_count
        FROM users
        WHERE role = 'facility'
        GROUP BY facility_id
      ) user_stats ON user_stats.facility_id = f.id
      -- Department statistics (for booking)
      LEFT JOIN (
        SELECT 
          facility_id,
          COUNT(*) as department_count
        FROM departments
        GROUP BY facility_id
      ) dept_stats ON dept_stats.facility_id = f.id
      -- Doctor statistics (for booking)
      LEFT JOIN (
        SELECT 
          facility_id,
          COUNT(*) as doctor_count
        FROM doctors
        GROUP BY facility_id
      ) doctor_stats ON doctor_stats.facility_id = f.id
      -- Appointment statistics
      LEFT JOIN (
        SELECT 
          facility_id,
          COUNT(*) as total_appointments,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_appointments,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_appointments,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments
        FROM appointments
        GROUP BY facility_id
      ) appt_stats ON appt_stats.facility_id = f.id
      -- Payment statistics
      LEFT JOIN (
        SELECT 
          facility_id,
          COUNT(*) as total_payments,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
          SUM(CASE WHEN status = 'pending' OR status = 'processing' OR status = 'awaiting_confirmation' THEN 1 ELSE 0 END) as pending_payments,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
          SUM(CASE WHEN status = 'completed' THEN CAST(amount AS DECIMAL(12,2)) ELSE 0 END) as total_paid_amount
        FROM payment_transactions
        GROUP BY facility_id
      ) payment_stats ON payment_stats.facility_id = f.id
      WHERE 1=1
    `

    const params: any[] = []

    // Apply search filter
    if (search) {
      query += ` AND (
        f.name LIKE ? OR 
        f.city LIKE ? OR 
        f.region LIKE ? OR 
        f.phone LIKE ? OR
        f.email LIKE ? OR
        f.booking_slug LIKE ?
      )`
      const wildcard = `%${search}%`
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      query += ` AND f.status = ?`
      params.push(statusFilter)
    }

    query += ` ORDER BY f.updated_at DESC`

    const [results] = await connection.query(query, params) as any[]

    // Transform results to match expected format
    const facilitiesData = (results || []).map((row: any) => {
      // Debug: Log coordinate values for troubleshooting
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Facility ${row.id} - ${row.name}] Raw coordinates from DB:`, {
          latitude: row.latitude,
          longitude: row.longitude,
          latitudeType: typeof row.latitude,
          longitudeType: typeof row.longitude,
          latitudeValue: String(row.latitude),
          longitudeValue: String(row.longitude),
          isLatitudeNull: row.latitude === null,
          isLongitudeNull: row.longitude === null
        })
      }
      
      // Convert coordinates - handle decimal strings from MySQL
      let latitude: number | null = null
      let longitude: number | null = null
      
      // MySQL DECIMAL columns return as strings, need to parse them
      if (row.latitude !== null && row.latitude !== undefined && row.latitude !== '') {
        const latNum = typeof row.latitude === 'string' ? parseFloat(row.latitude) : Number(row.latitude)
        if (!isNaN(latNum) && latNum >= -90 && latNum <= 90) {
          latitude = latNum
        }
      }
      
      if (row.longitude !== null && row.longitude !== undefined && row.longitude !== '') {
        const lngNum = typeof row.longitude === 'string' ? parseFloat(row.longitude) : Number(row.longitude)
        if (!isNaN(lngNum) && lngNum >= -180 && lngNum <= 180) {
          longitude = lngNum
        }
      }
      
      return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      region: row.region,
      phone: row.phone,
      email: row.email,
      status: row.status,
      paymentModel: row.paymentModel,
      creditBalance: Number(row.creditBalance || 0),
      monthlyConsumption: Number(row.monthlyConsumption || 0),
      systemSize: row.systemSize,
      isBookingEnabled: Boolean(row.isBookingEnabled),
      bookingSlug: row.bookingSlug,
      bookingTimezone: row.bookingTimezone,
      bookingWhatsappNumber: row.bookingWhatsappNumber,
      logoUrl: row.logoUrl,
      category: row.category,
      // Use the pre-processed coordinates
      latitude: latitude,
      longitude: longitude,
      referralCode: row.referralCode,
      referredBy: row.referredBy,
      referralBenefitApplied: Boolean(row.referralBenefitApplied),
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      acceptTerms: Boolean(row.acceptTerms),
      emailVerified: Boolean(row.emailVerified),
      // Statistics
      deviceCount: Number(row.deviceCount || 0),
      activeDevices: Number(row.activeDevices || 0),
      inactiveDevices: Number(row.inactiveDevices || 0),
      userCount: Number(row.userCount || 0),
      departmentCount: Number(row.departmentCount || 0),
      doctorCount: Number(row.doctorCount || 0),
      totalAppointments: Number(row.totalAppointments || 0),
      pendingAppointments: Number(row.pendingAppointments || 0),
      confirmedAppointments: Number(row.confirmedAppointments || 0),
      completedAppointments: Number(row.completedAppointments || 0),
      // Payment statistics
      totalPayments: Number(row.totalPayments || 0),
      completedPayments: Number(row.completedPayments || 0),
      pendingPayments: Number(row.pendingPayments || 0),
      failedPayments: Number(row.failedPayments || 0),
      totalPaidAmount: Number(row.totalPaidAmount || 0),
    }
    })

    return NextResponse.json({
      success: true,
      data: facilitiesData,
    })
  } catch (error) {
    console.error('Error fetching comprehensive facilities data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

