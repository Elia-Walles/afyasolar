/**
 * SMS Templates Management
 * Centralized templates for all SMS notifications
 */

export interface TemplateData {
  [key: string]: string | number | boolean | undefined
}

export interface SMSTemplate {
  id: string
  name: string
  category: 'maintenance' | 'booking' | 'payment' | 'finance' | 'solar' | 'user' | 'system'
  template: string
  variables: string[]
  priority?: 'low' | 'medium' | 'high' | 'critical'
  sender?: string
}

export const SMSTemplates: Record<string, SMSTemplate> = {
  // MAINTENANCE TEMPLATES
  'maintenance.request.created': {
    id: 'maintenance.request.created',
    name: 'Maintenance Request Created',
    category: 'maintenance',
    template: '{{urgencyEmoji}} AfyaLink: Maintenance Request Created!\n\nRequest #{{requestNumber}}\nDevice: {{deviceName}}\nUrgency: {{urgencyLevel}}\n\nWe\'ll assign a technician and notify you shortly.\nTrack: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\nThank you! - AfyaLink Team',
    variables: ['urgencyEmoji', 'requestNumber', 'deviceName', 'urgencyLevel'],
    priority: 'medium',
    sender: 'Afyalink'
  },
  
  'maintenance.technician.accepted': {
    id: 'maintenance.technician.accepted',
    name: 'Technician Accepted Assignment',
    category: 'maintenance',
    template: '✅ AfyaLink: Technician Accepted Assignment!\n\nRequest #{{requestNumber}}\nDevice: {{deviceName}}\nTechnician: {{technicianName}}\n\nTechnician has confirmed and will contact you soon.\nTrack: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\nThank you! - AfyaLink Team',
    variables: ['requestNumber', 'deviceName', 'technicianName'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'maintenance.quote.submitted': {
    id: 'maintenance.quote.submitted',
    name: 'Quote Submitted',
    category: 'maintenance',
    template: '💰 AfyaLink: Quote Submitted!\n\nRequest #{{requestNumber}}\nTechnician: {{technicianName}}\nQuote Amount: TSh {{amount}}\n\nQuote is under admin review.\nTrack: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\nThank you! - AfyaLink Team',
    variables: ['requestNumber', 'technicianName', 'amount'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'maintenance.quote.rejected': {
    id: 'maintenance.quote.rejected',
    name: 'Quote Rejected',
    category: 'maintenance',
    template: '❌ AfyaLink: Quote Rejected\n\nRequest #{{requestNumber}}\nYour quote was not approved.{{reasonSection}}Please review and submit revised quote.\nTrack: https://app.ubuntuafyalink.co.tz/dashboard/technician\n\nThank you! - AfyaLink Team',
    variables: ['requestNumber', 'reasonSection'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'maintenance.work.started': {
    id: 'maintenance.work.started',
    name: 'Work Started',
    category: 'maintenance',
    template: '🔨 AfyaLink: Work Started!\n\nRequest #{{requestNumber}}\nTechnician: {{technicianName}}\nWork has begun on your device.\n\nTrack: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\nThank you! - AfyaLink Team',
    variables: ['requestNumber', 'technicianName'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'maintenance.completed': {
    id: 'maintenance.completed',
    name: 'Maintenance Complete',
    category: 'maintenance',
    template: '🎉 AfyaLink: Maintenance Complete!\n\nRequest #{{requestNumber}}\nTechnician: {{technicianName}}\nWork has been completed successfully.\n\nPlease review and provide feedback.\nTrack: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\nThank you! - AfyaLink Team',
    variables: ['requestNumber', 'technicianName'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  // BOOKING TEMPLATES
  'booking.appointment.reminder': {
    id: 'booking.appointment.reminder',
    name: 'Appointment Reminder',
    category: 'booking',
    template: '⏰ AfyaLink: Appointment Reminder!\n\nDear {{patientName}},\n\nYour appointment is tomorrow:\n\nAppointment #: {{appointmentNumber}}\nDoctor: Dr. {{doctorName}}\nFacility: {{facilityName}}\nDate: {{appointmentDate}}\nTime: {{appointmentTime}}\n\nPlease arrive 10 minutes early.\nReply CANCEL to reschedule.\n\nThank you! - {{facilityName}}',
    variables: ['patientName', 'appointmentNumber', 'doctorName', 'facilityName', 'appointmentDate', 'appointmentTime'],
    priority: 'high',
    sender: 'Afyalink'
  },

  'booking.appointment.cancelled': {
    id: 'booking.appointment.cancelled',
    name: 'Appointment Cancelled',
    category: 'booking',
    template: '❌ AfyaLink: Appointment Cancelled\n\nDear {{patientName}},\n\nYour appointment has been cancelled:\n\nAppointment #: {{appointmentNumber}}\nFacility: {{facilityName}}{{reasonSection}}Please contact facility to reschedule.\n\nThank you! - {{facilityName}}',
    variables: ['patientName', 'appointmentNumber', 'facilityName', 'reasonSection'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'booking.noshow.detected': {
    id: 'booking.noshow.detected',
    name: 'No-Show Detected',
    category: 'booking',
    template: '⚠️ AfyaLink: No-Show Detected\n\nDear {{patientName}},\n\nYou missed your appointment:\n\nAppointment #: {{appointmentNumber}}\nFacility: {{facilityName}}\n\nPlease contact facility to reschedule.\nReply RESCHEDULE to book new time.\n\nThank you! - {{facilityName}}',
    variables: ['patientName', 'appointmentNumber', 'facilityName'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  // PAYMENT TEMPLATES
  'payment.failed': {
    id: 'payment.failed',
    name: 'Payment Failed',
    category: 'payment',
    template: '❌ AfyaLink: Payment Failed\n\nYour payment could not be processed:\n\nAmount: TSh {{amount}}\nTransaction ID: {{transactionId}}\nService: {{serviceName}}\n\nPlease check your payment method or try again.\nSupport: https://app.ubuntuafyalink.co.tz/support\n\nThank you! - AfyaLink Team',
    variables: ['amount', 'transactionId', 'serviceName'],
    priority: 'high',
    sender: 'Afyalink'
  },

  'payment.overdue': {
    id: 'payment.overdue',
    name: 'Payment Overdue',
    category: 'payment',
    template: '⚠️ AfyaLink: Payment Overdue\n\nYour payment is overdue:\n\nAmount: TSh {{amount}}\nDue Date: {{dueDate}}\nService: {{serviceName}}\n\nPlease pay immediately to avoid service interruption.\nPay: https://app.ubuntuafyalink.co.tz/payments\n\nThank you! - AfyaLink Team',
    variables: ['amount', 'dueDate', 'serviceName'],
    priority: 'high',
    sender: 'Afyalink'
  },

  'payment.subscription.renewal': {
    id: 'payment.subscription.renewal',
    name: 'Subscription Renewal Reminder',
    category: 'payment',
    template: '⏰ AfyaLink: Subscription Renewal Reminder\n\nYour subscription will renew in 7 days:\n\nService: {{serviceName}}\nRenewal Date: {{renewalDate}}\nAmount: TSh {{amount}}\n\nManage: https://app.ubuntuafyalink.co.tz/settings\n\nThank you! - AfyaLink Team',
    variables: ['serviceName', 'renewalDate', 'amount'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  // AFYA FINANCE TEMPLATES
  'finance.credit.submitted': {
    id: 'finance.credit.submitted',
    name: 'Credit Application Submitted',
    category: 'finance',
    template: '📋 AfyaLink: Credit Application Submitted!\n\nApplication #: {{applicationNumber}}\nRequested Amount: TSh {{requestedAmount}}\n\nYour application is under review.\nWe\'ll notify you of the decision within 2-3 business days.\nTrack: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\nThank you! - AfyaLink Team',
    variables: ['applicationNumber', 'requestedAmount'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'finance.credit.rejected': {
    id: 'finance.credit.rejected',
    name: 'Credit Application Rejected',
    category: 'finance',
    template: '❌ AfyaLink: Credit Application Not Approved\n\nApplication #: {{applicationNumber}}\nUnfortunately, we couldn\'t approve your application at this time.{{reasonSection}}You can reapply after 30 days.\nTrack: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\nThank you! - AfyaLink Team',
    variables: ['applicationNumber', 'reasonSection'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'finance.order.shipped': {
    id: 'finance.order.shipped',
    name: 'Order Shipped',
    category: 'finance',
    template: '📦 AfyaLink: Order Shipped!\n\nOrder #{{orderNumber}}\nProduct: {{productName}}{{trackingSection}}Your order has been shipped and is on its way.\nTrack: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\nThank you! - AfyaLink Team',
    variables: ['orderNumber', 'productName', 'trackingSection'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  // AFYA SOLAR TEMPLATES
  'solar.package.purchased': {
    id: 'solar.package.purchased',
    name: 'Solar Package Purchased',
    category: 'solar',
    template: '☀️ AfyaLink: Solar Package Purchased!\n\nPackage: {{packageName}}\nAmount: TSh {{amount}}\nPayment Plan: {{paymentPlan}}\n\nThank you for choosing Afya Solar!\nOur team will contact you for installation.\nTrack: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\nThank you! - AfyaLink Team',
    variables: ['packageName', 'amount', 'paymentPlan'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'solar.power.outage': {
    id: 'solar.power.outage',
    name: 'Power Outage Detected',
    category: 'solar',
    template: '⚠️ AfyaLink: Power Outage Detected!\n\nSite: {{siteName}}\nLast Power Seen: {{lastSeen}}\n\nOur team has been notified and is working to restore power.\nTrack: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\nThank you! - AfyaLink Team',
    variables: ['siteName', 'lastSeen'],
    priority: 'high',
    sender: 'Afyalink'
  },

  // USER MANAGEMENT TEMPLATES
  'user.invitation': {
    id: 'user.invitation',
    name: 'User Invitation',
    category: 'user',
    template: '🎉 AfyaLink: You\'re Invited!\n\n{{inviterName}} invited you to join {{facilityName}}\nRole: {{role}}\n\nClick to accept and complete registration:\nhttps://app.ubuntuafyalink.co.tz/register\n\nThank you! - AfyaLink Team',
    variables: ['inviterName', 'facilityName', 'role'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'user.password.changed': {
    id: 'user.password.changed',
    name: 'Password Changed',
    category: 'user',
    template: '🔒 AfyaLink: Password Changed\n\nYour password was successfully changed.\n\nTime: {{timestamp}}\n\nIf this wasn\'t you, please contact support immediately.\nSupport: https://app.ubuntuafyalink.co.tz/support\n\nThank you! - AfyaLink Team',
    variables: ['timestamp'],
    priority: 'high',
    sender: 'Afyalink'
  },

  'user.new.device.login': {
    id: 'user.new.device.login',
    name: 'New Device Login',
    category: 'user',
    template: '🔐 AfyaLink: New Device Login\n\nNew login detected on your account:\n\nDevice: {{device}}\nLocation: {{location}}\nTime: {{timestamp}}\n\nIf this wasn\'t you, please secure your account immediately.\nSecure: https://app.ubuntuafyalink.co.tz/security\n\nThank you! - AfyaLink Team',
    variables: ['device', 'location', 'timestamp'],
    priority: 'high',
    sender: 'Afyalink'
  },

  // SYSTEM ALERTS TEMPLATES
  'system.maintenance': {
    id: 'system.maintenance',
    name: 'System Maintenance',
    category: 'system',
    template: '🔧 AfyaLink: Scheduled Maintenance\n\nSystem maintenance is scheduled:\n\nStart Time: {{startTime}}\nDuration: {{duration}}\nAffected Services: {{affectedServices}}\n\nServices may be unavailable during this time.\nStatus: https://app.ubuntuafyalink.co.tz/status\n\nThank you! - AfyaLink Team',
    variables: ['startTime', 'duration', 'affectedServices'],
    priority: 'medium',
    sender: 'Afyalink'
  },

  'system.downtime': {
    id: 'system.downtime',
    name: 'System Downtime Alert',
    category: 'system',
    template: '🚨 AfyaLink: System Downtime Alert\n\nWe\'re experiencing technical issues:\n\nIssue: {{issue}}\nEstimated Resolution: {{estimatedResolution}}\n\nOur team is working to resolve this quickly.\nStatus: https://app.ubuntuafyalink.co.tz/status\n\nThank you for your patience! - AfyaLink Team',
    variables: ['issue', 'estimatedResolution'],
    priority: 'critical',
    sender: 'Afyalink'
  },

  'system.security.breach': {
    id: 'system.security.breach',
    name: 'Security Breach Alert',
    category: 'system',
    template: '🚨 AfyaLink: Security Alert\n\nSecurity threat detected:\n\nThreat: {{threat}}\nAction Required: {{actionRequired}}\n\nPlease take immediate action to secure your account.\nSecurity: https://app.ubuntuafyalink.co.tz/security\n\nThank you! - AfyaLink Team',
    variables: ['threat', 'actionRequired'],
    priority: 'critical',
    sender: 'Afyalink'
  }
}

/**
 * Template rendering engine
 */
export class SMSTemplateEngine {
  /**
   * Render template with data
   */
  static render(templateId: string, data: TemplateData): string {
    const template = SMSTemplates[templateId]
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    let rendered = template.template

    // Replace all variables in the template
    for (const variable of template.variables) {
      const value = data[variable] || ''
      const placeholder = `{{${variable}}}`
      rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value))
    }

    return rendered
  }

  /**
   * Get template by ID
   */
  static getTemplate(templateId: string): SMSTemplate | undefined {
    return SMSTemplates[templateId]
  }

  /**
   * Get templates by category
   */
  static getTemplatesByCategory(category: string): SMSTemplate[] {
    return Object.values(SMSTemplates).filter(template => template.category === category)
  }

  /**
   * Validate template data
   */
  static validateTemplateData(templateId: string, data: TemplateData): { valid: boolean; missing: string[] } {
    const template = SMSTemplates[templateId]
    if (!template) {
      return { valid: false, missing: ['Template not found'] }
    }

    const missing: string[] = []
    for (const variable of template.variables) {
      if (!(variable in data) || data[variable] === undefined || data[variable] === '') {
        missing.push(variable)
      }
    }

    return {
      valid: missing.length === 0,
      missing
    }
  }

  /**
   * Get all template IDs
   */
  static getAllTemplateIds(): string[] {
    return Object.keys(SMSTemplates)
  }

  /**
   * Search templates by name or content
   */
  static searchTemplates(query: string): SMSTemplate[] {
    const lowerQuery = query.toLowerCase()
    return Object.values(SMSTemplates).filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.template.toLowerCase().includes(lowerQuery) ||
      template.category.toLowerCase().includes(lowerQuery)
    )
  }
}

// Helper functions for common template operations
export function renderSMSTemplate(templateId: string, data: TemplateData): string {
  return SMSTemplateEngine.render(templateId, data)
}

export function validateSMSTemplateData(templateId: string, data: TemplateData): { valid: boolean; missing: string[] } {
  return SMSTemplateEngine.validateTemplateData(templateId, data)
}

export function getSMSTemplate(templateId: string): SMSTemplate | undefined {
  return SMSTemplateEngine.getTemplate(templateId)
}

export function getSMSTemplatesByCategory(category: string): SMSTemplate[] {
  return SMSTemplateEngine.getTemplatesByCategory(category)
}
