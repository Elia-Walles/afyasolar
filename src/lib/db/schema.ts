import { mysqlTable, mysqlEnum, varchar, int, bigint, decimal, datetime, date, boolean, text, index, timestamp, json } from 'drizzle-orm/mysql-core'
import { relations, sql } from 'drizzle-orm'

// Import telemetry schemas
export * from './schema-telemetry'

// Import simulated facilities schema
export * from './simulated-facilities-schema'

// Energy efficiency & climate resilience
export * from './schema-efficiency-climate'

/**
 * Users table
 */
/**
 * Verification codes for email verification
 */
export const verificationCodes = mysqlTable('verification_codes', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`(uuid())`),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  expiresAt: datetime('expires_at', { mode: 'date' }).notNull(),
  used: boolean('used').notNull().default(false),
  usedAt: datetime('used_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  emailIdx: index('verification_codes_email_idx').on(table.email),
  expiresAtIdx: index('verification_codes_expires_at_idx').on(table.expiresAt),
}))

/**
 * Users table
 */
export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'facility' | 'admin' | 'technician' | 'onboarding'
  facilityId: varchar('facility_id', { length: 36 }),
  phone: varchar('phone', { length: 20 }), // Optional phone field
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  emailVerificationExpires: datetime('email_verification_expires', { mode: 'date' }),
  failedLoginAttempts: int('failed_login_attempts').notNull().default(0),
  accountLockedUntil: datetime('account_locked_until', { mode: 'date' }),
  lastLoginAt: datetime('last_login_at', { mode: 'date' }),
  invitationSentAt: datetime('invitation_sent_at', { mode: 'date' }),
  invitationCount: int('invitation_count').notNull().default(0),
  tokenUsed: boolean('token_used').notNull().default(false),
  subRole: varchar('sub_role', { length: 50 }), // Store facility sub-roles: store-manager, pharmacy-manager, etc.
  department: varchar('department', { length: 100 }), // Store department information
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: datetime('password_reset_expires', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
  facilityIdx: index('facility_idx').on(table.facilityId),
  phoneIdx: index('phone_idx').on(table.phone),
  verificationTokenIdx: index('verification_token_idx').on(table.emailVerificationToken),
  passwordResetTokenIdx: index('password_reset_token_idx').on(table.passwordResetToken),
}))

/**
 * Admins table
 */
export const admins = mysqlTable('admins', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  emailVerificationExpires: datetime('email_verification_expires', { mode: 'date' }),
  failedLoginAttempts: int('failed_login_attempts').notNull().default(0),
  accountLockedUntil: datetime('account_locked_until', { mode: 'date' }),
  lastLoginAt: datetime('last_login_at', { mode: 'date' }),
  invitationSentAt: datetime('invitation_sent_at', { mode: 'date' }),
  invitationCount: int('invitation_count').notNull().default(0),
  tokenUsed: boolean('token_used').notNull().default(false),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: datetime('password_reset_expires', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  emailIdx: index('admin_email_idx').on(table.email),
  verificationTokenIdx: index('admin_verification_token_idx').on(table.emailVerificationToken),
  passwordResetTokenIdx: index('admin_password_reset_token_idx').on(table.passwordResetToken),
}))

/**
 * Facilities table
 */
export const facilities = mysqlTable('facilities', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  region: varchar('region', { length: 100 }).notNull(),
  regionId: bigint('region_id', { mode: 'number' }),
  districtId: bigint('district_id', { mode: 'number' }),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }), // Email now optional for SMS verification
  password: varchar('password', { length: 255 }).notNull(), // Password for authentication
  emailVerified: boolean('email_verified').notNull().default(true), // Facilities use verification code, so default true
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'inactive' | 'low_credit' | 'suspended'
  paymentModel: varchar('payment_model', { length: 20 }), // 'payg' | 'installment' | 'subscription' - nullable, will be set later in Afya Solar dashboard
  creditBalance: decimal('credit_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  monthlyConsumption: decimal('monthly_consumption', { precision: 10, scale: 2 }).notNull().default('0'),
  systemSize: varchar('system_size', { length: 50 }),
  failedLoginAttempts: int('failed_login_attempts').notNull().default(0),
  accountLockedUntil: datetime('account_locked_until', { mode: 'date' }),
  lastLoginAt: datetime('last_login_at', { mode: 'date' }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: datetime('password_reset_expires', { mode: 'date' }),
  // Invitation fields
  invitationToken: varchar('invitation_token', { length: 255 }),
  invitationExpires: datetime('invitation_expires', { mode: 'date' }),
  // Referral program fields
  referralCode: varchar('referral_code', { length: 20 }).unique(), // Unique referral code for this facility
  referredBy: varchar('referred_by', { length: 36 }), // ID of facility that referred this one
  referralBenefitApplied: boolean('referral_benefit_applied').notNull().default(false), // Whether referral benefit has been applied
  // Booking system fields
  isBookingEnabled: boolean('is_booking_enabled').notNull().default(false),
  bookingWhatsappNumber: varchar('booking_whatsapp_number', { length: 50 }),
  bookingTimezone: varchar('booking_timezone', { length: 50 }).default('Africa/Dar_es_Salaam'),
  bookingSlug: varchar('booking_slug', { length: 255 }),
  bookingSettings: text('booking_settings'), // JSON string for facility-specific booking settings
  // Facility-level SMS sender ID for bulk SMS (SmartSMS)
  smsSenderId: varchar('sms_sender_id', { length: 20 }),
  logoUrl: varchar('logo_url', { length: 500 }), // Facility logo/profile image URL
  category: varchar('category', { length: 50 }).notNull().default('Dispensary'), // Facility category
  latitude: decimal('latitude', { precision: 10, scale: 8 }), // Facility latitude
  longitude: decimal('longitude', { precision: 11, scale: 8 }), // Facility longitude
  // Terms & Conditions acceptance
  acceptTerms: boolean('accept_terms').notNull().default(false), // Tracks if facility accepted Terms & Conditions
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  emailIdx: index('facility_email_idx').on(table.email),
  statusIdx: index('status_idx').on(table.status),
  regionIdx: index('region_idx').on(table.region),
  regionIdIdx: index('facility_region_id_idx').on(table.regionId),
  districtIdIdx: index('facility_district_id_idx').on(table.districtId),
  passwordResetTokenIdx: index('facility_password_reset_token_idx').on(table.passwordResetToken),
  bookingSlugIdx: index('facility_booking_slug_idx').on(table.bookingSlug),
}))

/**
 * Facility branches table
 */
export const facilityBranches = mysqlTable('facility_branches', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  managerName: varchar('manager_name', { length: 255 }),
  totalDepartments: int('total_departments'),
  region: varchar('region', { length: 100 }),
  district: varchar('district', { length: 100 }),
  numberOfStaff: int('number_of_staff'),
  officePhone: varchar('office_phone', { length: 30 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('facility_branches_facility_idx').on(table.facilityId),
  nameIdx: index('facility_branches_name_idx').on(table.name),
}))

/**
 * Facility stores table (for store-manager assignment, same concept as branches)
 */
export const facilityStores = mysqlTable('facility_stores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  managerName: varchar('manager_name', { length: 255 }),
  region: varchar('region', { length: 100 }),
  district: varchar('district', { length: 100 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('facility_stores_facility_idx').on(table.facilityId),
  nameIdx: index('facility_stores_name_idx').on(table.name),
}))

/**
 * Devices table
 */
export const devices = mysqlTable('devices', {
  id: varchar('id', { length: 36 }).primaryKey(),
  serialNumber: varchar('serial_number', { length: 20 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(), // 'eyedro' | 'afyasolar' | 'generic'
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  sensorSize: int('sensor_size').notNull().default(200),
  ports: int('ports').notNull().default(2),
  mode: varchar('mode', { length: 50 }).notNull().default('change_of_state'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'inactive' | 'maintenance'
  lastUpdate: datetime('last_update'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  serialIdx: index('serial_idx').on(table.serialNumber),
  facilityIdx: index('device_facility_idx').on(table.facilityId),
}))

/**
 * Energy data table
 */
export const energyData = mysqlTable('energy_data', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deviceId: varchar('device_id', { length: 36 }).notNull(),
  timestamp: datetime('timestamp', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  voltage: decimal('voltage', { precision: 8, scale: 2 }).notNull(),
  current: decimal('current', { precision: 8, scale: 2 }).notNull(),
  power: decimal('power', { precision: 10, scale: 2 }).notNull(),
  energy: decimal('energy', { precision: 12, scale: 2 }).notNull(),
  creditBalance: decimal('credit_balance', { precision: 12, scale: 2 }).notNull(),
  batteryLevel: decimal('battery_level', { precision: 5, scale: 2 }),
  solarGeneration: decimal('solar_generation', { precision: 10, scale: 2 }),
  gridStatus: varchar('grid_status', { length: 20 }).notNull().default('connected'),
  criticalLoad: boolean('critical_load').notNull().default(false),
}, (table) => ({
  deviceIdx: index('energy_device_idx').on(table.deviceId),
  timestampIdx: index('timestamp_idx').on(table.timestamp),
}))

/**
 * Payments table
 */
export const payments = mysqlTable('payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  method: varchar('method', { length: 20 }).notNull(), // 'mpesa' | 'airtel' | 'mixx' | 'bank' | 'card' | 'wallet' (mixx = Mixx by Yas, formerly Tigo Pesa)
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'completed' | 'failed'
  transactionId: varchar('transaction_id', { length: 255 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('payment_facility_idx').on(table.facilityId),
  statusIdx: index('payment_status_idx').on(table.status),
  transactionIdx: index('transaction_idx').on(table.transactionId),
}))

/**
 * Bills table
 */
export const bills = mysqlTable('bills', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  periodStart: datetime('period_start').notNull(),
  periodEnd: datetime('period_end').notNull(),
  totalConsumption: decimal('total_consumption', { precision: 12, scale: 2 }).notNull(),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'paid' | 'overdue'
  dueDate: datetime('due_date').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('bill_facility_idx').on(table.facilityId),
  statusIdx: index('bill_status_idx').on(table.status),
}))

/**
 * Service jobs table
 */
export const serviceJobs = mysqlTable('service_jobs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  technicianId: varchar('technician_id', { length: 36 }),
  type: varchar('type', { length: 20 }).notNull(), // 'installation' | 'maintenance' | 'repair' | 'inspection'
  priority: varchar('priority', { length: 20 }).notNull().default('medium'), // 'low' | 'medium' | 'high' | 'urgent'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  description: text('description').notNull(),
  scheduledDate: datetime('scheduled_date'),
  completedDate: datetime('completed_date'),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('job_facility_idx').on(table.facilityId),
  technicianIdx: index('job_technician_idx').on(table.technicianId),
  statusIdx: index('job_status_idx').on(table.status),
}))

/**
 * Help requests table
 */
export const helpRequests = mysqlTable('help_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }),
  userId: varchar('user_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'in_progress' | 'resolved' | 'closed'
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('help_facility_idx').on(table.facilityId),
  userIdx: index('help_user_idx').on(table.userId),
  statusIdx: index('help_status_idx').on(table.status),
  emailIdx: index('help_email_idx').on(table.email),
}))

/**
 * Device requests table
 */
export const deviceRequests = mysqlTable('device_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }),
  userId: varchar('user_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  facilityName: varchar('facility_name', { length: 255 }),
  deviceType: varchar('device_type', { length: 50 }),
  quantity: int('quantity').notNull().default(1),
  message: text('message'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled'
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('device_req_facility_idx').on(table.facilityId),
  userIdx: index('device_req_user_idx').on(table.userId),
  statusIdx: index('device_req_status_idx').on(table.status),
  emailIdx: index('device_req_email_idx').on(table.email),
}))

/**
 * Service Subscriptions table
 * Tracks facility subscriptions to additional services.
 */
export const serviceSubscriptions = mysqlTable('service_subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  serviceName: varchar('service_name', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'expired' | 'cancelled' | 'pending'
  planType: varchar('plan_type', { length: 50 }), // 'basic' | 'standard' | 'premium' | null for free trial
  startDate: datetime('start_date', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  expiryDate: datetime('expiry_date', { mode: 'date' }),
  autoRenew: boolean('auto_renew').notNull().default(false),
  paymentMethod: varchar('payment_method', { length: 20 }), // 'mpesa' | 'airtel' | 'card' | etc.
  amount: decimal('amount', { precision: 10, scale: 2 }),
  billingCycle: varchar('billing_cycle', { length: 20 }), // 'monthly' | 'annual'
  cancelledAt: datetime('cancelled_at', { mode: 'date' }),
  cancellationReason: text('cancellation_reason'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('subscription_facility_idx').on(table.facilityId),
  serviceIdx: index('subscription_service_idx').on(table.serviceName),
  statusIdx: index('subscription_status_idx').on(table.status),
  facilityServiceIdx: index('facility_service_idx').on(table.facilityId, table.serviceName),
}))

/**
 * Service Access Payments table
 * Tracks one-time payments required to access services (e.g., Afya Booking access fee)
 */
export const serviceAccessPayments = mysqlTable('service_access_payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  serviceName: varchar('service_name', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  paymentMethod: varchar('payment_method', { length: 50 }), // 'mpesa' | 'airtel' | 'mixx' | 'bank' | 'card' (mixx = Mixx by Yas, formerly Tigo Pesa)
  transactionId: varchar('transaction_id', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'completed' | 'failed'
  paidAt: datetime('paid_at', { mode: 'date' }),
  // For Afya Solar: package selection metadata
  packageId: varchar('package_id', { length: 50 }), // '2kw' | '4.2kw' | '6kw' | '10kw'
  packageName: varchar('package_name', { length: 255 }), // Full package name
  paymentPlan: varchar('payment_plan', { length: 50 }), // 'cash' | 'installment' | 'paas'
  metadata: text('metadata'), // JSON string for additional package details
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('service_access_payment_facility_idx').on(table.facilityId),
  serviceIdx: index('service_access_payment_service_idx').on(table.serviceName),
  statusIdx: index('service_access_payment_status_idx').on(table.status),
  facilityServiceIdx: index('service_access_payment_facility_service_idx').on(table.facilityId, table.serviceName),
}))

/**
 * Afya Solar Invoice Requests
 * Facility requests to pay by invoice; admin sees and processes; email sent to company
 */
export const afyaSolarInvoiceRequests = mysqlTable('afya_solar_invoice_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  facilityName: varchar('facility_name', { length: 255 }).notNull(),
  facilityEmail: varchar('facility_email', { length: 255 }),
  facilityPhone: varchar('facility_phone', { length: 50 }),
  packageId: varchar('package_id', { length: 50 }).notNull(),
  packageName: varchar('package_name', { length: 255 }).notNull(),
  paymentPlan: varchar('payment_plan', { length: 50 }).notNull(), // 'cash' | 'installment' | 'paas'
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  packageMetadata: text('package_metadata'), // JSON
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('asir_facility_idx').on(table.facilityId),
  statusIdx: index('asir_status_idx').on(table.status),
  createdAtIdx: index('asir_created_at_idx').on(table.createdAt),
}))

