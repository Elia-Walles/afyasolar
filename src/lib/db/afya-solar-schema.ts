import { mysqlTable, bigint, varchar, decimal, text, tinyint, timestamp, index } from 'drizzle-orm/mysql-core'

// Afya Solar Packages
export const afyaSolarPackages = mysqlTable('afyasolar_packages', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  ratedKw: decimal('rated_kw', { precision: 6, scale: 2 }).notNull(),
  suitableFor: varchar('suitable_for', { length: 255 }),
  isActive: tinyint('is_active').notNull().default(1),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  activeIdx: index('idx_packages_active').on(table.isActive),
  ratedIdx: index('idx_packages_rated').on(table.ratedKw),
}))

// Afya Solar Package Specifications
export const afyaSolarPackageSpecs = mysqlTable('afyasolar_package_specs', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  packageId: bigint('package_id', { mode: 'number', unsigned: true }).notNull(),
  solarPanelsDesc: varchar('solar_panels_desc', { length: 255 }),
  totalCapacityKw: decimal('total_capacity_kw', { precision: 6, scale: 2 }),
  batteryKwh: decimal('battery_kwh', { precision: 8, scale: 2 }),
  inverterDesc: varchar('inverter_desc', { length: 255 }),
  dailyOutputKwhMin: decimal('daily_output_kwh_min', { precision: 8, scale: 2 }),
  dailyOutputKwhMax: decimal('daily_output_kwh_max', { precision: 8, scale: 2 }),
  backupHoursMin: decimal('backup_hours_min', { precision: 8, scale: 2 }),
  backupHoursMax: decimal('backup_hours_max', { precision: 8, scale: 2 }),
  mountingDesc: varchar('mounting_desc', { length: 255 }),
  cablingDesc: varchar('cabling_desc', { length: 255 }),
  warrantyMonths: tinyint('warranty_months').default(24),
  trainingDesc: varchar('training_desc', { length: 255 }),
  remoteMonitoringDesc: varchar('remote_monitoring_desc', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  packageIdx: index('idx_specs_package').on(table.packageId),
}))

