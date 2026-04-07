import { z } from 'zod'

/**
 * Schema for validating incoming telemetry data from devices
 */
export const telemetrySchema = z.object({
  // Device identification
  deviceId: z.string().uuid('Invalid device ID format'),
  
  // Timestamp
  timestamp: z.string().datetime('Invalid timestamp format'),
  
  // Electrical measurements (optional as not all devices provide all metrics)
  voltage: z.number().min(0).max(500).optional(),
  current: z.number().min(0).max(100).optional(),
  power: z.number().min(0).optional(),
  energy: z.number().min(0).optional(),
  frequency: z.number().min(45).max(65).optional(),
  
  // Solar specific metrics
  solarGeneration: z.number().min(0).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  batteryVoltage: z.number().min(0).max(50).optional(),
  temperature: z.number().min(-20).max(80).optional(),
  
  // System status
  gridStatus: z.enum(['connected', 'disconnected', 'backup', 'unknown']).optional(),
  deviceStatus: z.enum(['normal', 'warning', 'error', 'maintenance', 'offline']).optional(),
  signalStrength: z.number().min(-120).max(0).optional(), // RSSI in dBm
  uptime: z.number().min(0).optional(),
  
  // Performance metrics
  efficiency: z.number().min(0).max(100).optional(),
  powerFactor: z.number().min(-1).max(1).optional(),
  
  // Alerts and errors
  alertCode: z.string().max(50).optional(),
  alertMessage: z.string().max(500).optional(),
  
  // Metadata
  firmwareVersion: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
})

/**
 * Schema for device health updates
 */
export const deviceHealthSchema = z.object({
  deviceId: z.string().uuid(),
  onlineStatus: z.boolean(),
  lastSeen: z.string().datetime(),
  efficiency: z.number().min(0).max(100).optional(),
  batteryHealth: z.number().min(0).max(100).optional(),
  temperatureAvg: z.number().min(-20).max(80).optional(),
  errorCount: z.number().min(0).optional(),
  warningCount: z.number().min(0).optional(),
  maintenanceDue: z.boolean().optional(),
  firmwareVersion: z.string().max(50).optional(),
})

/**
 * Schema for device alerts
 */
export const deviceAlertSchema = z.object({
  deviceId: z.string().uuid(),
  facilityId: z.string().uuid(),
  alertType: z.enum(['error', 'warning', 'info', 'maintenance']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  threshold: z.number().optional(),
  actualValue: z.number().optional(),
  alertData: z.string().optional(), // JSON string
})

/**
 * Schema for device performance analytics
 */
export const performanceAnalyticsSchema = z.object({
  deviceId: z.string().uuid(),
  facilityId: z.string().uuid(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalEnergy: z.number().min(0).optional(),
  solarEnergy: z.number().min(0).optional(),
  gridEnergy: z.number().min(0).optional(),
  avgPower: z.number().min(0).optional(),
  peakPower: z.number().min(0).optional(),
  efficiency: z.number().min(0).max(100).optional(),
  uptime: z.number().min(0).optional(),
  downtime: z.number().min(0).optional(),
  availability: z.number().min(0).max(100).optional(),
  avgTemperature: z.number().min(-20).max(80).optional(),
  maxTemperature: z.number().min(-20).max(80).optional(),
  minTemperature: z.number().min(-20).max(80).optional(),
  costSavings: z.number().min(0).optional(),
  co2Avoided: z.number().min(0).optional(),
  dataPoints: z.number().min(0).optional(),
  dataQuality: z.number().min(0).max(100).optional(),
})

/**
 * Schema for telemetry query parameters
 */
export const telemetryQuerySchema = z.object({
  deviceId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  deviceStatus: z.enum(['normal', 'warning', 'error', 'maintenance', 'offline']).optional(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
})

/**
 * Schema for device registration/claiming
 */
export const deviceRegistrationSchema = z.object({
  serialNumber: z.string().min(5).max(50),
  deviceType: z.enum(['eyedro', 'afyasolar', 'generic', 'smart_meter']),
  model: z.string().min(1).max(100).optional(),
  manufacturer: z.string().min(1).max(100).optional(),
  firmwareVersion: z.string().max(50).optional(),
  installLocation: z.string().max(200).optional(),
  coordinates: z.string().max(50).optional(), // GPS coordinates
  facilityId: z.string().uuid().optional(),
})

// Export types for use in components
export type TelemetryData = z.infer<typeof telemetrySchema>
export type DeviceHealthData = z.infer<typeof deviceHealthSchema>
export type DeviceAlertData = z.infer<typeof deviceAlertSchema>
export type PerformanceAnalyticsData = z.infer<typeof performanceAnalyticsSchema>
export type TelemetryQueryParams = z.infer<typeof telemetryQuerySchema>
export type DeviceRegistrationData = z.infer<typeof deviceRegistrationSchema>