/**
 * Afya Booking Packages table
 * Defines the available booking packages (BRONZE, SILVER, GOLD, DIAMOND)
 */
export const afyaBookingPackages = mysqlTable('afya_booking_packages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(), // 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  purpose: text('purpose'),
  monthlyPrice: decimal('monthly_price', { precision: 12, scale: 2 }).notNull(),
  yearlyPrice: decimal('yearly_price', { precision: 12, scale: 2 }).notNull(),
  websiteSetupFee: decimal('website_setup_fee', { precision: 12, scale: 2 }), // For DIAMOND
  features: text('features'), // JSON array of feature codes
  bulkSmsFree: int('bulk_sms_free').notNull().default(0), // Free SMS per month
  bulkSmsPrice: decimal('bulk_sms_price', { precision: 10, scale: 2 }).notNull().default('30.00'), // Price per SMS after free limit
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: int('display_order').notNull().default(0),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  codeIdx: index('abp_code_idx').on(table.code),
  isActiveIdx: index('abp_is_active_idx').on(table.isActive),
  displayOrderIdx: index('abp_display_order_idx').on(table.displayOrder),
}))

/**
 * Afya Booking Invoice Requests
 * Facility requests to pay by invoice for booking packages
 */
export const afyaBookingInvoiceRequests = mysqlTable('afya_booking_invoice_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  facilityName: varchar('facility_name', { length: 255 }).notNull(),
  facilityEmail: varchar('facility_email', { length: 255 }),
  facilityPhone: varchar('facility_phone', { length: 50 }),
  packageId: varchar('package_id', { length: 36 }).notNull(),
  packageCode: varchar('package_code', { length: 50 }).notNull(), // 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
  packageName: varchar('package_name', { length: 255 }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(), // 'monthly' | 'yearly'
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  packageMetadata: text('package_metadata'), // JSON
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('abir_facility_idx').on(table.facilityId),
  statusIdx: index('abir_status_idx').on(table.status),
  createdAtIdx: index('abir_created_at_idx').on(table.createdAt),
}))

/**
 * Maintenance plans catalog
 */
export const maintenancePlans = mysqlTable('maintenance_plans', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  tier: mysqlEnum('tier', ['starter', 'standard', 'premium', 'enterprise']).notNull().default('standard'),
  monthlyPrice: decimal('monthly_price', { precision: 12, scale: 2 }).notNull(),
  annualPrice: decimal('annual_price', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  responseTimeHours: int('response_time_hours'),
  visitsPerYear: int('visits_per_year'),
  coverageDescription: text('coverage_description'),
  includesParts: boolean('includes_parts').notNull().default(false),
  includesLoanerEquipment: boolean('includes_loaner_equipment').notNull().default(false),
  includes24x7Support: boolean('includes_24x7_support').notNull().default(false),
  maintenancePlanStatus: mysqlEnum('maintenance_plan_status', ['active', 'inactive']).notNull().default('active'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  tierIdx: index('maintenance_plans_tier_idx').on(table.tier),
  statusIdx: index('maintenance_plans_status_idx').on(table.maintenancePlanStatus),
}))

/**
 * Facility plan enrollments
 */
export const facilityMaintenancePlans = mysqlTable('facility_maintenance_plans', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  planId: varchar('plan_id', { length: 36 }).notNull(),
  facilityPlanStatus: mysqlEnum('facility_plan_status', ['active', 'pending', 'suspended', 'expired', 'cancelled']).notNull().default('pending'),
  startDate: datetime('start_date', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  endDate: datetime('end_date', { mode: 'date' }),
  maintenanceBillingCycle: mysqlEnum('maintenance_billing_cycle', ['monthly', 'quarterly', 'annual']).notNull().default('monthly'),
  lastPaymentDate: datetime('last_payment_date', { mode: 'date' }),
  nextPaymentDate: datetime('next_payment_date', { mode: 'date' }),
  autoRenew: boolean('auto_renew').notNull().default(true),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('facility_maintenance_plans_facility_idx').on(table.facilityId),
  planIdx: index('facility_maintenance_plans_plan_idx').on(table.planId),
  statusIdx: index('facility_maintenance_plans_status_idx').on(table.facilityPlanStatus),
}))

/**
 * Planned preventive visits linked to facility plans
 */
export const maintenancePlanVisits = mysqlTable('maintenance_plan_visits', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityPlanId: varchar('facility_plan_id', { length: 36 }).notNull(),
  technicianId: varchar('technician_id', { length: 36 }),
  visitType: mysqlEnum('visit_type', ['preventive', 'inspection', 'training', 'audit']).notNull(),
  visitStatus: mysqlEnum('visit_status', ['scheduled', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled']).notNull().default('scheduled'),
  scheduledDate: datetime('scheduled_date', { mode: 'date' }).notNull(),
  completedDate: datetime('completed_date', { mode: 'date' }),
  summary: text('summary'),
  findings: text('findings'),
  followUpActions: text('follow_up_actions'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityPlanIdx: index('maintenance_plan_visits_facility_plan_idx').on(table.facilityPlanId),
  technicianIdx: index('maintenance_plan_visits_technician_idx').on(table.technicianId),
  statusIdx: index('maintenance_plan_visits_status_idx').on(table.visitStatus),
}))

/**
 * Maintenance Plan Requests - Facility requests for custom maintenance plans
 */
export const maintenancePlanRequests = mysqlTable('maintenance_plan_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  requestNumber: varchar('request_number', { length: 50 }).notNull().unique(),
  status: mysqlEnum('request_status', ['pending', 'technician_assigned', 'evaluation_in_progress', 'proposal_submitted', 'admin_approved', 'facility_approved', 'facility_rejected', 'payment_pending', 'payment_confirmed', 'active', 'cancelled']).notNull().default('pending'),
  assignedTechnicianId: varchar('assigned_technician_id', { length: 36 }),
  assignedAt: datetime('assigned_at', { mode: 'date' }),
  proposalSubmittedAt: datetime('proposal_submitted_at', { mode: 'date' }),
  adminApprovedAt: datetime('admin_approved_at', { mode: 'date' }),
  adminApprovedBy: varchar('admin_approved_by', { length: 36 }),
  facilityApprovedAt: datetime('facility_approved_at', { mode: 'date' }),
  facilityRejectedAt: datetime('facility_rejected_at', { mode: 'date' }),
  facilityRejectionReason: text('facility_rejection_reason'),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('maintenance_plan_requests_facility_idx').on(table.facilityId),
  technicianIdx: index('maintenance_plan_requests_technician_idx').on(table.assignedTechnicianId),
  statusIdx: index('maintenance_plan_requests_status_idx').on(table.status), // Index on request_status column
  requestNumberIdx: index('maintenance_plan_requests_number_idx').on(table.requestNumber),
}))

/**
 * Maintenance Plan Request Equipment - Equipment selected by facility for maintenance plan
 */
export const maintenancePlanRequestEquipment = mysqlTable('maintenance_plan_request_equipment', {
  id: varchar('id', { length: 36 }).primaryKey(),
  requestId: varchar('request_id', { length: 36 }).notNull(),
  equipmentId: varchar('equipment_id', { length: 36 }).notNull(),
  lastMaintenanceDate: date('last_maintenance_date', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_plan_request_equipment_request_idx').on(table.requestId),
  equipmentIdx: index('maintenance_plan_request_equipment_equipment_idx').on(table.equipmentId),
}))

/**
 * Maintenance Plan Proposals - Technician's proposals for maintenance plans
 */
export const maintenancePlanProposals = mysqlTable('maintenance_plan_proposals', {
  id: varchar('id', { length: 36 }).primaryKey(),
  requestId: varchar('request_id', { length: 36 }).notNull(),
  technicianId: varchar('technician_id', { length: 36 }).notNull(),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  proposalNotes: text('proposal_notes'),
  status: mysqlEnum('proposal_status', ['draft', 'submitted', 'admin_approved', 'admin_rejected', 'facility_approved', 'facility_rejected']).notNull().default('draft'),
  submittedAt: datetime('submitted_at', { mode: 'date' }),
  adminApprovedAt: datetime('admin_approved_at', { mode: 'date' }),
  adminApprovedBy: varchar('admin_approved_by', { length: 36 }),
  adminRejectionReason: text('admin_rejection_reason'),
  facilityApprovedAt: datetime('facility_approved_at', { mode: 'date' }),
  facilityRejectedAt: datetime('facility_rejected_at', { mode: 'date' }),
  facilityRejectionReason: text('facility_rejection_reason'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_plan_proposals_request_idx').on(table.requestId),
  technicianIdx: index('maintenance_plan_proposals_technician_idx').on(table.technicianId),
  statusIdx: index('maintenance_plan_proposals_status_idx').on(table.status), // Index on proposal_status column
}))

/**
 * Maintenance Plan Proposal Items - Individual equipment maintenance plans within a proposal
 */
export const maintenancePlanProposalItems = mysqlTable('maintenance_plan_proposal_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  proposalId: varchar('proposal_id', { length: 36 }).notNull(),
  equipmentId: varchar('equipment_id', { length: 36 }).notNull(),
  maintenanceType: mysqlEnum('maintenance_type', ['preventive', 'corrective', 'inspection', 'calibration', 'full_service']).notNull(),
  scheduleType: mysqlEnum('schedule_type', ['per_year', 'per_service', 'monthly', 'quarterly', 'custom']).notNull(),
  visitsPerYear: int('visits_per_year'),
  pricePerService: decimal('price_per_service', { precision: 12, scale: 2 }),
  pricePerYear: decimal('price_per_year', { precision: 12, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }).notNull(),
  durationMonths: int('duration_months'),
  startDate: datetime('start_date', { mode: 'date' }),
  endDate: datetime('end_date', { mode: 'date' }),
  includesParts: boolean('includes_parts').notNull().default(false),
  includesEmergencySupport: boolean('includes_emergency_support').notNull().default(false),
  responseTimeHours: int('response_time_hours'),
  description: text('description'),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  proposalIdx: index('maintenance_plan_proposal_items_proposal_idx').on(table.proposalId),
  equipmentIdx: index('maintenance_plan_proposal_items_equipment_idx').on(table.equipmentId),
}))

/**
 * Maintenance Plan Payments - Payment tracking for approved maintenance plans
 */
export const maintenancePlanPayments = mysqlTable('maintenance_plan_payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  proposalId: varchar('proposal_id', { length: 36 }).notNull(),
  requestId: varchar('request_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  paymentType: mysqlEnum('payment_type', ['half', 'full']).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  transactionId: varchar('transaction_id', { length: 255 }),
  paymentStatus: mysqlEnum('payment_status', ['pending', 'paid', 'confirmed', 'failed', 'refunded']).notNull().default('pending'),
  paidAt: datetime('paid_at', { mode: 'date' }),
  confirmedAt: datetime('confirmed_at', { mode: 'date' }),
  confirmedBy: varchar('confirmed_by', { length: 36 }),
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  proposalIdx: index('maintenance_plan_payments_proposal_idx').on(table.proposalId),
  requestIdx: index('maintenance_plan_payments_request_idx').on(table.requestId),
  facilityIdx: index('maintenance_plan_payments_facility_idx').on(table.facilityId),
  statusIdx: index('maintenance_plan_payments_status_idx').on(table.paymentStatus),
}))

/**
 * Maintenance Plan Status History - Track all status changes for audit trail
 */
export const maintenancePlanStatusHistory = mysqlTable('maintenance_plan_status_history', {
  id: varchar('id', { length: 36 }).primaryKey(),
  requestId: varchar('request_id', { length: 36 }),
  proposalId: varchar('proposal_id', { length: 36 }),
  paymentId: varchar('payment_id', { length: 36 }),
  entityType: mysqlEnum('entity_type', ['request', 'proposal', 'payment']).notNull(),
  previousStatus: varchar('previous_status', { length: 50 }),
  newStatus: varchar('new_status', { length: 50 }).notNull(),
  changedBy: varchar('changed_by', { length: 36 }).notNull(),
  changedByRole: mysqlEnum('changed_by_role', ['admin', 'facility', 'technician']).notNull(),
  changedByName: varchar('changed_by_name', { length: 255 }),
  reason: text('reason'),
  metadata: text('metadata'), // JSON string for additional context
  ipAddress: varchar('ip_address', { length: 100 }),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_plan_history_request_idx').on(table.requestId),
  proposalIdx: index('maintenance_plan_history_proposal_idx').on(table.proposalId),
  paymentIdx: index('maintenance_plan_history_payment_idx').on(table.paymentId),
  entityTypeIdx: index('maintenance_plan_history_entity_type_idx').on(table.entityType),
  changedByIdx: index('maintenance_plan_history_changed_by_idx').on(table.changedBy),
  createdIdx: index('maintenance_plan_history_created_idx').on(table.createdAt),
}))

/**
 * Regions & districts (used for technician/facility metadata)
 */
export const regions = mysqlTable('regions', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: boolean('status').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
})

export const districts = mysqlTable('districts', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  regionId: bigint('region_id', { mode: 'number' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: boolean('status').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  regionIdx: index('district_region_idx').on(table.regionId),
}))

/**
 * Technicians (biomedical engineers)
 */
export const technicians = mysqlTable('technicians', {
  id: varchar('id', { length: 36 }).primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }),
  yearsExperience: int('years_experience').default(0),
  practicingLicense: varchar('practicing_license', { length: 255 }),
  shortBio: text('short_bio'),
  regionId: bigint('region_id', { mode: 'number' }),
  districtId: bigint('district_id', { mode: 'number' }),
  availabilityStatus: mysqlEnum('availability_status', ['available', 'busy', 'offline']).notNull().default('available'),
  status: mysqlEnum('status', ['active', 'inactive', 'banned']).notNull().default('active'),
  licenseVerified: boolean('license_verified').notNull().default(false),
  licenseVerifiedAt: datetime('license_verified_at', { mode: 'date' }),
  averageRating: decimal('average_rating', { precision: 5, scale: 2 }).default('0'),
  totalReviews: int('total_reviews').notNull().default(0),
  lastActiveAt: datetime('last_active_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  emailIdx: index('technician_email_idx').on(table.email),
  phoneIdx: index('technician_phone_idx').on(table.phone),
  regionIdx: index('technician_region_idx').on(table.regionId),
  districtIdx: index('technician_district_idx').on(table.districtId),
}))

/**
 * Technician Commissions - Track commission earnings from completed work
 */
