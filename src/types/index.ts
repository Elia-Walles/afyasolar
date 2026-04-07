/**
 * User roles in the system
 */
export type UserRole = 'facility' | 'admin' | 'technician' | 'onboarding' | 'investor'

/**
 * Power status types
 */
export type PowerStatus = 'connected' | 'disconnected' | 'warning'

/**
 * Device types
 */
export type DeviceType = 'eyedro' | 'afyasolar' | 'generic'

/**
 * Payment methods
 */
export type PaymentMethod = 'mpesa' | 'airtel' | 'mixx' | 'bank' | 'card' | 'wallet' // mixx = Mixx by Yas (formerly Tigo Pesa)

/**
 * Payment models
 */
export type PaymentModel = 'payg' | 'installment' | 'subscription'

/**
 * Facility status
 */
export type FacilityStatus = 'active' | 'inactive' | 'low_credit' | 'suspended'

/**
 * Job priority
 */
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Job status
 */
export type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

/**
 * User interface
 */
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  facilityId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Facility interface
 */
export interface Facility {
  id: string
  name: string
  address: string
  city: string
  region: string
  phone: string
  email?: string
  status: FacilityStatus
  paymentModel: PaymentModel
  creditBalance: number
  monthlyConsumption: number
  systemSize?: string
  bookingSlug?: string | null
  isBookingEnabled?: boolean | null
  bookingWhatsappNumber?: string | null
  bookingTimezone?: string | null
  bookingSettings?: string | null
  smsSenderId?: string | null
  logoUrl?: string | null
  category?: 'Dispensary' | 'Pharmacy' | 'DMDL' | 'Laboratory' | 'Polyclinic' | 'Specialized Polyclinic' | 'Health Center' | 'Hospital' | 'District Hospital' | 'Regional Hospital'
  latitude?: number | null
  longitude?: number | null
  referralCode?: string | null
  referredBy?: string | null
  referralBenefitApplied?: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Device interface
 */
export interface Device {
  id: string
  serialNumber: string
  type: DeviceType
  facilityId: string
  sensorSize: number
  ports: number
  mode: string
  status: 'active' | 'inactive' | 'maintenance'
  lastUpdate?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Energy data interface
 */
export interface EnergyData {
  id: string
  deviceId: string
  timestamp: Date
  voltage: number
  current: number
  power: number
  energy: number
  creditBalance: number
  batteryLevel?: number
  solarGeneration?: number
  gridStatus: PowerStatus
  criticalLoad: boolean
}

/**
 * Payment interface
 */
export interface Payment {
  id: string
  facilityId: string
  amount: number
  method: PaymentMethod
  status: 'pending' | 'completed' | 'failed'
  transactionId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Bill interface
 */
export interface Bill {
  id: string
  facilityId: string
  periodStart: Date
  periodEnd: Date
  totalConsumption: number
  totalCost: number
  status: 'pending' | 'paid' | 'overdue'
  dueDate: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Service job interface
 */
export interface ServiceJob {
  id: string
  facilityId: string
  technicianId?: string
  type: 'installation' | 'maintenance' | 'repair' | 'inspection'
  priority: JobPriority
  status: JobStatus
  description: string
  scheduledDate?: Date
  completedDate?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Carbon credit data
 */
export interface CarbonData {
  co2AvoidedToday: number
  co2AvoidedMonth: number
  co2AvoidedYear: number
  co2AvoidedLifetime: number
  carbonCreditsEarned: number
  carbonCreditValue: number
  treesEquivalent: number
}

/**
 * Live energy data
 */
export interface LiveEnergyData {
  currentUsage: number
  todayTotal: number
  projectedConsumption: number
  projectionPercent: number
  currentRate: number
  maxDemand: number
  maxDemandTime: string
  creditBalance: number
  solarGeneration?: number
  batteryLevel?: number
  costToDate: number
  billPeriod: string
  lastUpdate: string
  gridCost: number
  solarCost: number
  totalSavings: number
  savingsPercent: number
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