// Afya Solar Plan Types
export const afyaSolarPlanTypes = mysqlTable('afyasolar_plan_types', {
  code: varchar('code', { length: 20 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Afya Solar Plans
export const afyaSolarPlans = mysqlTable('afyasolar_plans', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  packageId: bigint('package_id', { mode: 'number', unsigned: true }).notNull(),
  planTypeCode: varchar('plan_type_code', { length: 20 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('TZS'),
  isActive: tinyint('is_active').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  packageIdx: index('idx_plans_package').on(table.packageId),
  typeIdx: index('idx_plans_type').on(table.planTypeCode),
}))

// Afya Solar Plan Pricing
export const afyaSolarPlanPricing = mysqlTable('afyasolar_plan_pricing', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  planId: bigint('plan_id', { mode: 'number', unsigned: true }).notNull(),
  cashPrice: bigint('cash_price', { mode: 'number', unsigned: true }),
  installmentDurationMonths: tinyint('installment_duration_months', { unsigned: true }),
  defaultUpfrontPercent: decimal('default_upfront_percent', { precision: 5, scale: 2 }).default('20.00'),
  defaultMonthlyAmount: bigint('default_monthly_amount', { mode: 'number', unsigned: true }),
  eaasMonthlyFee: bigint('eaas_monthly_fee', { mode: 'number', unsigned: true }),
  eaasBillingModel: varchar('eaas_billing_model', { length: 20 }).default('FIXED_MONTHLY'),
  includesShipping: tinyint('includes_shipping').notNull().default(1),
  includesInstallation: tinyint('includes_installation').notNull().default(1),
  includesCommissioning: tinyint('includes_commissioning').notNull().default(1),
  includesMaintenance: tinyint('includes_maintenance').notNull().default(0),
  effectiveFrom: timestamp('effective_from'),
  effectiveTo: timestamp('effective_to'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  planIdx: index('idx_pricing_plan').on(table.planId),
  effectiveIdx: index('idx_pricing_effective').on(table.effectiveFrom, table.effectiveTo),
}))

// Afya Solar Client Services
export const afyaSolarClientServices = mysqlTable('afyasolar_client_services', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  packageId: bigint('package_id', { mode: 'number', unsigned: true }).notNull(),
  planId: bigint('plan_id', { mode: 'number', unsigned: true }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('PENDING_INSTALL'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  siteName: varchar('site_name', { length: 150 }),
  serviceLocation: varchar('service_location', { length: 255 }),
  smartmeterId: bigint('smartmeter_id', { mode: 'number', unsigned: true }),
  autoSuspendEnabled: tinyint('auto_suspend_enabled').notNull().default(1),
  graceDays: tinyint('grace_days', { unsigned: true }).notNull().default(7),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  facilityIdx: index('idx_service_facility').on(table.facilityId),
  statusIdx: index('idx_service_status').on(table.status),
  packageIdx: index('idx_service_package').on(table.packageId),
  planIdx: index('idx_service_plan').on(table.planId),
}))

// Afya Solar Service Status History
export const afyaSolarServiceStatusHistory = mysqlTable('afyasolar_service_status_history', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  clientServiceId: bigint('client_service_id', { mode: 'number', unsigned: true }).notNull(),
  oldStatus: varchar('old_status', { length: 30 }).notNull(),
  newStatus: varchar('new_status', { length: 30 }).notNull(),
  reasonCode: varchar('reason_code', { length: 30 }).notNull(),
  reasonText: varchar('reason_text', { length: 255 }),
  changedByUserId: varchar('changed_by_user_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  serviceIdx: index('idx_hist_service').on(table.clientServiceId),
  createdIdx: index('idx_hist_created').on(table.createdAt),
}))

// Afya Solar Installment Contracts
export const afyaSolarInstallmentContracts = mysqlTable('afyasolar_installment_contracts', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  clientServiceId: bigint('client_service_id', { mode: 'number', unsigned: true }).notNull().unique(),
  contractTotalPrice: bigint('contract_total_price', { mode: 'number', unsigned: true }).notNull(),
  durationMonths: tinyint('duration_months', { unsigned: true }).notNull(),
  upfrontAmountAgreed: bigint('upfront_amount_agreed', { mode: 'number', unsigned: true }).notNull(),
  upfrontDueDate: timestamp('upfront_due_date'),
  balanceAmount: bigint('balance_amount', { mode: 'number', unsigned: true }).notNull(),
  monthlyAmount: bigint('monthly_amount', { mode: 'number', unsigned: true }).notNull(),
  roundingAdjustment: bigint('rounding_adjustment', { mode: 'number', unsigned: true }).default(0),
  contractStatus: varchar('contract_status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  serviceIdx: index('idx_contract_service').on(table.clientServiceId),
  statusIdx: index('idx_contract_status').on(table.contractStatus),
}))

// Afya Solar Installment Schedule
export const afyaSolarInstallmentSchedule = mysqlTable('afyasolar_installment_schedule', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  installmentContractId: bigint('installment_contract_id', { mode: 'number', unsigned: true }).notNull(),
  periodNo: tinyint('period_no', { unsigned: true }).notNull(),
  dueDate: timestamp('due_date').notNull(),
  amountDue: bigint('amount_due', { mode: 'number', unsigned: true }).notNull(),
  invoiceId: bigint('invoice_id', { mode: 'number', unsigned: true }),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  contractIdx: index('idx_sched_contract').on(table.installmentContractId),
  dueIdx: index('idx_sched_due').on(table.dueDate, table.status),
}))

// Afya Solar EAAS Contracts
export const afyaSolarEaasContracts = mysqlTable('afyasolar_eaas_contracts', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  clientServiceId: bigint('client_service_id', { mode: 'number', unsigned: true }).notNull().unique(),
  billingModel: varchar('billing_model', { length: 20 }).notNull().default('FIXED_MONTHLY'),
  monthlyFee: bigint('monthly_fee', { mode: 'number', unsigned: true }).notNull(),
  minimumTermMonths: tinyint('minimum_term_months', { unsigned: true }),
  contractStatus: varchar('contract_status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  serviceIdx: index('idx_eaas_service').on(table.clientServiceId),
  statusIdx: index('idx_eaas_status').on(table.contractStatus),
}))

// Afya Solar Smart Meters
export const afyaSolarSmartmeters = mysqlTable('afyasolar_smartmeters', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  meterSerial: varchar('meter_serial', { length: 80 }).notNull().unique(),
  vendor: varchar('vendor', { length: 80 }),
  apiEndpoint: varchar('api_endpoint', { length: 255 }),
  siteAddress: varchar('site_address', { length: 255 }),
  installedAt: timestamp('installed_at'),
  lastSeenAt: timestamp('last_seen_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
}, (table) => ({
  serialIdx: index('idx_meter_serial').on(table.meterSerial),
  vendorIdx: index('idx_meter_vendor').on(table.vendor),
}))