export const technicianCommissions = mysqlTable('technician_commissions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  technicianId: varchar('technician_id', { length: 36 }).notNull(),
  maintenanceRequestId: varchar('maintenance_request_id', { length: 36 }).notNull(),
  commissionPercentage: decimal('commission_percentage', { precision: 5, scale: 2 }).notNull(),
  totalPaymentAmount: decimal('total_payment_amount', { precision: 12, scale: 2 }).notNull(), // Total amount facility paid
  commissionAmount: decimal('commission_amount', { precision: 12, scale: 2 }).notNull(), // Calculated commission
  currency: varchar('currency', { length: 10 }).default('TZS'),
  status: mysqlEnum('commission_status', ['pending', 'earned', 'withdrawn']).notNull().default('earned'),
  earnedAt: datetime('earned_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  withdrawnAt: datetime('withdrawn_at', { mode: 'date' }),
  withdrawalId: varchar('withdrawal_id', { length: 36 }), // Link to withdrawal if withdrawn
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  technicianIdx: index('technician_commission_technician_idx').on(table.technicianId),
  requestIdx: index('technician_commission_request_idx').on(table.maintenanceRequestId),
  statusIdx: index('technician_commission_status_idx').on(table.status),
  earnedIdx: index('technician_commission_earned_idx').on(table.earnedAt),
}))

/**
 * Technician Withdrawals - Track withdrawal requests
 */
export const technicianWithdrawals = mysqlTable('technician_withdrawals', {
  id: varchar('id', { length: 36 }).primaryKey(),
  technicianId: varchar('technician_id', { length: 36 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  withdrawalMethod: varchar('withdrawal_method', { length: 50 }), // 'mpesa', 'bank_transfer', etc.
  accountDetails: text('account_details'), // JSON string with account info
  status: mysqlEnum('withdrawal_status', ['pending', 'processing', 'completed', 'rejected', 'cancelled']).notNull().default('pending'),
  adminNotes: text('admin_notes'),
  processedAt: datetime('processed_at', { mode: 'date' }),
  processedBy: varchar('processed_by', { length: 36 }), // Admin user ID
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  technicianIdx: index('technician_withdrawal_technician_idx').on(table.technicianId),
  statusIdx: index('technician_withdrawal_status_idx').on(table.status),
  createdIdx: index('technician_withdrawal_created_idx').on(table.createdAt),
}))

/**
 * Equipment management
 */
export const equipmentCategories = mysqlTable('equipment_categories', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
})

export const facilityEquipment = mysqlTable('facility_equipment', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  categoryId: varchar('category_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 255 }),
  manufacturer: varchar('manufacturer', { length: 255 }),
  purchaseDate: datetime('purchase_date', { mode: 'date' }),
  installationDate: datetime('installation_date', { mode: 'date' }),
  warrantyExpiryDate: datetime('warranty_expiry_date', { mode: 'date' }),
  purchaseCost: decimal('purchase_cost', { precision: 12, scale: 2 }),
  locationInFacility: varchar('location_in_facility', { length: 255 }),
  status: mysqlEnum('status', ['active', 'inactive', 'maintenance', 'retired']).notNull().default('active'),
  condition: mysqlEnum('condition', ['excellent', 'good', 'fair', 'poor']).notNull().default('good'),
  specifications: text('specifications'),
  maintenanceNotes: text('maintenance_notes'),
  images: text('images'),
  qrCode: varchar('qr_code', { length: 255 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('facility_equipment_facility_idx').on(table.facilityId),
  categoryIdx: index('facility_equipment_category_idx').on(table.categoryId),
  serialIdx: index('facility_equipment_serial_idx').on(table.serialNumber),
}))

/**
 * Maintenance workflow tables
 */
export const maintenanceRequests = mysqlTable('maintenance_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  requestNumber: varchar('request_number', { length: 50 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  equipmentId: varchar('equipment_id', { length: 36 }),
  assignedTechnicianId: varchar('assigned_technician_id', { length: 36 }),
  commissionPercentage: decimal('commission_percentage', { precision: 5, scale: 2 }), // Commission percentage (0-100)
  maintenanceType: mysqlEnum('maintenance_type', ['preventive', 'corrective', 'emergency']).notNull().default('corrective'),
  urgencyLevel: mysqlEnum('urgency_level', ['low', 'medium', 'high', 'critical']).notNull().default('medium'),
  deviceName: varchar('device_name', { length: 255 }).notNull(),
  issueDescription: text('issue_description').notNull(),
  deviceImages: text('device_images'),
  additionalDescription: text('additional_description'),
  baseFee: decimal('base_fee', { precision: 12, scale: 2 }).default('0'),
  engineerQuote: decimal('engineer_quote', { precision: 12, scale: 2 }),
  partsCost: decimal('parts_cost', { precision: 12, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
  advancePaymentAmount: decimal('advance_payment_amount', { precision: 12, scale: 2 }).default('0'),
  advancePaymentStatus: mysqlEnum('advance_payment_status', ['pending', 'paid']).notNull().default('pending'),
  advancePaidAt: datetime('advance_paid_at', { mode: 'date' }),
  finalPaymentAmount: decimal('final_payment_amount', { precision: 12, scale: 2 }).default('0'),
  finalPaymentStatus: mysqlEnum('final_payment_status', ['pending', 'paid']).notNull().default('pending'),
  finalPaidAt: datetime('final_paid_at', { mode: 'date' }),
  status: mysqlEnum('status', [
    'pending',
    'engineer_assigned',
    'engineer_confirmed',
    'under_inspection',
    'quote_submitted',
    'quote_approved',
    'quote_accepted',
    'advance_due',
    'advance_paid',
    'in_progress',
    'report_submitted',
    'report_approved',
    'final_payment_due',
    'completed',
    'reviewed',
    'cancelled',
  ]).notNull().default('pending'),
  assignedAt: datetime('assigned_at', { mode: 'date' }),
  confirmedAt: datetime('confirmed_at', { mode: 'date' }),
  quoteSubmittedAt: datetime('quote_submitted_at', { mode: 'date' }),
  quoteApprovedAt: datetime('quote_approved_at', { mode: 'date' }),
  quoteAcceptedAt: datetime('quote_accepted_at', { mode: 'date' }),
  reportApprovedAt: datetime('report_approved_at', { mode: 'date' }),
  startedAt: datetime('started_at', { mode: 'date' }),
  completedAt: datetime('completed_at', { mode: 'date' }),
  paymentCompletedAt: datetime('payment_completed_at', { mode: 'date' }),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: datetime('cancelled_at', { mode: 'date' }),
  cancelledBy: varchar('cancelled_by', { length: 36 }),
  cancelledByType: mysqlEnum('cancelled_by_type', ['admin', 'facility', 'technician']),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('maintenance_request_facility_idx').on(table.facilityId),
  equipmentIdx: index('maintenance_request_equipment_idx').on(table.equipmentId),
  technicianIdx: index('maintenance_request_technician_idx').on(table.assignedTechnicianId),
  statusIdx: index('maintenance_request_status_idx').on(table.status),
  requestNumberIdx: index('maintenance_request_number_idx').on(table.requestNumber),
}))

export const maintenanceQuotes = mysqlTable('maintenance_quotes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  maintenanceRequestId: varchar('maintenance_request_id', { length: 36 }).notNull(),
  technicianId: varchar('technician_id', { length: 36 }).notNull(),
  description: text('description'),
  baseFee: decimal('base_fee', { precision: 12, scale: 2 }).default('0'),
  partsCost: decimal('parts_cost', { precision: 12, scale: 2 }).default('0'),
  laborHours: decimal('labor_hours', { precision: 10, scale: 2 }).default('0'),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }).default('0'),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }).default('0'),
  estimatedCompletionTime: varchar('estimated_completion_time', { length: 255 }),
  adminApproved: boolean('admin_approved').default(false),
  adminApprovedAt: datetime('admin_approved_at', { mode: 'date' }),
  facilityAccepted: boolean('facility_accepted').default(false),
  facilityAcceptedAt: datetime('facility_accepted_at', { mode: 'date' }),
  status: mysqlEnum('status', ['pending', 'approved', 'rejected']).notNull().default('pending'),
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_quote_request_idx').on(table.maintenanceRequestId),
  technicianIdx: index('maintenance_quote_technician_idx').on(table.technicianId),
  statusIdx: index('maintenance_quote_status_idx').on(table.status),
}))

export const maintenanceQuoteItems = mysqlTable('maintenance_quote_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  maintenanceQuoteId: varchar('maintenance_quote_id', { length: 36 }).notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  itemType: mysqlEnum('item_type', ['examination', 'parts', 'labor']).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  quoteIdx: index('maintenance_quote_item_quote_idx').on(table.maintenanceQuoteId),
  typeIdx: index('maintenance_quote_item_type_idx').on(table.itemType),
}))

export const maintenanceReports = mysqlTable('maintenance_reports', {
  id: varchar('id', { length: 36 }).primaryKey(),
  maintenanceRequestId: varchar('maintenance_request_id', { length: 36 }).notNull(),
  technicianId: varchar('technician_id', { length: 36 }).notNull(),
  workDescription: text('work_description').notNull(),
  partsUsed: text('parts_used'),
  recommendations: text('recommendations'),
  completionImages: text('completion_images'),
  workStartedAt: datetime('work_started_at', { mode: 'date' }),
  workCompletedAt: datetime('work_completed_at', { mode: 'date' }),
  hoursWorked: decimal('hours_worked', { precision: 10, scale: 2 }),
  adminReviewed: boolean('admin_reviewed').default(false),
  adminApproved: boolean('admin_approved').default(false),
  adminReviewedAt: datetime('admin_reviewed_at', { mode: 'date' }),
  adminComments: text('admin_comments'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_report_request_idx').on(table.maintenanceRequestId),
  technicianIdx: index('maintenance_report_technician_idx').on(table.technicianId),
}))

export const maintenanceReviews = mysqlTable('maintenance_reviews', {
  id: varchar('id', { length: 36 }).primaryKey(),
  maintenanceRequestId: varchar('maintenance_request_id', { length: 36 }).notNull(),
  reviewerId: varchar('reviewer_id', { length: 36 }).notNull(),
  reviewerType: mysqlEnum('reviewer_type', ['facility', 'technician']).notNull(),
  reviewedId: varchar('reviewed_id', { length: 36 }).notNull(),
  reviewedType: mysqlEnum('reviewed_type', ['facility', 'technician']).notNull(),
  rating: int('rating').notNull().default(0),
  comment: text('comment'),
  reviewAspects: text('review_aspects'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_review_request_idx').on(table.maintenanceRequestId),
  reviewerIdx: index('maintenance_review_reviewer_idx').on(table.reviewerId),
  reviewedIdx: index('maintenance_review_reviewed_idx').on(table.reviewedId),
}))

export const maintenanceRequestComments = mysqlTable('maintenance_request_comments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  maintenanceRequestId: varchar('maintenance_request_id', { length: 36 }).notNull(),
  authorId: varchar('author_id', { length: 36 }).notNull(),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  authorRole: mysqlEnum('author_role', ['admin', 'technician', 'facility']).notNull(),
  visibility: mysqlEnum('visibility', ['internal', 'facility', 'technician', 'public']).notNull().default('internal'),
  message: text('message').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  requestIdx: index('maintenance_comment_request_idx').on(table.maintenanceRequestId),
  visibilityIdx: index('maintenance_comment_visibility_idx').on(table.visibility),
}))

export const maintenanceAuditLogs = mysqlTable('maintenance_audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }),
  userEmail: varchar('user_email', { length: 255 }),
  action: varchar('action', { length: 255 }).notNull(),
  resource: varchar('resource', { length: 255 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 100 }),
  userAgent: varchar('user_agent', { length: 255 }),
  success: boolean('success').notNull().default(true),
  error: text('error'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdx: index('maintenance_audit_user_idx').on(table.userId),
  resourceIdx: index('maintenance_audit_resource_idx').on(table.resource),
  createdIdx: index('maintenance_audit_created_idx').on(table.createdAt),
}))

/**
 * Circular Economy & Advanced Operations Tables
 */
export const equipmentBuybacks = mysqlTable('equipment_buybacks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  equipmentId: varchar('equipment_id', { length: 36 }),
  equipmentName: varchar('equipment_name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 255 }),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 255 }),
  purchaseDate: datetime('purchase_date', { mode: 'date' }),
  ageYears: decimal('age_years', { precision: 5, scale: 2 }),
  condition: mysqlEnum('buyback_condition', ['excellent', 'good', 'fair', 'poor']).notNull().default('good'),
  functionalStatus: mysqlEnum('buyback_functional_status', ['fully_functional', 'partially_functional', 'not_functional']).notNull().default('fully_functional'),
  hasWarranty: boolean('has_warranty').notNull().default(false),
  warrantyExpiry: datetime('warranty_expiry', { mode: 'date' }),
  hasDocumentation: boolean('has_documentation').notNull().default(false),
  issueDescription: text('issue_description'),
  reasonForSale: varchar('reason_for_sale', { length: 255 }),
  expectedPrice: decimal('expected_price', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  status: mysqlEnum('buyback_status', [
    'draft',
    'submitted',
    'under_review',
    'offer_sent',
    'accepted',
    'rejected',
    'pickup_scheduled',
    'received',
    'refurbishing',
    'completed',
  ]).notNull().default('submitted'),
  adminNotes: text('admin_notes'),
  quoteAmount: decimal('quote_amount', { precision: 12, scale: 2 }),
  quoteCurrency: varchar('quote_currency', { length: 10 }),
  quoteExpiresAt: datetime('quote_expires_at', { mode: 'date' }),
  pickupDate: datetime('pickup_date', { mode: 'date' }),
  payoutAmount: decimal('payout_amount', { precision: 12, scale: 2 }),
  payoutDate: datetime('payout_date', { mode: 'date' }),
  impactWeightKg: decimal('impact_weight_kg', { precision: 8, scale: 2 }),
  evaluationReport: text('evaluation_report'),
  createdBy: varchar('created_by', { length: 36 }),
  updatedBy: varchar('updated_by', { length: 36 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('equipment_buybacks_facility_idx').on(table.facilityId),
  statusIdx: index('equipment_buybacks_status_idx').on(table.status),
  equipmentIdx: index('equipment_buybacks_equipment_idx').on(table.equipmentId),
}))

export const equipmentBuybackPhotos = mysqlTable('equipment_buyback_photos', {
  id: varchar('id', { length: 36 }).primaryKey(),
  buybackId: varchar('buyback_id', { length: 36 }).notNull(),
  url: text('url').notNull(),
  caption: varchar('caption', { length: 255 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  buybackIdx: index('equipment_buyback_photos_buyback_idx').on(table.buybackId),
}))

export const refurbishmentJobs = mysqlTable('refurbishment_jobs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  buybackId: varchar('buyback_id', { length: 36 }).notNull(),
  technicianId: varchar('technician_id', { length: 36 }),
  title: varchar('title', { length: 255 }).notNull(),
  status: mysqlEnum('refurb_status', ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled']).notNull().default('planned'),
  priority: mysqlEnum('refurb_priority', ['low', 'medium', 'high', 'urgent']).notNull().default('medium'),
  startDate: datetime('start_date', { mode: 'date' }),
  estimatedCompletion: datetime('estimated_completion', { mode: 'date' }),
  completedAt: datetime('completed_at', { mode: 'date' }),
  partsCost: decimal('parts_cost', { precision: 12, scale: 2 }).default('0'),
  laborCost: decimal('labor_cost', { precision: 12, scale: 2 }).default('0'),
  notes: text('notes'),
  findings: text('findings'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  buybackIdx: index('refurbishment_jobs_buyback_idx').on(table.buybackId),
  technicianIdx: index('refurbishment_jobs_technician_idx').on(table.technicianId),
  statusIdx: index('refurbishment_jobs_status_idx').on(table.status),
}))

export const refurbishmentJobComments = mysqlTable('refurbishment_job_comments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  refurbishmentJobId: varchar('refurbishment_job_id', { length: 36 }).notNull(),
  authorId: varchar('author_id', { length: 36 }).notNull(),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  authorRole: mysqlEnum('refurb_comment_author_role', ['admin', 'technician']).notNull(),
  message: text('message').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  jobIdx: index('refurb_comment_job_idx').on(table.refurbishmentJobId),
  authorIdx: index('refurb_comment_author_idx').on(table.authorId),
}))

export const adminEquipmentListings = mysqlTable('admin_equipment_listings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  equipmentName: varchar('equipment_name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 255 }),
  model: varchar('model', { length: 255 }),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  condition: mysqlEnum('equipment_condition', ['new', 'refurbished', 'used']).notNull().default('refurbished'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  quantity: int('quantity').notNull().default(1),
  status: mysqlEnum('listing_status', ['draft', 'published', 'sold_out', 'archived']).notNull().default('draft'),
  warrantyMonths: int('warranty_months'),
  specifications: text('specifications'), // JSON string of specifications
  features: text('features'), // JSON array of features
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  updatedBy: varchar('updated_by', { length: 36 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  publishedAt: datetime('published_at', { mode: 'date' }),
}, (table) => ({
  statusIdx: index('admin_equipment_status_idx').on(table.status),
  categoryIdx: index('admin_equipment_category_idx').on(table.category),
  createdByIdx: index('admin_equipment_created_by_idx').on(table.createdBy),
}))

export const adminEquipmentPhotos = mysqlTable('admin_equipment_photos', {
  id: varchar('id', { length: 36 }).primaryKey(),
  equipmentId: varchar('equipment_id', { length: 36 }).notNull(),
  url: text('url').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  caption: varchar('caption', { length: 255 }),
  order: int('order').default(0),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  equipmentIdx: index('admin_equipment_photos_equipment_idx').on(table.equipmentId),
  primaryIdx: index('admin_equipment_photos_primary_idx').on(table.isPrimary),
}))

