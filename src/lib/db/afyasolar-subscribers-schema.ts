import { mysqlTable, bigint, varchar, decimal, text, tinyint, timestamp, index, json } from 'drizzle-orm/mysql-core'

// Centralized Afya Solar Subscribers Table
export const afyaSolarSubscribers = mysqlTable('afyasolar_subscribers', {
  // Primary Key
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  
  // Facility Information
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  facilityName: varchar('facility_name', { length: 255 }).notNull(),
  facilityEmail: varchar('facility_email', { length: 255 }),
  facilityPhone: varchar('facility_phone', { length: 50 }),
  facilityRegion: varchar('facility_region', { length: 100 }),
  facilityCity: varchar('facility_city', { length: 100 }),
  
  // Package Information
  packageId: varchar('package_id', { length: 20 }).notNull(),
  packageName: varchar('package_name', { length: 100 }).notNull(),
  packageCode: varchar('package_code', { length: 50 }).notNull(),
  packageRatedKw: decimal('package_rated_kw', { precision: 6, scale: 2 }).notNull(),
  packageDescription: text('package_description'),
  packageSpecs: json('package_specs'), // Store package specifications as JSON
  
  // Payment Information
  planType: varchar('plan_type', { length: 20 }).notNull(), // CASH, INSTALLMENT, PAAS
  paymentMethod: varchar('payment_method', { length: 50 }), // MNO, BANK, INVOICE, etc.
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending'), // pending, completed, failed
  isPaymentCompleted: tinyint('is_payment_completed').default(0),
  paymentCompletedAt: timestamp('payment_completed_at'),
  transactionId: varchar('transaction_id', { length: 100 }),
  
  // Pricing Information
  totalPackagePrice: decimal('total_package_price', { precision: 12, scale: 2 }).notNull(),
  upfrontPaymentAmount: decimal('upfront_payment_amount', { precision: 12, scale: 2 }),
  monthlyPaymentAmount: decimal('monthly_payment_amount', { precision: 12, scale: 2 }),
  remainingBalance: decimal('remaining_balance', { precision: 12, scale: 2 }).default('0'),
  
  // Subscription Information
  subscriptionStatus: varchar('subscription_status', { length: 20 }).default('active'), // active, expired, suspended, cancelled
  isActive: tinyint('is_active').default(1),
  subscriptionStartDate: timestamp('subscription_start_date').notNull(),
  subscriptionEndDate: timestamp('subscription_end_date'),
  nextBillingDate: timestamp('next_billing_date'),
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'), // monthly, quarterly, yearly
  gracePeriodDays: tinyint('grace_period_days').default(7),
  
  // Contract Information
  contractDurationMonths: tinyint('contract_duration_months'),
  contractStatus: varchar('contract_status', { length: 20 }).default('active'), // active, completed, terminated
  minimumTermMonths: tinyint('minimum_term_months').default(12),
  autoRenew: tinyint('auto_renew').default(1),
  
  // Service and Support
  installationStatus: varchar('installation_status', { length: 20 }).default('pending'), // pending, scheduled, completed
  installationDate: timestamp('installation_date'),
  lastMaintenanceDate: timestamp('last_maintenance_date'),
  nextMaintenanceDate: timestamp('next_maintenance_date'),
  
  // System Information
  systemStatus: varchar('system_status', { length: 20 }).default('active'), // active, inactive, maintenance
  systemHealth: varchar('system_health', { length: 20 }).default('optimal'), // optimal, warning, critical
  smartmeterSerial: varchar('smartmeter_serial', { length: 100 }),
  lastSystemCheck: timestamp('last_system_check'),
  
  // Payment History (JSON array for payment records)
  paymentHistory: json('payment_history'), // Array of payment records
  bills: json('bills'), // Array of bill records
  
  // Metadata
  metadata: json('metadata'), // Additional information as JSON
  notes: text('notes'),
  adminNotes: text('admin_notes'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  lastPaymentReminder: timestamp('last_payment_reminder'),
  
  // Indexes for performance
}, (table) => ({
  // Facility Indexes
  facilityIdIndex: index('idx_facility_id').on(table.facilityId),
  facilityNameIndex: index('idx_facility_name').on(table.facilityName),
  
  // Package Indexes
  packageIdIndex: index('idx_package_id').on(table.packageId),
  packageCodeIndex: index('idx_package_code').on(table.packageCode),
  
  // Subscription Indexes
  subscriptionStatusIndex: index('idx_subscription_status').on(table.subscriptionStatus),
  isActiveIndex: index('idx_is_active').on(table.isActive),
  nextBillingDateIndex: index('idx_next_billing_date').on(table.nextBillingDate),
  
  // Payment Indexes
  paymentStatusIndex: index('idx_payment_status').on(table.paymentStatus),
  paymentMethodIndex: index('idx_payment_method').on(table.paymentMethod),
  transactionIdIndex: index('idx_transaction_id').on(table.transactionId),
  
  // System Indexes
  systemStatusIndex: index('idx_system_status').on(table.systemStatus),
  installationStatusIndex: index('idx_installation_status').on(table.installationStatus),
  
  // Timestamp Indexes
  createdAtIndex: index('idx_created_at').on(table.createdAt),
  updatedAtIndex: index('idx_updated_at').on(table.updatedAt),
}))

// Type exports for TypeScript
export type AfyaSolarSubscriber = typeof afyaSolarSubscribers.$inferSelect
export type NewAfyaSolarSubscriber = typeof afyaSolarSubscribers.$inferInsert