// Afya Solar Meter Commands
export const afyaSolarMeterCommands = mysqlTable('afyasolar_meter_commands', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  smartmeterId: bigint('smartmeter_id', { mode: 'number', unsigned: true }).notNull(),
  clientServiceId: bigint('client_service_id', { mode: 'number', unsigned: true }).notNull(),
  commandType: varchar('command_type', { length: 20 }).notNull(),
  requestedByUserId: varchar('requested_by_user_id', { length: 36 }),
  requestedReasonCode: varchar('requested_reason_code', { length: 30 }).notNull(),
  requestedReasonText: varchar('requested_reason_text', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('QUEUED'),
  vendorRequestId: varchar('vendor_request_id', { length: 120 }),
  sentAt: timestamp('sent_at'),
  ackedAt: timestamp('acked_at'),
  errorMessage: varchar('error_message', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  statusIdx: index('idx_cmd_status').on(table.status, table.createdAt),
  meterIdx: index('idx_cmd_meter').on(table.smartmeterId),
  serviceIdx: index('idx_cmd_service').on(table.clientServiceId),
}))

// Afya Solar Service Plan Changes
export const afyaSolarServicePlanChanges = mysqlTable('afyasolar_service_plan_changes', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  clientServiceId: bigint('client_service_id', { mode: 'number', unsigned: true }).notNull(),
  fromPlanId: bigint('from_plan_id', { mode: 'number', unsigned: true }).notNull(),
  toPlanId: bigint('to_plan_id', { mode: 'number', unsigned: true }).notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  reason: varchar('reason', { length: 255 }),
  changedByUserId: varchar('changed_by_user_id', { length: 36 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  serviceIdx: index('idx_plan_change_service').on(table.clientServiceId, table.effectiveDate),
  fromIdx: index('idx_plan_change_from').on(table.fromPlanId),
  toIdx: index('idx_plan_change_to').on(table.toPlanId),
}))

// Afya Solar Design Reports (per-facility sizing & finance assessments)
export const afyaSolarDesignReports = mysqlTable('afyasolar_design_reports', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  facilityId: varchar('facility_id', { length: 36 }),
  facilityName: varchar('facility_name', { length: 150 }),
  // Key technical & financial metrics for quick admin overview
  pvSizeKw: decimal('pv_size_kw', { precision: 8, scale: 2 }),
  batteryKwh: decimal('battery_kwh', { precision: 10, scale: 2 }),
  grossMonthlySavings: bigint('gross_monthly_savings', { mode: 'number' }),
  // Optional detailed metrics (mirroring the report structure)
  totalDailyEnergyKwh: decimal('total_daily_energy_kwh', { precision: 10, scale: 2 }),
  criticalEnergyKwh: decimal('critical_energy_kwh', { precision: 10, scale: 2 }),
  adjustedDailyEnergyKwh: decimal('adjusted_daily_energy_kwh', { precision: 10, scale: 2 }),
  numPanels: bigint('num_panels', { mode: 'number', unsigned: true }),
  batteryAh: decimal('battery_ah', { precision: 12, scale: 2 }),
  inverterKw: decimal('inverter_kw', { precision: 8, scale: 2 }),
  mpptCurrentA: decimal('mppt_current_a', { precision: 10, scale: 2 }),
  baselineGridMonthly: bigint('baseline_grid_monthly', { mode: 'number' }),
  baselineDieselMonthly: bigint('baseline_diesel_monthly', { mode: 'number' }),
  baselineTotalMonthly: bigint('baseline_total_monthly', { mode: 'number' }),
  afterGridMonthly: bigint('after_grid_monthly', { mode: 'number' }),
  afterDieselMonthly: bigint('after_diesel_monthly', { mode: 'number' }),
  afterTotalMonthly: bigint('after_total_monthly', { mode: 'number' }),
  cashPriceTzs: bigint('cash_price_tzs', { mode: 'number' }),
  cashPaybackMonths: decimal('cash_payback_months', { precision: 10, scale: 2 }),
  installmentUpfrontTzs: bigint('installment_upfront_tzs', { mode: 'number' }),
  installmentMonthlyTzs: bigint('installment_monthly_tzs', { mode: 'number' }),
  installmentTermMonths: bigint('installment_term_months', { mode: 'number' }),
  installmentNetSavingsTzs: bigint('installment_net_savings_tzs', { mode: 'number' }),
  installmentBreakevenMonths: decimal('installment_breakeven_months', { precision: 10, scale: 2 }),
  eaasMonthlyTzs: bigint('eaas_monthly_tzs', { mode: 'number' }),
  eaasTermMonths: bigint('eaas_term_months', { mode: 'number' }),
  eaasNetSavingsTzs: bigint('eaas_net_savings_tzs', { mode: 'number' }),
  meuTotalDailyLoadKwh: decimal('meu_total_daily_load_kwh', { precision: 10, scale: 2 }),
  // Full engine result + inputs as JSON string
  payloadJson: text('payload_json'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  facilityIdx: index('idx_design_reports_facility').on(table.facilityId, table.createdAt),
  createdIdx: index('idx_design_reports_created').on(table.createdAt),
}))

