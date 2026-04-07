import { mysqlTable, varchar, decimal, datetime, boolean, int, text, index } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

/**
 * Device telemetry data from smart meters and solar equipment
 * Stores real-time energy measurements and device performance metrics
 */
export const deviceTelemetry = mysqlTable('device_telemetry', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deviceId: varchar('device_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  
  // Timestamp
  timestamp: datetime('timestamp').notNull(),
  
  // Electrical measurements
  voltage: decimal('voltage', { precision: 8, scale: 2 }), // Volts
  current: decimal('current', { precision: 8, scale: 2 }), // Amperes
  power: decimal('power', { precision: 10, scale: 2 }), // Watts
  energy: decimal('energy', { precision: 12, scale: 2 }), // kWh
  frequency: decimal('frequency', { precision: 5, scale: 2 }), // Hz
  
  // Solar specific metrics
  solarGeneration: decimal('solar_generation', { precision: 10, scale: 2 }), // kWh
  batteryLevel: decimal('battery_level', { precision: 5, scale: 2 }), // Percentage
  batteryVoltage: decimal('battery_voltage', { precision: 6, scale: 2 }), // Volts
  temperature: decimal('temperature', { precision: 5, scale: 2 }), // Celsius
  
  // System status
  gridStatus: varchar('grid_status', { length: 20 }).notNull().default('connected'), // 'connected' | 'disconnected' | 'backup'
  deviceStatus: varchar('device_status', { length: 20 }).notNull().default('normal'), // 'normal' | 'warning' | 'error' | 'maintenance'
  signalStrength: int('signal_strength'), // RSSI signal strength
  uptime: decimal('uptime', { precision: 8, scale: 2 }), // Hours
  
  // Performance metrics
  efficiency: decimal('efficiency', { precision: 5, scale: 2 }), // Percentage
  powerFactor: decimal('power_factor', { precision: 3, scale: 2 }), // Power factor
  
  // Alerts and errors
  alertCode: varchar('alert_code', { length: 50 }),
  alertMessage: text('alert_message'),
  
  // Metadata
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  location: varchar('location', { length: 100 }), // Device location within facility
  
}, (table) => ({
  // Indexes for performance
  deviceTimeIdx: index('idx_device_time').on(table.deviceId, table.timestamp),
  facilityTimeIdx: index('idx_facility_time').on(table.facilityId, table.timestamp),
  timestampIdx: index('idx_timestamp').on(table.timestamp),
  statusIdx: index('idx_status').on(table.deviceStatus),
}))

/**
 * Device health monitoring and status tracking
 * Stores aggregated health data and maintenance information
 */
export const deviceHealth = mysqlTable('device_health', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deviceId: varchar('device_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  
  // Status tracking
  onlineStatus: boolean('online_status').notNull().default(true),
  lastSeen: datetime('last_seen').notNull(),
  lastDataReceived: datetime('last_data_received'),
  
  // Performance metrics
  uptime: decimal('uptime', { precision: 8, scale: 2 }), // Total uptime hours
  downtime: decimal('downtime', { precision: 8, scale: 2 }), // Total downtime hours
  efficiency: decimal('efficiency', { precision: 5, scale: 2 }), // Current efficiency percentage
  avgEfficiency: decimal('avg_efficiency', { precision: 5, scale: 2 }), // Average efficiency
  
  // Health indicators
  batteryHealth: decimal('battery_health', { precision: 5, scale: 2 }), // Battery health percentage
  temperatureAvg: decimal('temperature_avg', { precision: 5, scale: 2 }), // Average temperature
  
  // Error tracking
  errorCount: int('error_count').notNull().default(0),
  warningCount: int('warning_count').notNull().default(0),
  lastError: text('last_error'),
  lastErrorTime: datetime('last_error_time'),
  
  // Maintenance tracking
  maintenanceDue: boolean('maintenance_due').notNull().default(false),
  lastMaintenance: datetime('last_maintenance'),
  nextMaintenanceDue: datetime('next_maintenance_due'),
  maintenanceType: varchar('maintenance_type', { length: 50 }), // 'routine' | 'emergency' | 'predictive'
  
  // Device information
  firmwareVersion: varchar('firmware_version', { length: 50 }),
  hardwareVersion: varchar('hardware_version', { length: 50 }),
  model: varchar('model', { length: 100 }),
  manufacturer: varchar('manufacturer', { length: 100 }),
  
  // Location and installation
  installDate: datetime('install_date'),
  installLocation: varchar('install_location', { length: 200 }),
  coordinates: varchar('coordinates', { length: 50 }), // GPS coordinates
  
  // Performance benchmarks
  peakPowerOutput: decimal('peak_power_output', { precision: 10, scale: 2 }), // Peak power achieved
  dailyEnergyAvg: decimal('daily_energy_avg', { precision: 10, scale: 2 }), // Average daily energy
  
  // Alerts and notifications
  alertThreshold: varchar('alert_threshold', { length: 20 }).default('normal'), // 'strict' | 'normal' | 'relaxed'
  notificationEmails: text('notification_emails'), // JSON array of emails
  
  // Metadata
  notes: text('notes'),
  tags: varchar('tags', { length: 500 }), // Comma-separated tags
  
  // Timestamps
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
  
}, (table) => ({
  // Indexes for performance
  deviceIdx: index('idx_device_health').on(table.deviceId),
  facilityIdx: index('idx_facility_health').on(table.facilityId),
  statusIdx: index('idx_online_status').on(table.onlineStatus),
  maintenanceIdx: index('idx_maintenance_due').on(table.maintenanceDue),
  lastSeenIdx: index('idx_last_seen').on(table.lastSeen),
}))