export const resaleInventory = mysqlTable('resale_inventory', {
  id: varchar('id', { length: 36 }).primaryKey(),
  refurbishmentJobId: varchar('refurbishment_job_id', { length: 36 }).notNull(),
  sku: varchar('sku', { length: 50 }),
  equipmentName: varchar('equipment_name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 255 }),
  model: varchar('model', { length: 255 }),
  condition: mysqlEnum('resale_condition', ['excellent', 'good', 'fair']).notNull().default('good'),
  status: mysqlEnum('resale_status', ['draft', 'listed', 'reserved', 'sold', 'retired']).notNull().default('draft'),
  listPrice: decimal('list_price', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('TZS'),
  reservedByFacilityId: varchar('reserved_by_facility_id', { length: 36 }),
  reservedAt: datetime('reserved_at', { mode: 'date' }),
  soldAt: datetime('sold_at', { mode: 'date' }),
  salePrice: decimal('sale_price', { precision: 12, scale: 2 }),
  projectedMargin: decimal('projected_margin', { precision: 12, scale: 2 }),
  marginPercentage: decimal('margin_percentage', { precision: 5, scale: 2 }),
  warrantyMonths: int('warranty_months'),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  jobIdx: index('resale_inventory_job_idx').on(table.refurbishmentJobId),
  statusIdx: index('resale_inventory_status_idx').on(table.status),
}))

export const spareParts = mysqlTable('spare_parts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  manufacturer: varchar('manufacturer', { length: 255 }),
  specification: text('specification'),
  unitCost: decimal('unit_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  quantityOnHand: int('quantity_on_hand').notNull().default(0),
  reorderLevel: int('reorder_level').notNull().default(5),
  storageLocation: varchar('storage_location', { length: 100 }),
  leadTimeDays: int('lead_time_days'),
  lastRestockedAt: datetime('last_restocked_at', { mode: 'date' }),
  supplierName: varchar('supplier_name', { length: 255 }),
  supplierContact: varchar('supplier_contact', { length: 255 }),
  status: mysqlEnum('part_status', ['active', 'inactive', 'discontinued']).notNull().default('active'),
  metadata: text('metadata'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  skuIdx: index('spare_parts_sku_idx').on(table.sku),
  categoryIdx: index('spare_parts_category_idx').on(table.category),
}))

export const partOrders = mysqlTable('part_orders', {
  id: varchar('id', { length: 36 }).primaryKey(),
  partId: varchar('part_id', { length: 36 }).notNull(),
  requestedById: varchar('requested_by_id', { length: 36 }),
  requestedByType: mysqlEnum('part_requester_type', ['technician', 'admin', 'system']).notNull().default('technician'),
  maintenanceRequestId: varchar('maintenance_request_id', { length: 36 }),
  quantity: int('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }),
  status: mysqlEnum('part_order_status', ['draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'cancelled']).notNull().default('pending_approval'),
  priority: mysqlEnum('part_order_priority', ['low', 'medium', 'high']).notNull().default('medium'),
  neededBy: datetime('needed_by', { mode: 'date' }),
  approvedById: varchar('approved_by_id', { length: 36 }),
  approvedAt: datetime('approved_at', { mode: 'date' }),
  receivedAt: datetime('received_at', { mode: 'date' }),
  vendorName: varchar('vendor_name', { length: 255 }),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  partIdx: index('part_orders_part_idx').on(table.partId),
  statusIdx: index('part_orders_status_idx').on(table.status),
  maintenanceIdx: index('part_orders_maintenance_idx').on(table.maintenanceRequestId),
}))

/**
 * Afya Booking System Tables
 */

/**
 * Departments table - Facility departments (Cardiology, Neurology, etc.)
 */
export const departments = mysqlTable('departments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('department_facility_idx').on(table.facilityId),
  isActiveIdx: index('department_is_active_idx').on(table.isActive),
}))

/**
 * Doctors table - Specialist doctors with profiles and specialties
 */
export const doctors = mysqlTable('doctors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  departmentId: varchar('department_id', { length: 36 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 255 }).notNull(),
  bio: text('bio'),
  phone: varchar('phone', { length: 255 }),
  email: varchar('email', { length: 255 }),
  photoUrl: varchar('photo_url', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('doctor_facility_idx').on(table.facilityId),
  departmentIdx: index('doctor_department_idx').on(table.departmentId),
  isActiveIdx: index('doctor_is_active_idx').on(table.isActive),
}))

/**
 * Doctor time slots table - Manual time slots with capacity control
 */
export const doctorTimeSlots = mysqlTable('doctor_time_slots', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  doctorId: varchar('doctor_id', { length: 36 }).notNull(),
  startsAt: datetime('starts_at', { mode: 'date' }).notNull(),
  endsAt: datetime('ends_at', { mode: 'date' }).notNull(),
  capacity: int('capacity').notNull().default(1),
  status: mysqlEnum('status', ['available', 'blocked', 'booked', 'cancelled']).notNull().default('available'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('time_slot_facility_idx').on(table.facilityId),
  doctorIdx: index('time_slot_doctor_idx').on(table.doctorId),
  statusIdx: index('time_slot_status_idx').on(table.status),
  startsAtIdx: index('time_slot_starts_at_idx').on(table.startsAt),
}))

/**
 * Patients table - Patient demographic and contact information
 */
export const patients = mysqlTable('patients', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  dateOfBirth: datetime('date_of_birth', { mode: 'date' }),
  gender: mysqlEnum('gender', ['male', 'female', 'other']),
  firstVisit: boolean('first_visit').notNull().default(true),
  optedInWhatsapp: boolean('opted_in_whatsapp').notNull().default(false),
  optedInSms: boolean('opted_in_sms').notNull().default(false),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('patient_facility_idx').on(table.facilityId),
  phoneIdx: index('patient_phone_idx').on(table.phone),
  facilityPhoneIdx: index('patient_facility_phone_idx').on(table.facilityId, table.phone),
}))

/**
 * Insurance providers table - Health insurance partners per facility
 */
export const insuranceProviders = mysqlTable('insurance_providers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  shortCode: varchar('short_code', { length: 50 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('insurance_provider_facility_idx').on(table.facilityId),
  nameIdx: index('insurance_provider_name_idx').on(table.name),
  activeIdx: index('insurance_provider_active_idx').on(table.isActive),
}))

/**
 * Insurance coverages table - Coverage types per provider/facility
 */
export const insuranceCoverages = mysqlTable('insurance_coverages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  providerId: varchar('provider_id', { length: 36 }).notNull(),
  departmentId: varchar('department_id', { length: 36 }),
  name: varchar('name', { length: 255 }).notNull(),
  coverageType: mysqlEnum('coverage_type', ['inpatient', 'outpatient', 'lab', 'pharmacy', 'other']).notNull().default('outpatient'),
  copayPercent: decimal('copay_percent', { precision: 5, scale: 2 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('insurance_coverage_facility_idx').on(table.facilityId),
  providerIdx: index('insurance_coverage_provider_idx').on(table.providerId),
  departmentIdx: index('insurance_coverage_department_idx').on(table.departmentId),
  activeIdx: index('insurance_coverage_active_idx').on(table.isActive),
}))

/**
 * Appointments table - Core booking records with status tracking
 */
export const appointments = mysqlTable('appointments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  departmentId: varchar('department_id', { length: 36 }).notNull(),
  doctorId: varchar('doctor_id', { length: 36 }).notNull(),
  patientId: varchar('patient_id', { length: 36 }).notNull(),
  timeSlotId: varchar('time_slot_id', { length: 36 }).notNull(),
  status: mysqlEnum('status', ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).notNull().default('pending'),
  source: mysqlEnum('source', ['web', 'whatsapp']).notNull().default('web'),
  notes: text('notes'),
  aiIntakeSummaryId: varchar('ai_intake_summary_id', { length: 36 }),
  appointmentNumber: varchar('appointment_number', { length: 255 }).notNull(),
  // Temporary patient access - last 6 characters of appointment number for login
  accessCode: varchar('access_code', { length: 6 }), // Last 6 chars of appointment number
  // Payment fields for patient booking payments
  paymentRequired: boolean('payment_required').notNull().default(false),
  paymentAmount: decimal('payment_amount', { precision: 12, scale: 2 }),
  paymentStatus: varchar('payment_status', { length: 20 }), // 'pending' | 'paid' | 'failed' | 'refunded'
  paymentTransactionId: varchar('payment_transaction_id', { length: 36 }), // Link to payment_transactions table
  paymentMethod: varchar('payment_method', { length: 50 }), // 'lipa_kwa_simu' | 'bank' | 'mobile_money'
  paymentDetails: text('payment_details'), // JSON string with payment method specific details
  paidAt: datetime('paid_at', { mode: 'date' }),
  // Change request fields for patient confirmation
  proposedDoctorId: varchar('proposed_doctor_id', { length: 36 }),
  proposedTimeSlotId: varchar('proposed_time_slot_id', { length: 36 }),
  changeRequestStatus: mysqlEnum('change_request_status', ['none', 'pending', 'accepted', 'rejected']).notNull().default('none'),
  changeRequestToken: varchar('change_request_token', { length: 64 }),
  changeRequestReason: text('change_request_reason'),
  changeRequestedAt: datetime('change_requested_at', { mode: 'date' }),
  changeResponseAt: datetime('change_response_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('appointment_facility_idx').on(table.facilityId),
  departmentIdx: index('appointment_department_idx').on(table.departmentId),
  doctorIdx: index('appointment_doctor_idx').on(table.doctorId),
  patientIdx: index('appointment_patient_idx').on(table.patientId),
  timeSlotIdx: index('appointment_time_slot_idx').on(table.timeSlotId),
  statusIdx: index('appointment_status_idx').on(table.status),
  appointmentNumberIdx: index('appointment_number_idx').on(table.appointmentNumber),
  accessCodeIdx: index('appointment_access_code_idx').on(table.accessCode),
  paymentStatusIdx: index('appointment_payment_status_idx').on(table.paymentStatus),
  paymentTransactionIdx: index('appointment_payment_transaction_idx').on(table.paymentTransactionId),
  changeRequestTokenIdx: index('change_request_token_idx').on(table.changeRequestToken),
}))

/**
 * AI intake summaries table - AI-generated structured patient summaries
 */
export const aiIntakeSummaries = mysqlTable('ai_intake_summaries', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  appointmentId: varchar('appointment_id', { length: 36 }).notNull(),
  rawConversation: text('raw_conversation'),
  structuredSummary: text('structured_summary').notNull(), // JSON string
  modelName: varchar('model_name', { length: 255 }).notNull(),
  tokensUsed: int('tokens_used').notNull().default(0),
  collectedVia: mysqlEnum('collected_via', ['web', 'whatsapp']).notNull().default('web'),
  status: mysqlEnum('status', ['processing', 'completed', 'failed']).notNull().default('processing'),
  errorMessage: text('error_message'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('ai_intake_facility_idx').on(table.facilityId),
  appointmentIdx: index('ai_intake_appointment_idx').on(table.appointmentId),
  statusIdx: index('ai_intake_status_idx').on(table.status),
}))

/**
 * Communication logs table - WhatsApp/SMS message tracking
 */
export const communicationLogs = mysqlTable('communication_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  appointmentId: varchar('appointment_id', { length: 36 }),
  channel: mysqlEnum('channel', ['whatsapp', 'sms']).notNull().default('whatsapp'),
  direction: mysqlEnum('direction', ['outbound', 'inbound']).notNull().default('outbound'),
  toNumber: varchar('to_number', { length: 255 }).notNull(),
  templateName: varchar('template_name', { length: 255 }),
  payload: text('payload').notNull(), // JSON string
  status: mysqlEnum('status', ['queued', 'sent', 'delivered', 'failed']).notNull().default('queued'),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  errorMessage: text('error_message'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('communication_log_facility_idx').on(table.facilityId),
  appointmentIdx: index('communication_log_appointment_idx').on(table.appointmentId),
  statusIdx: index('communication_log_status_idx').on(table.status),
}))

/**
 * Visits table - Analytics and conversion tracking
 */
