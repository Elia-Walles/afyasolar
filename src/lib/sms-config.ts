/**
 * SMS Configuration Management
 * Centralized configuration for SMS settings, rate limiting, and sender IDs
 */

export interface SMSRateLimit {
  perMinute: number
  perHour: number
  perDay: number
}

export interface SMSSenderConfig {
  id: string
  name: string
  description: string
  category: string[]
  isActive: boolean
  maxRetries: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface SMSConfig {
  enabled: boolean
  environment: 'development' | 'staging' | 'production'
  rateLimit: SMSRateLimit
  senderIds: Record<string, SMSSenderConfig>
  defaultSenderId: string
  apiEndpoint: string
  apiKey: string
  timeout: number
  retryDelay: number
  maxRetries: number
  enableQueue: boolean
  queueProcessInterval: number
  enableLogging: boolean
  enableAnalytics: boolean
  enableTemplates: boolean
  timeZone: string
  businessHours: {
    start: string
    end: string
    days: number[] // 0-6 (Sunday-Saturday)
  }
  respectBusinessHours: boolean
  enableOptOut: boolean
  optOutKeyword: string
  helpKeyword: string
  stopKeyword: string
}

// Default configuration
export const defaultSMSConfig: SMSConfig = {
  enabled: process.env.SMS_ENABLED === 'true',
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  rateLimit: {
    perMinute: parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '10'),
    perHour: parseInt(process.env.SMS_RATE_LIMIT_PER_HOUR || '100'),
    perDay: parseInt(process.env.SMS_RATE_LIMIT_PER_DAY || '1000')
  },
  senderIds: {
    default: {
      id: 'default',
      name: 'Afyalink',
      description: 'Default sender ID for all notifications',
      category: ['general', 'system'],
      isActive: true,
      maxRetries: 3,
      priority: 'medium'
    },
    maintenance: {
      id: 'maintenance',
      name: 'AfyaFix',
      description: 'Sender ID for maintenance notifications',
      category: ['maintenance'],
      isActive: true,
      maxRetries: 3,
      priority: 'medium'
    },
    finance: {
      id: 'finance',
      name: 'AfyaFinance',
      description: 'Sender ID for finance notifications',
      category: ['finance', 'payment'],
      isActive: true,
      maxRetries: 3,
      priority: 'medium'
    },
    solar: {
      id: 'solar',
      name: 'AfyaSolar',
      description: 'Sender ID for solar notifications',
      category: ['solar'],
      isActive: true,
      maxRetries: 3,
      priority: 'medium'
    },
    booking: {
      id: 'booking',
      name: 'AfyaBook',
      description: 'Sender ID for booking notifications',
      category: ['booking'],
      isActive: true,
      maxRetries: 3,
      priority: 'medium'
    },
    emergency: {
      id: 'emergency',
      name: 'AfyaAlert',
      description: 'Sender ID for emergency notifications',
      category: ['system', 'emergency'],
      isActive: true,
      maxRetries: 5,
      priority: 'critical'
    }
  },
  defaultSenderId: 'default',
  apiEndpoint: process.env.SMARTSMS_API_ENDPOINT || 'https://smartsms.ipab.co.tz/api/v3/sms/send',
  apiKey: process.env.SMARTSMS_API_KEY || '',
  timeout: parseInt(process.env.SMS_TIMEOUT || '30000'),
  retryDelay: parseInt(process.env.SMS_RETRY_DELAY || '1000'),
  maxRetries: parseInt(process.env.SMS_MAX_RETRIES || '3'),
  enableQueue: process.env.SMS_ENABLE_QUEUE === 'true',
  queueProcessInterval: parseInt(process.env.SMS_QUEUE_INTERVAL || '30000'),
  enableLogging: process.env.SMS_ENABLE_LOGGING !== 'false',
  enableAnalytics: process.env.SMS_ENABLE_ANALYTICS === 'true',
  enableTemplates: process.env.SMS_ENABLE_TEMPLATES !== 'false',
  timeZone: process.env.SMS_TIME_ZONE || 'Africa/Dar_es_Salaam',
  businessHours: {
    start: process.env.SMS_BUSINESS_HOURS_START || '08:00',
    end: process.env.SMS_BUSINESS_HOURS_END || '18:00',
    days: JSON.parse(process.env.SMS_BUSINESS_DAYS || '[1,2,3,4,5]'), // Monday-Friday
  },
  respectBusinessHours: process.env.SMS_RESPECT_BUSINESS_HOURS === 'true',
  enableOptOut: process.env.SMS_ENABLE_OPT_OUT !== 'false',
  optOutKeyword: process.env.SMS_OPT_OUT_KEYWORD || 'STOP',
  helpKeyword: process.env.SMS_HELP_KEYWORD || 'HELP',
  stopKeyword: process.env.SMS_STOP_KEYWORD || 'CANCEL'
}

/**
 * SMS Configuration Manager
 */
export class SMSConfigManager {
  private static instance: SMSConfigManager
  private config: SMSConfig

  static getInstance(): SMSConfigManager {
    if (!SMSConfigManager.instance) {
      SMSConfigManager.instance = new SMSConfigManager()
    }
    return SMSConfigManager.instance
  }

  constructor() {
    this.config = { ...defaultSMSConfig }
  }