/**
 * Device alerts and notifications
 * Stores all alerts generated by devices
 */
export const deviceAlerts = mysqlTable('device_alerts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deviceId: varchar('device_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  
  // Alert details
  alertType: varchar('alert_type', { length: 50 }).notNull(), // 'error' | 'warning' | 'info' | 'maintenance'
  severity: varchar('severity', { length: 20 }).notNull(), // 'critical' | 'high' | 'medium' | 'low'
  code: varchar('code', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  
  // Alert data
  alertData: text('alert_data'), // JSON with additional alert data
  threshold: decimal('threshold', { precision: 10, scale: 2 }), // Threshold that triggered alert
  actualValue: decimal('actual_value', { precision: 10, scale: 2 }), // Actual value that triggered alert
  
  // Status tracking
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  acknowledgedBy: varchar('acknowledged_by', { length: 36 }),
  acknowledgedAt: datetime('acknowledged_at'),
  resolvedBy: varchar('resolved_by', { length: 36 }),
  resolvedAt: datetime('resolved_at'),
  resolution: text('resolution'),
  
  // Notifications
  notificationSent: boolean('notification_sent').notNull().default(false),
  notificationChannels: text('notification_channels'), // JSON array of channels used
  
  // Timestamps
  triggeredAt: datetime('triggered_at').notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
  
}, (table) => ({
  // Indexes for performance
  deviceAlertIdx: index('idx_device_alert').on(table.deviceId, table.triggeredAt),
  facilityAlertIdx: index('idx_facility_alert').on(table.facilityId, table.triggeredAt),
  statusIdx: index('idx_alert_status').on(table.status),
  severityIdx: index('idx_alert_severity').on(table.severity),
  typeIdx: index('idx_alert_type').on(table.alertType),
  triggeredIdx: index('idx_triggered_at').on(table.triggeredAt),
}))

/**
 * Device performance analytics
 * Stores aggregated performance data for analytics
 */
export const devicePerformanceAnalytics = mysqlTable('device_performance_analytics', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deviceId: varchar('device_id', { length: 36 }).notNull(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  
  // Time period
  period: varchar('period', { length: 20 }).notNull(), // 'hourly' | 'daily' | 'weekly' | 'monthly'
  periodStart: datetime('period_start').notNull(),
  periodEnd: datetime('period_end').notNull(),
  
  // Energy metrics
  totalEnergy: decimal('total_energy', { precision: 12, scale: 2 }), // Total energy generated
  solarEnergy: decimal('solar_energy', { precision: 12, scale: 2 }), // Solar energy generated
  gridEnergy: decimal('grid_energy', { precision: 12, scale: 2 }), // Grid energy consumed
  
  // Performance metrics
  avgPower: decimal('avg_power', { precision: 10, scale: 2 }), // Average power
  peakPower: decimal('peak_power', { precision: 10, scale: 2 }), // Peak power
  efficiency: decimal('efficiency', { precision: 5, scale: 2 }), // Average efficiency
  
  // Availability metrics
  uptime: decimal('uptime', { precision: 8, scale: 2 }), // Uptime in hours
  downtime: decimal('downtime', { precision: 8, scale: 2 }), // Downtime in hours
  availability: decimal('availability', { precision: 5, scale: 2 }), // Availability percentage
  
  // Environmental factors
  avgTemperature: decimal('avg_temperature', { precision: 5, scale: 2 }),
  maxTemperature: decimal('max_temperature', { precision: 5, scale: 2 }),
  minTemperature: decimal('min_temperature', { precision: 5, scale: 2 }),
  
  // Cost metrics
  costSavings: decimal('cost_savings', { precision: 12, scale: 2 }), // Estimated cost savings
  co2Avoided: decimal('co2_avoided', { precision: 12, scale: 4 }), // CO2 emissions avoided
  
  // Data quality
  dataPoints: int('data_points').notNull().default(0), // Number of data points
  dataQuality: decimal('data_quality', { precision: 3, scale: 2 }), // Data quality percentage
  
  // Timestamps
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
  
}, (table) => ({
  // Indexes for performance
  devicePeriodIdx: index('idx_device_period').on(table.deviceId, table.period, table.periodStart),
  facilityPeriodIdx: index('idx_facility_period').on(table.facilityId, table.period, table.periodStart),
  periodIdx: index('idx_period').on(table.period, table.periodStart),
}))

// Types for TypeScript
export type DeviceTelemetry = typeof deviceTelemetry.$inferInsert
export type DeviceHealth = typeof deviceHealth.$inferInsert
export type DeviceAlert = typeof deviceAlerts.$inferInsert
export type DevicePerformanceAnalytics = typeof devicePerformanceAnalytics.$inferInsert

/**
 * Contracts table
 * Stores contract information for facilities
 */
export const contracts = mysqlTable('contracts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  facilityId: varchar('facility_id', { length: 36 }).notNull(),
  contractType: varchar('contract_type', { length: 20 }).notNull(), // 'full-payment' | 'paas' | 'installment'
  startDate: datetime('start_date', { mode: 'date' }).notNull(),
  endDate: datetime('end_date', { mode: 'date' }),
  monthlyFee: decimal('monthly_fee', { precision: 12, scale: 2 }),
  depositPaid: decimal('deposit_paid', { precision: 12, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }),
  coverageScope: varchar('coverage_scope', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'expired' | 'terminated' | 'suspended'
  terms: text('terms'),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
}, (table) => ({
  facilityIdx: index('contract_facility_idx').on(table.facilityId),
  createdAtIdx: index('contract_created_at_idx').on(table.createdAt),
}))