export const visits = mysqlTable('visits', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  visitType: mysqlEnum('visit_type', ['standalone', 'widget']).notNull().default('standalone'),
  referrer: varchar('referrer', { length: 500 }),
  userAgent: varchar('user_agent', { length: 500 }),
  ipAddress: varchar('ip_address', { length: 100 }),
  sessionId: varchar('session_id', { length: 255 }),
  selectedDepartment: boolean('selected_department').notNull().default(false),
  selectedDoctor: boolean('selected_doctor').notNull().default(false),
  selectedTimeSlot: boolean('selected_time_slot').notNull().default(false),
  confirmedBooking: boolean('confirmed_booking').notNull().default(false),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('visit_facility_idx').on(table.facilityId),
  sessionIdx: index('visit_session_idx').on(table.sessionId),
  createdAtIdx: index('visit_created_at_idx').on(table.createdAt),
}))

/**
 * Facility feedback table - Patient feedback after appointments
 */
export const facilityFeedback = mysqlTable('facility_feedback', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  appointmentId: varchar('appointment_id', { length: 36 }), // Link to appointment
  feedbackNumber: varchar('feedback_number', { length: 255 }).notNull().unique(),
  userRole: mysqlEnum('user_role', ['patient', 'visitor', 'relative', 'caregiver']).notNull(),
  phoneNumber: varchar('phone_number', { length: 255 }),
  serviceDepartment: varchar('service_department', { length: 255 }),
  feedbackTypes: text('feedback_types').notNull(), // JSON array: ['compliment', 'suggestion', 'complaint', 'general']
  detailedFeedback: text('detailed_feedback').notNull(),
  ratings: text('ratings'), // JSON object for dynamic ratings
  // Static rating columns for backward compatibility
  overallExperience: int('overall_experience'),
  staffFriendliness: int('staff_friendliness'),
  waitTime: int('wait_time'),
  cleanliness: int('cleanliness'),
  communication: int('communication'),
  treatmentQuality: int('treatment_quality'),
  facilityComfort: int('facility_comfort'),
  // Status and management
  isAttended: boolean('is_attended').notNull().default(false),
  internalNotes: text('internal_notes'),
  attendedAt: datetime('attended_at', { mode: 'date' }),
  attendedBy: varchar('attended_by', { length: 36 }), // User ID who attended to feedback
  // Tracking
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: text('user_agent'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('feedback_facility_idx').on(table.facilityId),
  appointmentIdx: index('feedback_appointment_idx').on(table.appointmentId),
  feedbackNumberIdx: index('feedback_number_idx').on(table.feedbackNumber),
  isAttendedIdx: index('feedback_is_attended_idx').on(table.isAttended),
}))

/**
 * Relations
 */
export const usersRelations = relations(users, ({ one }) => ({
  facility: one(facilities, {
    fields: [users.facilityId],
    references: [facilities.id],
  }),
}))

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  users: many(users),
  devices: many(devices),
  payments: many(payments),
  bills: many(bills),
  serviceJobs: many(serviceJobs),
  helpRequests: many(helpRequests),
  deviceRequests: many(deviceRequests),
  serviceSubscriptions: many(serviceSubscriptions),
  equipment: many(facilityEquipment),
  maintenanceRequests: many(maintenanceRequests),
  // Booking system relations
  departments: many(departments),
  doctors: many(doctors),
  patients: many(patients),
  appointments: many(appointments),
  aiIntakeSummaries: many(aiIntakeSummaries),
  communicationLogs: many(communicationLogs),
  visits: many(visits),
  feedback: many(facilityFeedback),
  insuranceProviders: many(insuranceProviders),
  insuranceCoverages: many(insuranceCoverages),
}))

export const devicesRelations = relations(devices, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [devices.facilityId],
    references: [facilities.id],
  }),
  energyData: many(energyData),
}))

export const energyDataRelations = relations(energyData, ({ one }) => ({
  device: one(devices, {
    fields: [energyData.deviceId],
    references: [devices.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  facility: one(facilities, {
    fields: [payments.facilityId],
    references: [facilities.id],
  }),
}))

export const billsRelations = relations(bills, ({ one }) => ({
  facility: one(facilities, {
    fields: [bills.facilityId],
    references: [facilities.id],
  }),
}))

export const serviceJobsRelations = relations(serviceJobs, ({ one }) => ({
  facility: one(facilities, {
    fields: [serviceJobs.facilityId],
    references: [facilities.id],
  }),
  technician: one(users, {
    fields: [serviceJobs.technicianId],
    references: [users.id],
  }),
}))

export const helpRequestsRelations = relations(helpRequests, ({ one }) => ({
  facility: one(facilities, {
    fields: [helpRequests.facilityId],
    references: [facilities.id],
  }),
  user: one(users, {
    fields: [helpRequests.userId],
    references: [users.id],
  }),
}))

export const deviceRequestsRelations = relations(deviceRequests, ({ one }) => ({
  facility: one(facilities, {
    fields: [deviceRequests.facilityId],
    references: [facilities.id],
  }),
  user: one(users, {
    fields: [deviceRequests.userId],
    references: [users.id],
  }),
}))

/**
 * Relations for service subscriptions
 */
export const serviceSubscriptionsRelations = relations(serviceSubscriptions, ({ one }) => ({
  facility: one(facilities, {
    fields: [serviceSubscriptions.facilityId],
    references: [facilities.id],
  }),
}))

export const maintenancePlansRelations = relations(maintenancePlans, ({ many }) => ({
  facilityPlans: many(facilityMaintenancePlans),
}))

export const facilityMaintenancePlansRelations = relations(facilityMaintenancePlans, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [facilityMaintenancePlans.facilityId],
    references: [facilities.id],
  }),
  plan: one(maintenancePlans, {
    fields: [facilityMaintenancePlans.planId],
    references: [maintenancePlans.id],
  }),
  visits: many(maintenancePlanVisits),
}))

export const maintenancePlanVisitsRelations = relations(maintenancePlanVisits, ({ one }) => ({
  facilityPlan: one(facilityMaintenancePlans, {
    fields: [maintenancePlanVisits.facilityPlanId],
    references: [facilityMaintenancePlans.id],
  }),
  technician: one(technicians, {
    fields: [maintenancePlanVisits.technicianId],
    references: [technicians.id],
  }),
}))

export const maintenancePlanRequestsRelations = relations(maintenancePlanRequests, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [maintenancePlanRequests.facilityId],
    references: [facilities.id],
  }),
  technician: one(technicians, {
    fields: [maintenancePlanRequests.assignedTechnicianId],
    references: [technicians.id],
  }),
  equipment: many(maintenancePlanRequestEquipment),
  proposals: many(maintenancePlanProposals),
  payments: many(maintenancePlanPayments),
}))

export const maintenancePlanRequestEquipmentRelations = relations(maintenancePlanRequestEquipment, ({ one }) => ({
  request: one(maintenancePlanRequests, {
    fields: [maintenancePlanRequestEquipment.requestId],
    references: [maintenancePlanRequests.id],
  }),
  equipment: one(facilityEquipment, {
    fields: [maintenancePlanRequestEquipment.equipmentId],
    references: [facilityEquipment.id],
  }),
}))

export const maintenancePlanProposalsRelations = relations(maintenancePlanProposals, ({ one, many }) => ({
  request: one(maintenancePlanRequests, {
    fields: [maintenancePlanProposals.requestId],
    references: [maintenancePlanRequests.id],
  }),
  technician: one(technicians, {
    fields: [maintenancePlanProposals.technicianId],
    references: [technicians.id],
  }),
  items: many(maintenancePlanProposalItems),
  payments: many(maintenancePlanPayments),
}))

export const maintenancePlanProposalItemsRelations = relations(maintenancePlanProposalItems, ({ one }) => ({
  proposal: one(maintenancePlanProposals, {
    fields: [maintenancePlanProposalItems.proposalId],
    references: [maintenancePlanProposals.id],
  }),
  equipment: one(facilityEquipment, {
    fields: [maintenancePlanProposalItems.equipmentId],
    references: [facilityEquipment.id],
  }),
}))

export const maintenancePlanPaymentsRelations = relations(maintenancePlanPayments, ({ one }) => ({
  proposal: one(maintenancePlanProposals, {
    fields: [maintenancePlanPayments.proposalId],
    references: [maintenancePlanProposals.id],
  }),
  request: one(maintenancePlanRequests, {
    fields: [maintenancePlanPayments.requestId],
    references: [maintenancePlanRequests.id],
  }),
  facility: one(facilities, {
    fields: [maintenancePlanPayments.facilityId],
    references: [facilities.id],
  }),
}))

export const maintenancePlanStatusHistoryRelations = relations(maintenancePlanStatusHistory, ({ one }) => ({
  request: one(maintenancePlanRequests, {
    fields: [maintenancePlanStatusHistory.requestId],
    references: [maintenancePlanRequests.id],
  }),
  proposal: one(maintenancePlanProposals, {
    fields: [maintenancePlanStatusHistory.proposalId],
    references: [maintenancePlanProposals.id],
  }),
  payment: one(maintenancePlanPayments, {
    fields: [maintenancePlanStatusHistory.paymentId],
    references: [maintenancePlanPayments.id],
  }),
}))

export const regionsRelations = relations(regions, ({ many }) => ({
  districts: many(districts),
  technicians: many(technicians),
}))

export const districtsRelations = relations(districts, ({ one, many }) => ({
  region: one(regions, {
    fields: [districts.regionId],
    references: [regions.id],
  }),
  technicians: many(technicians),
}))

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  region: one(regions, {
    fields: [technicians.regionId],
    references: [regions.id],
  }),
  district: one(districts, {
    fields: [technicians.districtId],
    references: [districts.id],
  }),
  assignedRequests: many(maintenanceRequests, {
    relationName: 'technician_requests',
  }),
  quotes: many(maintenanceQuotes),
  reports: many(maintenanceReports),
}))

export const equipmentCategoriesRelations = relations(equipmentCategories, ({ many }) => ({
  equipment: many(facilityEquipment),
}))

export const facilityEquipmentRelations = relations(facilityEquipment, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [facilityEquipment.facilityId],
    references: [facilities.id],
  }),
  category: one(equipmentCategories, {
    fields: [facilityEquipment.categoryId],
    references: [equipmentCategories.id],
  }),
  maintenanceRequests: many(maintenanceRequests),
}))

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [maintenanceRequests.facilityId],
    references: [facilities.id],
  }),
  equipment: one(facilityEquipment, {
    fields: [maintenanceRequests.equipmentId],
    references: [facilityEquipment.id],
  }),
  technician: one(technicians, {
    fields: [maintenanceRequests.assignedTechnicianId],
    references: [technicians.id],
    relationName: 'technician_requests',
  }),
  quote: one(maintenanceQuotes),
  report: one(maintenanceReports),
  reviews: many(maintenanceReviews),
}))

export const maintenanceQuotesRelations = relations(maintenanceQuotes, ({ one, many }) => ({
  request: one(maintenanceRequests, {
    fields: [maintenanceQuotes.maintenanceRequestId],
    references: [maintenanceRequests.id],
  }),
  technician: one(technicians, {
    fields: [maintenanceQuotes.technicianId],
    references: [technicians.id],
  }),
  items: many(maintenanceQuoteItems),
}))

export const maintenanceQuoteItemsRelations = relations(maintenanceQuoteItems, ({ one }) => ({
  quote: one(maintenanceQuotes, {
    fields: [maintenanceQuoteItems.maintenanceQuoteId],
    references: [maintenanceQuotes.id],
  }),
}))

export const maintenanceReportsRelations = relations(maintenanceReports, ({ one }) => ({
  request: one(maintenanceRequests, {
    fields: [maintenanceReports.maintenanceRequestId],
    references: [maintenanceRequests.id],
  }),
  technician: one(technicians, {
    fields: [maintenanceReports.technicianId],
    references: [technicians.id],
  }),
}))

export const maintenanceReviewsRelations = relations(maintenanceReviews, ({ one }) => ({
  request: one(maintenanceRequests, {
    fields: [maintenanceReviews.maintenanceRequestId],
    references: [maintenanceRequests.id],
  }),
}))

/**
 * Booking System Relations
 */
export const departmentsRelations = relations(departments, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [departments.facilityId],
    references: [facilities.id],
  }),
  doctors: many(doctors),
  appointments: many(appointments),
}))

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [doctors.facilityId],
    references: [facilities.id],
  }),
  department: one(departments, {
    fields: [doctors.departmentId],
    references: [departments.id],
  }),
  timeSlots: many(doctorTimeSlots),
  appointments: many(appointments),
}))

export const doctorTimeSlotsRelations = relations(doctorTimeSlots, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [doctorTimeSlots.facilityId],
    references: [facilities.id],
  }),
  doctor: one(doctors, {
    fields: [doctorTimeSlots.doctorId],
    references: [doctors.id],
  }),
  appointments: many(appointments),
}))

export const patientsRelations = relations(patients, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [patients.facilityId],
    references: [facilities.id],
  }),
  appointments: many(appointments),
}))

export const insuranceProvidersRelations = relations(insuranceProviders, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [insuranceProviders.facilityId],
    references: [facilities.id],
  }),
  coverages: many(insuranceCoverages),
}))

export const insuranceCoveragesRelations = relations(insuranceCoverages, ({ one }) => ({
  facility: one(facilities, {
    fields: [insuranceCoverages.facilityId],
    references: [facilities.id],
  }),
  provider: one(insuranceProviders, {
    fields: [insuranceCoverages.providerId],
    references: [insuranceProviders.id],
  }),
  department: one(departments, {
    fields: [insuranceCoverages.departmentId],
    references: [departments.id],
  }),
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  facility: one(facilities, {
    fields: [appointments.facilityId],
    references: [facilities.id],
  }),
  department: one(departments, {
    fields: [appointments.departmentId],
    references: [departments.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  timeSlot: one(doctorTimeSlots, {
    fields: [appointments.timeSlotId],
    references: [doctorTimeSlots.id],
  }),
  aiIntakeSummary: one(aiIntakeSummaries, {
    fields: [appointments.aiIntakeSummaryId],
    references: [aiIntakeSummaries.id],
  }),
  feedback: one(facilityFeedback, {
    fields: [appointments.id],
    references: [facilityFeedback.appointmentId],
  }),
}))

export const aiIntakeSummariesRelations = relations(aiIntakeSummaries, ({ one }) => ({
  facility: one(facilities, {
    fields: [aiIntakeSummaries.facilityId],
    references: [facilities.id],
  }),
  appointment: one(appointments, {
    fields: [aiIntakeSummaries.appointmentId],
    references: [appointments.id],
  }),
}))

export const communicationLogsRelations = relations(communicationLogs, ({ one }) => ({
  facility: one(facilities, {
    fields: [communicationLogs.facilityId],
    references: [facilities.id],
  }),
  appointment: one(appointments, {
    fields: [communicationLogs.appointmentId],
    references: [appointments.id],
  }),
}))

export const visitsRelations = relations(visits, ({ one }) => ({
  facility: one(facilities, {
    fields: [visits.facilityId],
    references: [facilities.id],
  }),
}))

export const facilityFeedbackRelations = relations(facilityFeedback, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityFeedback.facilityId],
    references: [facilities.id],
  }),
  appointment: one(appointments, {
    fields: [facilityFeedback.appointmentId],
    references: [appointments.id],
  }),
}))