  /**
   * Get current configuration
   */
  getConfig(): SMSConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SMSConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Get sender ID for category
   */
  getSenderIdForCategory(category: string): string {
    for (const [id, senderConfig] of Object.entries(this.config.senderIds)) {
      if (senderConfig.isActive && senderConfig.category.includes(category)) {
        return id
      }
    }
    return this.config.defaultSenderId
  }

  /**
   * Get sender config by ID
   */
  getSenderConfig(senderId: string): SMSSenderConfig | undefined {
    return this.config.senderIds[senderId]
  }

  /**
   * Check if SMS is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.apiKey.length > 0
  }

  /**
   * Check if current time is within business hours
   */
  isWithinBusinessHours(): boolean {
    if (!this.config.respectBusinessHours) {
      return true
    }

    const now = new Date()
    const timeZone = this.config.timeZone
    
    // Get current time in specified timezone
    const currentTime = new Date(now.toLocaleString('en-US', { timeZone }))
    const currentHour = currentTime.getHours()
    const currentMinute = currentTime.getMinutes()
    const currentDay = currentTime.getDay()
    
    const [startHour, startMinute] = this.config.businessHours.start.split(':').map(Number)
    const [endHour, endMinute] = this.config.businessHours.end.split(':').map(Number)
    
    const currentMinutes = currentHour * 60 + currentMinute
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    const isWithinTime = currentMinutes >= startMinutes && currentMinutes <= endMinutes
    const isWithinDay = this.config.businessHours.days.includes(currentDay)
    
    return isWithinTime && isWithinDay
  }

  /**
   * Check if rate limit allows sending SMS
   */
  async checkRateLimit(recipient: string, category: string = 'general'): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.config.enabled) {
      return { allowed: false, reason: 'SMS disabled' }
    }

    // In a real implementation, check against Redis or database
    // For now, return allowed
    return { allowed: true }
  }

  /**
   * Get retry delay for attempt number
   */
  getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 1000 // Add up to 1 second jitter
    return Math.min(exponentialDelay + jitter, 30000) // Max 30 seconds
  }

  /**
   * Validate phone number for Tanzania
   */
  validatePhoneNumber(phone: string): { valid: boolean; normalized?: string; error?: string } {
    const digits = phone.replace(/\D/g, '')
    
    if (digits.length === 0) {
      return { valid: false, error: 'Empty phone number' }
    }

    let normalized: string
    if (digits.startsWith('255') && digits.length === 12) {
      normalized = digits
    } else if (digits.startsWith('255') && digits.length > 12) {
      normalized = digits.slice(0, 12)
    } else if (digits.startsWith('0') && digits.length === 10) {
      normalized = '255' + digits.slice(1)
    } else if (digits.length === 9 && /^[678]/.test(digits)) {
      normalized = '255' + digits
    } else {
      return { valid: false, error: 'Invalid Tanzania phone number format' }
    }

    if (!/^255[678]\d{8}$/.test(normalized)) {
      return { valid: false, error: 'Invalid Tanzania mobile number' }
    }

    return { valid: true, normalized }
  }

  /**
   * Get configuration for analytics
   */
  getAnalyticsConfig(): { enabled: boolean; trackDelivery: boolean; trackClicks: boolean } {
    return {
      enabled: this.config.enableAnalytics,
      trackDelivery: true,
      trackClicks: false
    }
  }

  /**
   * Log SMS event
   */
  logEvent(event: string, data: any): void {
    if (!this.config.enableLogging) {
      return
    }

    const logData = {
      timestamp: new Date().toISOString(),
      event,
      environment: this.config.environment,
      ...data
    }

    console.log(`[SMSConfig] ${event}:`, logData)
  }

  /**
   * Get business hours as readable string
   */
  getBusinessHoursString(): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const activeDays = this.config.businessHours.days.map(day => dayNames[day]).join(', ')
    
    return `${activeDays}, ${this.config.businessHours.start} - ${this.config.businessHours.end} (${this.config.timeZone})`
  }

  /**
   * Export configuration for monitoring
   */
  exportForMonitoring(): Record<string, any> {
    return {
      enabled: this.config.enabled,
      environment: this.config.environment,
      rateLimit: this.config.rateLimit,
      activeSenders: Object.entries(this.config.senderIds)
        .filter(([_, config]) => config.isActive)
        .map(([id, config]) => ({ id, name: config.name, category: config.category })),
      queueEnabled: this.config.enableQueue,
      templatesEnabled: this.config.enableTemplates,
      businessHours: this.getBusinessHoursString(),
      respectBusinessHours: this.config.respectBusinessHours
    }
  }
}

// Export singleton instance
export const smsConfig = SMSConfigManager.getInstance()

// Helper functions
export function getSMSConfig(): SMSConfig {
  return smsConfig.getConfig()
}

export function getSenderIdForCategory(category: string): string {
  return smsConfig.getSenderIdForCategory(category)
}

export function isSMSEnabled(): boolean {
  return smsConfig.isEnabled()
}

export function isWithinBusinessHours(): boolean {
  return smsConfig.isWithinBusinessHours()
}

export function validatePhoneNumber(phone: string): { valid: boolean; normalized?: string; error?: string } {
  return smsConfig.validatePhoneNumber(phone)
}

export function logSMSEvent(event: string, data: any): void {
  smsConfig.logEvent(event, data)
}
