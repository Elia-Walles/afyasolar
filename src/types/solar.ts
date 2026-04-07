// Shared types for Afya Solar telemetry components

export interface Device {
  id: string
  serialNumber: string
  type: string
  facilityId: string
}

export interface DeviceHealth {
  id: string
  deviceId: string
  facilityId: string
  onlineStatus: boolean
  lastSeen: string
  lastDataReceived?: string
  uptimeHours?: number
  downtimeHours?: number
  efficiency?: number
  avgEfficiency?: number
  batteryHealth?: number
  temperatureAvg?: number
  errorCount: number
  warningCount: number
  lastError?: string
  lastErrorTime?: string
  maintenanceDue: boolean
  lastMaintenance?: string
  nextMaintenanceDue?: string
  maintenanceType?: string
  firmwareVersion?: string
  hardwareVersion?: string
  model?: string
  manufacturer?: string
  installDate?: string
  installLocation?: string
  coordinates?: string
  peakPowerOutput?: number
  dailyEnergyAvg?: number
  alertThreshold: string
  notificationEmails?: string
  notes?: string
  tags?: string
  createdAt: string
  updatedAt: string
}

export interface DeviceAlert {
  id: string
  deviceId: string
  facilityId: string
  alertType: string
  severity: string
  code: string
  title: string
  message: string
  alertData?: string
  thresholdValue?: number
  actualValue?: number
  status: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
  notificationSent: boolean
  notificationChannels?: string
  triggeredAt: string
  createdAt: string
  updatedAt: string
}

export interface DeviceWithHealth extends Device {
  onlineStatus: boolean
  health: DeviceHealth | null
  alerts: DeviceAlert[]
  deviceStatus: string
  lastSeen: string | null
  uptime: string
  efficiency: string | null
  activeAlerts: number
  maintenanceDue: boolean
  batteryHealth: string | null
}

export interface FacilityHealthSummary {
  facilityId: string
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  devicesWithIssues: number
  maintenanceDue: number
  devices: DeviceWithHealth[]
  criticalAlerts: DeviceAlert[]
  summary: {
    overallStatus: string
    healthScore: number
    uptime: number
    avgEfficiency: number
    lastUpdated: string
  }
}

export interface TelemetryData {
  id: string
  deviceId: string
  facilityId: string
  timestamp: string
  voltage?: number
  current?: number
  power?: number
  energyConsumed?: number
  frequency?: number
  solarGeneration?: number
  batteryLevel?: number
  batteryVoltage?: number
  temperature?: number
  gridStatus: string
  deviceStatus: string
  signalStrength?: number
  uptime?: number
  efficiency?: number
  powerFactor?: number
  alertCode?: string
  alertMessage?: string
  firmwareVersion?: string
  location?: string
}

export interface PerformanceMetrics {
  avgPower: number
  peakPower: number
  avgEfficiency: number
  totalEnergy: number
  avgBatteryLevel: number
  avgTemperature: number
  dataPoints: number
}