/**
 * Feature Requests table
 */
export const featureRequests = mysqlTable('feature_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  serviceName: varchar('service_name', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  priority: varchar('priority', { length: 20 }).default('medium'), // 'low' | 'medium' | 'high'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'reviewing' | 'approved' | 'in_progress' | 'completed' | 'rejected'
  adminNotes: text('admin_notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('feature_request_facility_idx').on(table.facilityId),
  serviceIdx: index('feature_request_service_idx').on(table.serviceName),
  statusIdx: index('feature_request_status_idx').on(table.status),
  facilityServiceIdx: index('feature_request_facility_service_idx').on(table.facilityId, table.serviceName),
}))

export const featureRequestRelations = relations(featureRequests, ({ one }) => ({
  facility: one(facilities, {
    fields: [featureRequests.facilityId],
    references: [facilities.id],
  }),
}))

/**
 * Facility Referrals table - tracks referral relationships
 */
export const facilityReferrals = mysqlTable('facility_referrals', {
  id: varchar('id', { length: 36 }).primaryKey(),
  referrerFacilityId: varchar('referrer_facility_id', { length: 36 }).notNull(), // Facility that made the referral
  referredFacilityId: varchar('referred_facility_id', { length: 36 }).notNull(), // Facility that was referred
  referralCode: varchar('referral_code', { length: 20 }).notNull(), // Referral code used
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'registered' | 'benefit_applied' | 'expired'
  benefitApproved: boolean('benefit_approved').notNull().default(false), // Whether admin approved the benefit
  benefitApprovedBy: varchar('benefit_approved_by', { length: 36 }), // Admin user ID who approved
  benefitApprovedAt: datetime('benefit_approved_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  referrerIdx: index('referral_referrer_idx').on(table.referrerFacilityId),
  referredIdx: index('referral_referred_idx').on(table.referredFacilityId),
  codeIdx: index('referral_code_idx').on(table.referralCode),
  statusIdx: index('referral_status_idx').on(table.status),
}))

export const facilityReferralRelations = relations(facilityReferrals, ({ one }) => ({
  referrer: one(facilities, {
    fields: [facilityReferrals.referrerFacilityId],
    references: [facilities.id],
    relationName: 'referrer',
  }),
  referred: one(facilities, {
    fields: [facilityReferrals.referredFacilityId],
    references: [facilities.id],
    relationName: 'referred',
  }),
}))

/**
 * Payment Transactions table
 * Comprehensive tracking of all payment transactions from initiation to completion
 * This is the master transaction log for all payments in the system
 */
export const paymentTransactions = mysqlTable('payment_transactions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  
  // Facility & Service Info
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  serviceName: varchar('service_name', { length: 50 }).notNull(),
  
  // Transaction Identifiers
  externalId: varchar('external_id', { length: 100 }).notNull().unique(), // Our internal reference (PAY-xxx)
  azamTransactionId: varchar('azam_transaction_id', { length: 255 }), // Azam Pay's transaction ID
  azamReference: varchar('azam_reference', { length: 255 }), // Azam Pay's reference
  mnoReference: varchar('mno_reference', { length: 255 }), // Mobile Network Operator reference
  
  // Payment Details
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  paymentType: varchar('payment_type', { length: 20 }).notNull(), // 'mobile' | 'bank'
  paymentMethod: varchar('payment_method', { length: 50 }), // 'mpesa' | 'airtel' | 'tigo' | 'halopesa' | 'crdb' | 'nmb'
  
  // Mobile Payment Details
  mobileNumber: varchar('mobile_number', { length: 20 }),
  mobileProvider: varchar('mobile_provider', { length: 50 }), // 'Mpesa' | 'Airtel' | 'Tigo' | 'Halopesa'
  
  // Bank Payment Details
  bankName: varchar('bank_name', { length: 50 }), // 'CRDB' | 'NMB'
  bankAccountNumber: varchar('bank_account_number', { length: 50 }),
  bankMobileNumber: varchar('bank_mobile_number', { length: 20 }),
  
  // Transaction Status & Flow
  status: varchar('status', { length: 30 }).notNull().default('initiated'), 
  // Status values: 'initiated' | 'pending' | 'processing' | 'awaiting_confirmation' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'refunded'
  statusMessage: text('status_message'), // Human-readable status message
  failureReason: text('failure_reason'), // Reason for failure if any
  
  // Subscription Details
  billingCycle: varchar('billing_cycle', { length: 20 }), // 'monthly' | 'yearly'
  subscriptionId: varchar('subscription_id', { length: 36 }), // Link to service_subscriptions
  
  // Azam Pay Request/Response Logs
  requestPayload: text('request_payload'), // JSON: What we sent to Azam Pay
  responsePayload: text('response_payload'), // JSON: What Azam Pay responded
  callbackPayload: text('callback_payload'), // JSON: Callback data from Azam Pay
  
  // Timestamps
  initiatedAt: datetime('initiated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  sentToProviderAt: datetime('sent_to_provider_at', { mode: 'date' }),
  customerPromptedAt: datetime('customer_prompted_at', { mode: 'date' }), // When PIN prompt sent to customer
  completedAt: datetime('completed_at', { mode: 'date' }),
  failedAt: datetime('failed_at', { mode: 'date' }),
  callbackReceivedAt: datetime('callback_received_at', { mode: 'date' }),
  expiresAt: datetime('expires_at', { mode: 'date' }), // Transaction expiry time
  
  // Audit Fields
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('pt_facility_idx').on(table.facilityId),
  serviceIdx: index('pt_service_idx').on(table.serviceName),
  externalIdIdx: index('pt_external_id_idx').on(table.externalId),
  azamTxnIdx: index('pt_azam_txn_idx').on(table.azamTransactionId),
  statusIdx: index('pt_status_idx').on(table.status),
  createdAtIdx: index('pt_created_at_idx').on(table.createdAt),
  facilityServiceIdx: index('pt_facility_service_idx').on(table.facilityId, table.serviceName),
}))

/**
 * Facility Notifications table
 * Tracks all notifications sent to facilities (dashboard, email, SMS)
 */
export const facilityNotifications = mysqlTable('facility_notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }), // Specific user if applicable
  
  // Notification Content
  type: varchar('type', { length: 50 }).notNull(), 
  // Types: 'payment_initiated' | 'payment_completed' | 'payment_failed' | 'subscription_expiring' | 'subscription_expired' | 'subscription_renewed' | 'access_restricted' | 'system'
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  actionUrl: varchar('action_url', { length: 500 }), // Link to action (e.g., payment page)
  actionLabel: varchar('action_label', { length: 100 }), // Button label
  
  // Related Entities
  serviceName: varchar('service_name', { length: 50 }), // Related service
  transactionId: varchar('transaction_id', { length: 36 }), // Related transaction
  subscriptionId: varchar('subscription_id', { length: 36 }), // Related subscription
  
  // Delivery Channels
  showInDashboard: boolean('show_in_dashboard').notNull().default(true),
  sendEmail: boolean('send_email').notNull().default(false),
  sendSms: boolean('send_sms').notNull().default(false),
  
  // Delivery Status
  emailSentAt: datetime('email_sent_at', { mode: 'date' }),
  emailError: text('email_error'),
  smsSentAt: datetime('sms_sent_at', { mode: 'date' }),
  smsError: text('sms_error'),
  
  // Read Status
  isRead: boolean('is_read').notNull().default(false),
  readAt: datetime('read_at', { mode: 'date' }),
  isDismissed: boolean('is_dismissed').notNull().default(false),
  dismissedAt: datetime('dismissed_at', { mode: 'date' }),
  
  // Priority & Expiry
  priority: varchar('priority', { length: 20 }).notNull().default('normal'), // 'low' | 'normal' | 'high' | 'urgent'
  expiresAt: datetime('expires_at', { mode: 'date' }), // Auto-dismiss after this date
  
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('fn_facility_idx').on(table.facilityId),
  userIdx: index('fn_user_idx').on(table.userId),
  typeIdx: index('fn_type_idx').on(table.type),
  isReadIdx: index('fn_is_read_idx').on(table.isRead),
  createdAtIdx: index('fn_created_at_idx').on(table.createdAt),
  facilityUnreadIdx: index('fn_facility_unread_idx').on(table.facilityId, table.isRead),
}))

/**
 * Admin Notifications table
 * Tracks all notifications sent to admin users (dashboard, email, SMS)
 */
export const adminNotifications = mysqlTable('admin_notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }), // Admin user ID if applicable
  
  // Notification Content
  type: varchar('type', { length: 50 }).notNull(), 
  // Types: 'quote_request' | 'new_order' | 'payment_issue' | 'system_alert' | 'user_registration'
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  actionUrl: varchar('action_url', { length: 500 }), // Link to action (e.g., quote details)
  actionLabel: varchar('action_label', { length: 100 }), // Button label
  
  // Related Entities
  facilityId: varchar('facility_id', { length: 36 }), // Related facility
  productId: varchar('product_id', { length: 36 }), // Related product
  serviceName: varchar('service_name', { length: 50 }), // Related service
  transactionId: varchar('transaction_id', { length: 36 }), // Related transaction
  
  // Additional Data (JSON for flexible data storage)
  metadata: json('metadata'), // Store additional details like product info, facility info, etc.
  
  // Delivery Channels
  showInDashboard: boolean('show_in_dashboard').notNull().default(true),
  sendEmail: boolean('send_email').notNull().default(false),
  sendSms: boolean('send_sms').notNull().default(false),
  
  // Delivery Status
  isRead: boolean('is_read').notNull().default(false),
  isDismissed: boolean('is_dismissed').notNull().default(false),
  readAt: datetime('read_at', { mode: 'date' }),
  dismissedAt: datetime('dismissed_at', { mode: 'date' }),
  
  // Email Delivery Status
  emailSentAt: datetime('email_sent_at', { mode: 'date' }),
  emailError: text('email_error'), // Error message if email sending failed
  
  // Priority & Expiry
  priority: varchar('priority', { length: 20 }).notNull().default('normal'), // 'low' | 'normal' | 'high' | 'urgent'
  expiresAt: datetime('expires_at', { mode: 'date' }), // Auto-dismiss after this date
  
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdx: index('an_user_idx').on(table.userId),
  typeIdx: index('an_type_idx').on(table.type),
  facilityIdx: index('an_facility_idx').on(table.facilityId),
  isReadIdx: index('an_is_read_idx').on(table.isRead),
  createdAtIdx: index('an_created_at_idx').on(table.createdAt),
  facilityUnreadIdx: index('an_facility_unread_idx').on(table.facilityId, table.isRead),
}))

/**
 * Subscription Payment History table
 * Links subscriptions to their payment transactions for renewal tracking
 */
export const subscriptionPayments = mysqlTable('subscription_payments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  subscriptionId: varchar('subscription_id', { length: 36 }).notNull(),
  transactionId: varchar('transaction_id', { length: 36 }).notNull(), // Link to payment_transactions
  
  // Payment Period
  periodStart: datetime('period_start', { mode: 'date' }).notNull(),
  periodEnd: datetime('period_end', { mode: 'date' }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(), // 'monthly' | 'yearly'
  
  // Amount
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'completed' | 'failed' | 'refunded'
  
  // Renewal Info
  isRenewal: boolean('is_renewal').notNull().default(false),
  previousPaymentId: varchar('previous_payment_id', { length: 36 }), // Previous subscription payment
  
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  subscriptionIdx: index('sp_subscription_idx').on(table.subscriptionId),
  transactionIdx: index('sp_transaction_idx').on(table.transactionId),
  statusIdx: index('sp_status_idx').on(table.status),
  periodEndIdx: index('sp_period_end_idx').on(table.periodEnd),
}))

/**
 * Transaction Status History table
 * Audit log for all status changes in a transaction
 */
export const transactionStatusHistory = mysqlTable('transaction_status_history', {
  id: varchar('id', { length: 36 }).primaryKey(),
  transactionId: varchar('transaction_id', { length: 36 }).notNull(),
  
  previousStatus: varchar('previous_status', { length: 30 }),
  newStatus: varchar('new_status', { length: 30 }).notNull(),
  statusMessage: text('status_message'),
  
  // Source of change
  changedBy: varchar('changed_by', { length: 50 }), // 'system' | 'azam_callback' | 'admin' | user_id
  sourceIp: varchar('source_ip', { length: 50 }),
  
  // Additional context
  metadata: text('metadata'), // JSON: Additional data about the change
  
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  transactionIdx: index('tsh_transaction_idx').on(table.transactionId),
  createdAtIdx: index('tsh_created_at_idx').on(table.createdAt),
}))

// Relations
export const paymentTransactionRelations = relations(paymentTransactions, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [paymentTransactions.facilityId],
    references: [facilities.id],
  }),
  statusHistory: many(transactionStatusHistory),
}))

export const facilityNotificationRelations = relations(facilityNotifications, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityNotifications.facilityId],
    references: [facilities.id],
  }),
}))

export const adminNotificationRelations = relations(adminNotifications, ({ one }) => ({
  facility: one(facilities, {
    fields: [adminNotifications.facilityId],
    references: [facilities.id],
  }),
}))

export const transactionStatusHistoryRelations = relations(transactionStatusHistory, ({ one }) => ({
  transaction: one(paymentTransactions, {
    fields: [transactionStatusHistory.transactionId],
    references: [paymentTransactions.id],
  }),
}))

/**
 * Carbon credits (solar generation offsets)
 */
