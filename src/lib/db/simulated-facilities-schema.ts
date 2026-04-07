import { mysqlTable, varchar, int, decimal, date, text, timestamp, index } from 'drizzle-orm/mysql-core'

export const simulatedFacilities = mysqlTable('simulated_facilities', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  region: varchar('region', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  solarStatus: varchar('solar_status', { length: 50 }).notNull().default('operational'),
  paygStatus: varchar('payg_status', { length: 50 }).notNull().default('operational'),
  installationDate: date('installation_date').notNull(),
  paygOperationalDate: date('payg_operational_date').notNull(),
  
  // Energy consumption data (kWh)
  energyConsumptionBefore: int('energy_consumption_before').notNull(),
  energyConsumptionAfter: int('energy_consumption_after').notNull(),
  monthlyEnergySavings: int('monthly_energy_savings').notNull(),
  
  // Cost data (TZS)
  electricityCostBefore: decimal('electricity_cost_before', { precision: 12, scale: 2 }).notNull(),
  electricityCostAfter: decimal('electricity_cost_after', { precision: 12, scale: 2 }).notNull(),
  monthlyCostSavings: decimal('monthly_cost_savings', { precision: 12, scale: 2 }).notNull(),
  
  // Environmental impact
  carbonEmissionReduction: int('carbon_emission_reduction').notNull(), // kg CO2 per month
  
  // System specifications
  solarCapacity: int('solar_capacity').notNull(), // kW
  batteryCapacity: int('battery_capacity').notNull(), // kWh
  smartMeterSerial: varchar('smart_meter_serial', { length: 100 }).notNull(),
  
  // Additional information
  facilityType: varchar('facility_type', { length: 100 }).notNull(),
  notes: text('notes'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
})

export type SimulatedFacility = typeof simulatedFacilities.$inferSelect
export type NewSimulatedFacility = typeof simulatedFacilities.$inferInsert

/** Monthly metrics per facility for trend charts (management panel) */
export const simulatedFacilityMonthlyMetrics = mysqlTable(
  'simulated_facility_monthly_metrics',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    facilityId: varchar('facility_id', { length: 36 }).notNull(),
    yearMonth: varchar('year_month', { length: 7 }).notNull(), // '2024-01'
    energySavings: int('energy_savings').notNull(),
    costSavings: decimal('cost_savings', { precision: 12, scale: 2 }).notNull(),
    energyConsumption: int('energy_consumption').notNull(),
    electricityCost: decimal('electricity_cost', { precision: 12, scale: 2 }).notNull(),
    carbonReduction: int('carbon_reduction').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    facilityIdx: index('sfmm_facility_idx').on(table.facilityId),
    yearMonthIdx: index('sfmm_year_month_idx').on(table.yearMonth),
    facilityMonthIdx: index('sfmm_facility_month_idx').on(table.facilityId, table.yearMonth),
  })
)

export type SimulatedFacilityMonthlyMetrics = typeof simulatedFacilityMonthlyMetrics.$inferSelect
export type NewSimulatedFacilityMonthlyMetrics = typeof simulatedFacilityMonthlyMetrics.$inferInsert

/** Simulated payments for management panel payment history */
export const simulatedPayments = mysqlTable(
  'simulated_payments',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    facilityId: varchar('facility_id', { length: 36 }).notNull(),
    facilityName: varchar('facility_name', { length: 255 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentDate: date('payment_date').notNull(),
    periodLabel: varchar('period_label', { length: 50 }).notNull(), // '2024-12' or 'December 2024'
    paymentType: varchar('payment_type', { length: 50 }).notNull().default('Monthly (PAYG)'),
    status: varchar('status', { length: 20 }).notNull().default('Completed'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    facilityIdx: index('sp_facility_idx').on(table.facilityId),
    dateIdx: index('sp_date_idx').on(table.paymentDate),
  })
)

export type SimulatedPayment = typeof simulatedPayments.$inferSelect
export type NewSimulatedPayment = typeof simulatedPayments.$inferInsert