export const carbonCredits = mysqlTable('carbon_credits', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deviceId: varchar('device_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  period: varchar('period', { length: 40 }).notNull(), // daily | weekly | monthly | yearly | custom | YYYY-MM, etc.
  startDate: datetime('start_date', { mode: 'date' }).notNull(),
  endDate: datetime('end_date', { mode: 'date' }).notNull(),
  energyGeneratedKwh: decimal('energy_generated_kwh', { precision: 12, scale: 2 }).notNull().default('0.00'),
  co2SavedKg: decimal('co2_saved_kg', { precision: 12, scale: 2 }).notNull().default('0.00'),
  creditsEarnedTons: decimal('credits_earned_tons', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  creditValueUsd: decimal('credit_value_usd', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalValueUsd: decimal('total_value_usd', { precision: 12, scale: 2 }).notNull().default('0.00'),
  verificationStatus: varchar('verification_status', { length: 20 }).notNull().default('pending'), // pending | verified | certified | rejected
  certificateId: varchar('certificate_id', { length: 80 }),
  verifiedAt: datetime('verified_at', { mode: 'date' }),
  verifiedBy: varchar('verified_by', { length: 255 }),
  notes: text('notes'),
  metadata: json('metadata'), // { efficiency, operatingHours, baselineEmissions, gridEmissionFactor, calculationMethod, ... }
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('cc_facility_idx').on(table.facilityId),
  deviceIdx: index('cc_device_idx').on(table.deviceId),
  statusIdx: index('cc_status_idx').on(table.verificationStatus),
  periodIdx: index('cc_period_idx').on(table.period),
  startIdx: index('cc_start_idx').on(table.startDate),
}))

/**
 * ============================================
 * FACILITY INTELLIGENCE (Assessment Cycles)
 * ============================================
 */

export const assessmentCycles = mysqlTable('assessment_cycles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  startedAt: datetime('started_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: datetime('completed_at', { mode: 'date' }),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | completed | archived
  createdBy: varchar('created_by', { length: 120 }), // user id/email
  version: varchar('version', { length: 20 }).notNull().default('2.0'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('ac_facility_idx').on(table.facilityId),
  statusIdx: index('ac_status_idx').on(table.status),
  startedIdx: index('ac_started_idx').on(table.startedAt),
}))

export const climateAssessmentResponses = mysqlTable('climate_assessment_responses', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assessmentCycleId: varchar('assessment_cycle_id', { length: 36 }).notNull(),
  moduleCode: varchar('module_code', { length: 10 }).notNull(), // HES | CSF | ECPQ | EDC | RRC
  questionCode: varchar('question_code', { length: 60 }).notNull(),
  answerValue: varchar('answer_value', { length: 60 }).notNull(),
  score: int('score').notNull().default(0),
  scoreMax: int('score_max').notNull().default(0),
  note: text('note'),
  confidence: int('confidence').default(100),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  cycleIdx: index('car_cycle_idx').on(table.assessmentCycleId),
  moduleIdx: index('car_module_idx').on(table.moduleCode),
  questionIdx: index('car_question_idx').on(table.questionCode),
}))

export const climateScoreSummaries = mysqlTable('climate_score_summaries', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assessmentCycleId: varchar('assessment_cycle_id', { length: 36 }).notNull().unique(),
  hes: int('hes').notNull().default(0),
  csf: int('csf').notNull().default(0),
  ecpq: int('ecpq').notNull().default(0),
  edc: int('edc').notNull().default(0),
  rrc: int('rrc').notNull().default(0),
  rcs: int('rcs').notNull().default(0), // 0–100 (capacity score)
  tier: int('tier').notNull().default(0),
  criticalAttention: boolean('critical_attention').notNull().default(false),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  cycleIdx: index('css_cycle_idx').on(table.assessmentCycleId),
  rcsIdx: index('css_rcs_idx').on(table.rcs),
  tierIdx: index('css_tier_idx').on(table.tier),
}))

export const riskDrivers = mysqlTable('risk_drivers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assessmentCycleId: varchar('assessment_cycle_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  riskType: varchar('risk_type', { length: 60 }).notNull(),
  severity: int('severity').notNull().default(0),
  priorityScore: int('priority_score').notNull().default(0),
  rank: int('rank').notNull().default(0),
  affectedService: varchar('affected_service', { length: 120 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  cycleIdx: index('rd_cycle_idx').on(table.assessmentCycleId),
  rankIdx: index('rd_rank_idx').on(table.rank),
}))

export const evidenceItems = mysqlTable('evidence_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assessmentCycleId: varchar('assessment_cycle_id', { length: 36 }).notNull(),
  questionCode: varchar('question_code', { length: 60 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // photo | document | url | note
  fileUrl: varchar('file_url', { length: 600 }),
  note: text('note'),
  capturedAt: datetime('captured_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  cycleIdx: index('ei_cycle_idx').on(table.assessmentCycleId),
  questionIdx: index('ei_question_idx').on(table.questionCode),
}))

export const recommendationItems = mysqlTable('recommendation_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assessmentCycleId: varchar('assessment_cycle_id', { length: 36 }).notNull(),
  moduleSource: varchar('module_source', { length: 30 }).notNull(), // energy | operations | climate | integrated
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'), // high | medium | low
  horizon: varchar('horizon', { length: 20 }).notNull().default('medium'), // immediate | medium | capital
  ownerType: varchar('owner_type', { length: 40 }), // facility | admin | technician | partner
  dueDays: int('due_days'),
  costBand: varchar('cost_band', { length: 20 }), // low | medium | high
  expectedSavings: decimal('expected_savings', { precision: 12, scale: 2 }),
  expectedResilienceGain: int('expected_resilience_gain'),
  expectedEfficiencyGain: int('expected_efficiency_gain'),
  kpi: varchar('kpi', { length: 255 }),
  evidenceRequired: boolean('evidence_required').notNull().default(false),
  explanation: text('explanation'), // what/why/evidence used
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  cycleIdx: index('ri_cycle_idx').on(table.assessmentCycleId),
  priorityIdx: index('ri_priority_idx').on(table.priority),
  horizonIdx: index('ri_horizon_idx').on(table.horizon),
}))

export const followUpTasks = mysqlTable('follow_up_tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  recommendationId: varchar('recommendation_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  ownerName: varchar('owner_name', { length: 120 }),
  dueDate: datetime('due_date', { mode: 'date' }),
  status: varchar('status', { length: 20 }).notNull().default('open'), // open | in_progress | done | cancelled
  completionNote: text('completion_note'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('fut_facility_idx').on(table.facilityId),
  recIdx: index('fut_rec_idx').on(table.recommendationId),
  statusIdx: index('fut_status_idx').on(table.status),
  dueIdx: index('fut_due_idx').on(table.dueDate),
}))

export const reportArtifacts = mysqlTable('report_artifacts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assessmentCycleId: varchar('assessment_cycle_id', { length: 36 }).notNull(),
  reportType: varchar('report_type', { length: 40 }).notNull(), // manager | investor | engineering
  fileUrl: varchar('file_url', { length: 600 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  cycleIdx: index('ra_cycle_idx').on(table.assessmentCycleId),
  typeIdx: index('ra_type_idx').on(table.reportType),
}))

/**
 * Push subscriptions table for Web Push notifications
 */
export const pushSubscriptions = mysqlTable('push_subscriptions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  userIdIdx: index('push_subscription_user_idx').on(table.userId),
}))

/**
 * ============================================
 * AFYA FINANCE SCHEMA
 * ============================================
 */

/**
 * TMDA Registered Medical Equipment and Consumables table
 * Stores all TMDA-registered medical equipment and consumables with complete information
 */
export const tmdaMedicalEquipmentConsumables = mysqlTable('tmda_medical_equipment_consumables', {
  id: varchar('id', { length: 36 }).primaryKey(),
  brandName: varchar('brand_name', { length: 255 }).notNull(),
  genericName: varchar('generic_name', { length: 255 }).notNull(),
  gmdnTerm: varchar('gmdn_term', { length: 500 }),
  intendedUse: text('intended_use'),
  localTechnicalRepresentative: varchar('local_technical_representative', { length: 255 }),
  manufacturer: varchar('manufacturer', { length: 255 }),
  // Admin-only fields for managing products
  representativeContact: varchar('representative_contact', { length: 255 }), // Phone/email
  representativePrice: decimal('representative_price', { precision: 12, scale: 2 }), // Price from representative
  // Intelligent categorization
  category: varchar('category', { length: 100 }), // Auto-categorized: 'diagnostic', 'surgical', 'monitoring', etc.
  subcategory: varchar('subcategory', { length: 100 }), // More specific categorization
  productType: varchar('product_type', { length: 50 }).notNull().default('equipment'), // 'equipment' | 'consumable'
  // Status and visibility
  isVisibleToFacilities: boolean('is_visible_to_facilities').notNull().default(false), // Admin controls visibility
  adminPrice: decimal('admin_price', { precision: 12, scale: 2 }), // Price set by admin for facilities
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  status: varchar('status', { length: 20 }).notNull().default('pending_review'), // 'pending_review' | 'active' | 'inactive' | 'discontinued'
  notes: text('notes'), // Admin notes
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  brandNameIdx: index('tmda_me_brand_name_idx').on(table.brandName),
  genericNameIdx: index('tmda_me_generic_name_idx').on(table.genericName),
  categoryIdx: index('tmda_me_category_idx').on(table.category),
  subcategoryIdx: index('tmda_me_subcategory_idx').on(table.subcategory),
  statusIdx: index('tmda_me_status_idx').on(table.status),
  visibleIdx: index('tmda_me_visible_idx').on(table.isVisibleToFacilities),
  manufacturerIdx: index('tmda_me_manufacturer_idx').on(table.manufacturer),
  productTypeIdx: index('tmda_me_product_type_idx').on(table.productType),
}))

/**
 * TMDA Registered Pharmaceutical Products table
 * Stores all TMDA-registered pharmaceutical products with complete information
 */
export const tmdaPharmaceuticalProducts = mysqlTable('tmda_pharmaceutical_products', {
  id: varchar('id', { length: 36 }).primaryKey(),
  brandName: varchar('brand_name', { length: 255 }).notNull(),
  genericName: varchar('generic_name', { length: 255 }).notNull(),
  dosageForm: varchar('dosage_form', { length: 100 }).notNull(),
  activePharmaceuticalIngredients: text('active_pharmaceutical_ingredients'),
  productStrength: varchar('product_strength', { length: 255 }),
  localTechnicalRepresentative: varchar('local_technical_representative', { length: 255 }),
  manufacturer: varchar('manufacturer', { length: 255 }),
  // Admin-only fields for managing products
  representativeContact: varchar('representative_contact', { length: 255 }), // Phone/email
  representativePrice: decimal('representative_price', { precision: 12, scale: 2 }), // Price from representative
  // Intelligent categorization
  category: varchar('category', { length: 100 }), // Auto-categorized: 'antibiotics', 'pain-relief', 'vitamins', etc.
  subcategory: varchar('subcategory', { length: 100 }), // More specific categorization
  // Status and visibility
  isVisibleToFacilities: boolean('is_visible_to_facilities').notNull().default(false), // Admin controls visibility
  adminPrice: decimal('admin_price', { precision: 12, scale: 2 }), // Price set by admin for facilities
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  status: varchar('status', { length: 20 }).notNull().default('pending_review'), // 'pending_review' | 'active' | 'inactive' | 'discontinued'
  notes: text('notes'), // Admin notes
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  brandNameIdx: index('tmda_brand_name_idx').on(table.brandName),
  genericNameIdx: index('tmda_generic_name_idx').on(table.genericName),
  categoryIdx: index('tmda_category_idx').on(table.category),
  subcategoryIdx: index('tmda_subcategory_idx').on(table.subcategory),
  statusIdx: index('tmda_status_idx').on(table.status),
  visibleIdx: index('tmda_visible_idx').on(table.isVisibleToFacilities),
  manufacturerIdx: index('tmda_manufacturer_idx').on(table.manufacturer),
}))

/**
 * Products table - Pharmaceutical, Equipment, and Consumables catalog
 * This table now links to TMDA products for pharmaceuticals
 */
export const afyaFinanceProducts = mysqlTable('afya_finance_products', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(), // 'pharmaceutical' | 'equipment' | 'consumable'
  subcategory: varchar('subcategory', { length: 100 }), // e.g., 'antibiotics', 'diagnostic-imaging'
  description: text('description'),
  manufacturer: varchar('manufacturer', { length: 255 }),
  // Link to TMDA product if it's a pharmaceutical
  tmdaProductId: varchar('tmda_product_id', { length: 36 }), // Foreign key to tmda_pharmaceutical_products
  unit: varchar('unit', { length: 50 }).notNull(), // 'unit' | 'box' | 'pack' | 'kit'
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  minOrderQuantity: int('min_order_quantity').notNull().default(1),
  maxOrderQuantity: int('max_order_quantity'),
  stockAvailable: boolean('stock_available').notNull().default(true),
  stockQuantity: int('stock_quantity'),
  imageUrl: varchar('image_url', { length: 500 }),
  specifications: text('specifications'), // JSON string
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'inactive' | 'discontinued'
  visibleToFacilities: boolean('visible_to_facilities').notNull().default(true), // Whether product is visible to facilities
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  categoryIdx: index('afp_category_idx').on(table.category),
  subcategoryIdx: index('afp_subcategory_idx').on(table.subcategory),
  statusIdx: index('afp_status_idx').on(table.status),
  nameIdx: index('afp_name_idx').on(table.name),
  tmdaProductIdx: index('afp_tmda_product_idx').on(table.tmdaProductId),
  visibleIdx: index('afp_visible_idx').on(table.visibleToFacilities),
}))

/**
 * Pools table - Group purchasing pools
 */
export const afyaFinancePools = mysqlTable('afya_finance_pools', {
  id: varchar('id', { length: 36 }).primaryKey(),
  poolNumber: varchar('pool_number', { length: 50 }).notNull().unique(), // e.g., 'POOL-OX-2401'
  productId: varchar('product_id', { length: 36 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  targetParticipants: int('target_participants').notNull(),
  currentParticipants: int('current_participants').notNull().default(0),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 20 }).notNull().default('open'), // 'open' | 'filling' | 'almost_full' | 'ready' | 'fulfilled' | 'cancelled'
  closesAt: datetime('closes_at', { mode: 'date' }).notNull(),
  deliveryHubId: varchar('delivery_hub_id', { length: 36 }), // Mini-warehouse hub ID
  deliveryRegion: varchar('delivery_region', { length: 100 }),
  createdBy: varchar('created_by', { length: 36 }), // Admin user ID
  fulfilledAt: datetime('fulfilled_at', { mode: 'date' }),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  poolNumberIdx: index('afpool_number_idx').on(table.poolNumber),
  productIdx: index('afpool_product_idx').on(table.productId),
  statusIdx: index('afpool_status_idx').on(table.status),
  closesAtIdx: index('afpool_closes_at_idx').on(table.closesAt),
  hubIdx: index('afpool_hub_idx').on(table.deliveryHubId),
}))

/**
 * Pool Participants table - Facilities participating in pools
 */
export const afyaFinancePoolParticipants = mysqlTable('afya_finance_pool_participants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  poolId: varchar('pool_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }), // 'mpesa' | 'airtel' | 'credit' | 'cash'
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'), // 'pending' | 'paid' | 'failed' | 'refunded'
  paymentTransactionId: varchar('payment_transaction_id', { length: 36 }), // Link to payment_transactions
  deliveryAddress: text('delivery_address'),
  deliveryStatus: varchar('delivery_status', { length: 20 }).notNull().default('pending'), // 'pending' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled'
  deliveredAt: datetime('delivered_at', { mode: 'date' }),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  poolIdx: index('afpp_pool_idx').on(table.poolId),
  facilityIdx: index('afpp_facility_idx').on(table.facilityId),
  paymentStatusIdx: index('afpp_payment_status_idx').on(table.paymentStatus),
  deliveryStatusIdx: index('afpp_delivery_status_idx').on(table.deliveryStatus),
  poolFacilityIdx: index('afpp_pool_facility_idx').on(table.poolId, table.facilityId),
}))

/**
 * Orders table - Individual and pool orders
 */
export const afyaFinanceOrders = mysqlTable('afya_finance_orders', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  orderType: varchar('order_type', { length: 20 }).notNull(), // 'individual' | 'pool'
  poolId: varchar('pool_id', { length: 36 }), // If orderType is 'pool'
  productId: varchar('product_id', { length: 36 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'), // 'pending' | 'paid' | 'failed' | 'refunded'
  paymentTransactionId: varchar('payment_transaction_id', { length: 36 }),
  orderStatus: varchar('order_status', { length: 20 }).notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'derived' | 'cancelled'
  deliveryAddress: text('delivery_address'),
  deliveryHubId: varchar('delivery_hub_id', { length: 36 }),
  estimatedDelivery: datetime('estimated_delivery', { mode: 'date' }),
  deliveredAt: datetime('delivered_at', { mode: 'date' }),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  orderNumberIdx: index('afo_order_number_idx').on(table.orderNumber),
  facilityIdx: index('afo_facility_idx').on(table.facilityId),
  poolIdx: index('afo_pool_idx').on(table.poolId),
  productIdx: index('afo_product_idx').on(table.productId),
  orderStatusIdx: index('afo_order_status_idx').on(table.orderStatus),
  paymentStatusIdx: index('afo_payment_status_idx').on(table.paymentStatus),
  createdAtIdx: index('afo_created_at_idx').on(table.createdAt),
}))

/**
 * Credit Applications table - Working capital financing
 */
export const afyaFinanceCreditApplications = mysqlTable('afya_finance_credit_applications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  applicationNumber: varchar('application_number', { length: 50 }).notNull().unique(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  requestedAmount: decimal('requested_amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  purpose: text('purpose'), // What the credit will be used for
  creditScore: int('credit_score'), // AI-generated credit score
  maxCreditLimit: decimal('max_credit_limit', { precision: 12, scale: 2 }),
  approvedAmount: decimal('approved_amount', { precision: 12, scale: 2 }),
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }),
  repaymentTerms: int('repayment_terms'), // Days
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'under_review' | 'approved' | 'rejected' | 'active' | 'closed'
  reviewedBy: varchar('reviewed_by', { length: 36 }), // Admin user ID
  reviewedAt: datetime('reviewed_at', { mode: 'date' }),
  rejectionReason: text('rejection_reason'),
  facilityData: text('facility_data'), // JSON: Facility financial data used for scoring
  aiScoringData: text('ai_scoring_data'), // JSON: AI scoring details
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  applicationNumberIdx: index('afca_application_number_idx').on(table.applicationNumber),
  facilityIdx: index('afca_facility_idx').on(table.facilityId),
  statusIdx: index('afca_status_idx').on(table.status),
  createdAtIdx: index('afca_created_at_idx').on(table.createdAt),
}))

/**
 * Credit Accounts table - Active credit facilities
 */
export const afyaFinanceCreditAccounts = mysqlTable('afya_finance_credit_accounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull().unique(),
  applicationId: varchar('application_id', { length: 36 }).notNull(),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).notNull(),
  availableCredit: decimal('available_credit', { precision: 12, scale: 2 }).notNull(),
  usedCredit: decimal('used_credit', { precision: 12, scale: 2 }).notNull().default('0'),
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }).notNull(),
  repaymentTerms: int('repayment_terms').notNull(), // Days
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'suspended' | 'closed'
  lastPaymentAt: datetime('last_payment_at', { mode: 'date' }),
  nextPaymentDue: datetime('next_payment_due', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('afcac_facility_idx').on(table.facilityId),
  applicationIdx: index('afcac_application_idx').on(table.applicationId),
  statusIdx: index('afcac_status_idx').on(table.status),
}))

/**
 * Emergency Requests table - P2P emergency network
 */
export const afyaFinanceEmergencyRequests = mysqlTable('afya_finance_emergency_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  requestNumber: varchar('request_number', { length: 50 }).notNull().unique(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  productId: varchar('product_id', { length: 36 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: int('quantity').notNull(),
  urgency: varchar('urgency', { length: 20 }).notNull().default('high'), // 'low' | 'medium' | 'high' | 'critical'
  status: varchar('status', { length: 20 }).notNull().default('open'), // 'open' | 'matched' | 'fulfilled' | 'cancelled' | 'expired'
  matchedFacilityId: varchar('matched_facility_id', { length: 36 }), // Facility that can fulfill
  matchedAt: datetime('matched_at', { mode: 'date' }),
  fulfilledAt: datetime('fulfilled_at', { mode: 'date' }),
  expiresAt: datetime('expires_at', { mode: 'date' }),
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  requestNumberIdx: index('afer_request_number_idx').on(table.requestNumber),
  facilityIdx: index('afer_facility_idx').on(table.facilityId),
  productIdx: index('afer_product_idx').on(table.productId),
  statusIdx: index('afer_status_idx').on(table.status),
  matchedFacilityIdx: index('afer_matched_facility_idx').on(table.matchedFacilityId),
  expiresAtIdx: index('afer_expires_at_idx').on(table.expiresAt),
}))

/**
 * Mini Warehouses table - Distribution hubs
 */
export const afyaFinanceMiniWarehouses = mysqlTable('afya_finance_mini_warehouses', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull().unique(),
  region: varchar('region', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  address: text('address').notNull(),
  capacity: int('capacity'), // Storage capacity in units
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'inactive' | 'suspended'
  approvedBy: varchar('approved_by', { length: 36 }), // Admin user ID
  approvedAt: datetime('approved_at', { mode: 'date' }),
  monthlyEarnings: decimal('monthly_earnings', { precision: 12, scale: 2 }).notNull().default('0'),
  totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('afmw_facility_idx').on(table.facilityId),
  regionIdx: index('afmw_region_idx').on(table.region),
  statusIdx: index('afmw_status_idx').on(table.status),
}))

/**
 * Inventory table - Facility inventory management
 */
export const afyaFinanceInventory = mysqlTable('afya_finance_inventory', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  productId: varchar('product_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull().default(0),
  reorderLevel: int('reorder_level').notNull().default(0),
  reorderQuantity: int('reorder_quantity'),
  lastRestockedAt: datetime('last_restocked_at', { mode: 'date' }),
  expiryDate: date('expiry_date', { mode: 'date' }),
  batchNumber: varchar('batch_number', { length: 100 }),
  location: varchar('location', { length: 255 }), // Storage location in facility
  notes: text('notes'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('afinv_facility_idx').on(table.facilityId),
  productIdx: index('afinv_product_idx').on(table.productId),
  facilityProductIdx: index('afinv_facility_product_idx').on(table.facilityId, table.productId),
  expiryDateIdx: index('afinv_expiry_date_idx').on(table.expiryDate),
}))

/**
 * Hub Requests table - Applications to become a mini-warehouse
 */
export const afyaFinanceHubRequests = mysqlTable('afya_finance_hub_requests', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  region: varchar('region', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  address: text('address').notNull(),
  storageCapacity: int('storage_capacity'),
  justification: text('justification'), // Why they want to be a hub
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: varchar('reviewed_by', { length: 36 }), // Admin user ID
  reviewedAt: datetime('reviewed_at', { mode: 'date' }),
  rejectionReason: text('rejection_reason'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('afhr_facility_idx').on(table.facilityId),
  statusIdx: index('afhr_status_idx').on(table.status),
  createdAtIdx: index('afhr_created_at_idx').on(table.createdAt),
}))

/**
 * Facility Sales - Daily sales records (facility-managed)
 */
export const afyaFinanceFacilitySales = mysqlTable('afya_finance_facility_sales', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  branchName: varchar('branch_name', { length: 255 }), // Optional branch this sale belongs to
  storeName: varchar('store_name', { length: 255 }), // Optional store this sale belongs to
  saleDate: date('sale_date', { mode: 'date' }).notNull(), // Date of sale
  productId: varchar('product_id', { length: 36 }), // Optional link to catalog product
  productName: varchar('product_name', { length: 255 }).notNull(),
  productCategory: varchar('product_category', { length: 100 }), // For filtering
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('TZS'),
  paymentMethod: varchar('payment_method', { length: 50 }), // 'cash' | 'mpesa' | 'bank' | 'credit' | 'other'
  customerNotes: varchar('customer_notes', { length: 500 }),
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 36 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('affs_facility_idx').on(table.facilityId),
  branchIdx: index('affs_branch_idx').on(table.branchName),
  storeIdx: index('affs_store_idx').on(table.storeName),
  saleDateIdx: index('affs_sale_date_idx').on(table.saleDate),
  productIdx: index('affs_product_idx').on(table.productId),
  productNameIdx: index('affs_product_name_idx').on(table.productName),
  categoryIdx: index('affs_category_idx').on(table.productCategory),
  createdAtIdx: index('affs_created_at_idx').on(table.createdAt),
}))

/**
 * ============================================
 * AFYA FINANCE RELATIONS
 * ============================================
 */
export const tmdaPharmaceuticalProductRelations = relations(tmdaPharmaceuticalProducts, ({ many }) => ({
  afyaFinanceProducts: many(afyaFinanceProducts),
}))

export const afyaFinanceProductRelations = relations(afyaFinanceProducts, ({ one, many }) => ({
  tmdaPharmaceuticalProduct: one(tmdaPharmaceuticalProducts, {
    fields: [afyaFinanceProducts.tmdaProductId],
    references: [tmdaPharmaceuticalProducts.id],
  }),
  tmdaMedicalEquipment: one(tmdaMedicalEquipmentConsumables, {
    fields: [afyaFinanceProducts.tmdaProductId],
    references: [tmdaMedicalEquipmentConsumables.id],
  }),
  pools: many(afyaFinancePools),
  orders: many(afyaFinanceOrders),
  emergencyRequests: many(afyaFinanceEmergencyRequests),
  inventory: many(afyaFinanceInventory),
}))

export const afyaFinancePoolRelations = relations(afyaFinancePools, ({ one, many }) => ({
  product: one(afyaFinanceProducts, {
    fields: [afyaFinancePools.productId],
    references: [afyaFinanceProducts.id],
  }),
  deliveryHub: one(afyaFinanceMiniWarehouses, {
    fields: [afyaFinancePools.deliveryHubId],
    references: [afyaFinanceMiniWarehouses.id],
  }),
  participants: many(afyaFinancePoolParticipants),
  orders: many(afyaFinanceOrders),
}))

export const afyaFinancePoolParticipantRelations = relations(afyaFinancePoolParticipants, ({ one }) => ({
  pool: one(afyaFinancePools, {
    fields: [afyaFinancePoolParticipants.poolId],
    references: [afyaFinancePools.id],
  }),
  facility: one(facilities, {
    fields: [afyaFinancePoolParticipants.facilityId],
    references: [facilities.id],
  }),
}))

export const afyaFinanceOrderRelations = relations(afyaFinanceOrders, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceOrders.facilityId],
    references: [facilities.id],
  }),
  product: one(afyaFinanceProducts, {
    fields: [afyaFinanceOrders.productId],
    references: [afyaFinanceProducts.id],
  }),
  pool: one(afyaFinancePools, {
    fields: [afyaFinanceOrders.poolId],
    references: [afyaFinancePools.id],
  }),
  deliveryHub: one(afyaFinanceMiniWarehouses, {
    fields: [afyaFinanceOrders.deliveryHubId],
    references: [afyaFinanceMiniWarehouses.id],
  }),
}))

export const afyaFinanceCreditApplicationRelations = relations(afyaFinanceCreditApplications, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceCreditApplications.facilityId],
    references: [facilities.id],
  }),
  creditAccount: one(afyaFinanceCreditAccounts, {
    fields: [afyaFinanceCreditApplications.id],
    references: [afyaFinanceCreditAccounts.applicationId],
  }),
}))

export const afyaFinanceCreditAccountRelations = relations(afyaFinanceCreditAccounts, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceCreditAccounts.facilityId],
    references: [facilities.id],
  }),
  application: one(afyaFinanceCreditApplications, {
    fields: [afyaFinanceCreditAccounts.applicationId],
    references: [afyaFinanceCreditApplications.id],
  }),
}))

export const afyaFinanceEmergencyRequestRelations = relations(afyaFinanceEmergencyRequests, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceEmergencyRequests.facilityId],
    references: [facilities.id],
  }),
  matchedFacility: one(facilities, {
    fields: [afyaFinanceEmergencyRequests.matchedFacilityId],
    references: [facilities.id],
    relationName: 'matched_facility',
  }),
  product: one(afyaFinanceProducts, {
    fields: [afyaFinanceEmergencyRequests.productId],
    references: [afyaFinanceProducts.id],
  }),
}))

export const afyaFinanceMiniWarehouseRelations = relations(afyaFinanceMiniWarehouses, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceMiniWarehouses.facilityId],
    references: [facilities.id],
  }),
  pools: many(afyaFinancePools),
  orders: many(afyaFinanceOrders),
}))

export const afyaFinanceInventoryRelations = relations(afyaFinanceInventory, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceInventory.facilityId],
    references: [facilities.id],
  }),
  product: one(afyaFinanceProducts, {
    fields: [afyaFinanceInventory.productId],
    references: [afyaFinanceProducts.id],
  }),
}))

export const afyaFinanceHubRequestRelations = relations(afyaFinanceHubRequests, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceHubRequests.facilityId],
    references: [facilities.id],
  }),
}))

export const afyaFinanceFacilitySalesRelations = relations(afyaFinanceFacilitySales, ({ one }) => ({
  facility: one(facilities, {
    fields: [afyaFinanceFacilitySales.facilityId],
    references: [facilities.id],
  }),
  product: one(afyaFinanceProducts, {
    fields: [afyaFinanceFacilitySales.productId],
    references: [afyaFinanceProducts.id],
  }),
}))

// Update facilities relations to include Afya Finance
export const facilitiesAfyaFinanceRelations = relations(facilities, ({ many }) => ({
  poolParticipants: many(afyaFinancePoolParticipants),
  orders: many(afyaFinanceOrders),
  creditApplications: many(afyaFinanceCreditApplications),
  creditAccount: many(afyaFinanceCreditAccounts),
  emergencyRequests: many(afyaFinanceEmergencyRequests),
  miniWarehouse: many(afyaFinanceMiniWarehouses),
  inventory: many(afyaFinanceInventory),
  hubRequests: many(afyaFinanceHubRequests),
  facilitySales: many(afyaFinanceFacilitySales),
}))


