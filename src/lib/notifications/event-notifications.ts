import { db } from '@/lib/db'
import { adminNotifications } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { sendAdminEmailNotification } from './admin-email-service'

interface CreateNotificationParams {
  type: string
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  facilityId?: string
  productId?: string
  serviceName?: string
  transactionId?: string
  metadata?: any
  priority?: 'urgent' | 'high' | 'normal' | 'low'
}

/**
 * Create admin notification for important events
 */
export async function createAdminNotification(params: CreateNotificationParams) {
  try {
    const notificationId = generateId()
    
    await db.insert(adminNotifications).values({
      id: notificationId,
      userId: 'system', // System-generated notification
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      actionLabel: params.actionLabel,
      facilityId: params.facilityId,
      productId: params.productId,
      serviceName: params.serviceName,
      transactionId: params.transactionId,
      metadata: params.metadata,
      priority: params.priority || 'normal',
      showInDashboard: true,
      sendEmail: true, // Enable email sending for all admin notifications
      sendSms: false,
      isRead: false,
      isDismissed: false,
    })

    return { success: true, notificationId }
  } catch (error) {
    console.error('Error creating admin notification:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Create admin notification and send email
 */
export async function createAdminNotificationWithEmail(params: CreateNotificationParams) {
  const result = await createAdminNotification(params)
  
  if (result.success && result.notificationId) {
    // Send email notification asynchronously (don't wait for it)
    sendAdminEmailNotification(result.notificationId).catch(emailError => {
      console.error('Failed to send admin email:', emailError)
    })
  }
  
  return result
}

// Specific notification creators for different event types

export const notificationCreators = {
  // Maintenance Events
  maintenanceRequestCreated: async (data: {
    requestId: string
    facilityName: string
    facilityId: string
    deviceName: string
    urgencyLevel: string
  }) => {
    const priority = data.urgencyLevel === 'critical' ? 'urgent' : 
                   data.urgencyLevel === 'high' ? 'high' : 'normal'
    
    return createAdminNotificationWithEmail({
      type: 'maintenance_request',
      title: 'New Maintenance Request',
      message: `${data.facilityName} has created a maintenance request for ${data.deviceName} (${data.urgencyLevel} priority)`,
      actionUrl: '/admin/maintenance/requests',
      actionLabel: 'View Request',
      facilityId: data.facilityId,
      transactionId: data.requestId,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        device: { name: data.deviceName },
        urgency: data.urgencyLevel,
        requestNumber: data.requestId,
      },
      priority,
    })
  },

  technicianAssigned: async (data: {
    requestId: string
    technicianName: string
    facilityName: string
    facilityId: string
    deviceName: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'technician_assignment',
      title: 'Technician Assigned',
      message: `${data.technicianName} has been assigned to maintenance request #${data.requestId} for ${data.deviceName}`,
      actionUrl: '/admin/maintenance/requests',
      actionLabel: 'View Assignment',
      transactionId: data.requestId,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        device: { name: data.deviceName },
        technician: { name: data.technicianName },
        requestNumber: data.requestId,
      },
      priority: 'normal',
    })
  },

  maintenanceCompleted: async (data: {
    requestId: string
    technicianName: string
    facilityName: string
    facilityId: string
    deviceName: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'maintenance_completed',
      title: 'Maintenance Completed',
      message: `${data.technicianName} has completed maintenance request #${data.requestId} for ${data.deviceName}`,
      actionUrl: '/admin/maintenance/requests',
      actionLabel: 'View Completion',
      facilityId: data.facilityId,
      transactionId: data.requestId,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        device: { name: data.deviceName },
        technician: { name: data.technicianName },
        requestNumber: data.requestId,
      },
      priority: 'normal',
    })
  },

  // Credit Application Events
  creditApplicationSubmitted: async (data: {
    applicationNumber: string
    facilityName: string
    facilityId: string
    requestedAmount: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'credit_application',
      title: 'New Credit Application',
      message: `${data.facilityName} has submitted a credit application for TSh ${data.requestedAmount}`,
      actionUrl: '/admin/afya-finance/credit-applications',
      actionLabel: 'View Application',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.applicationNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        amount: data.requestedAmount,
        applicationNumber: data.applicationNumber,
      },
      priority: 'high',
    })
  },

  creditApplicationApproved: async (data: {
    applicationNumber: string
    facilityName: string
    facilityId: string
    approvedAmount: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'credit_approved',
      title: 'Credit Application Approved',
      message: `${data.facilityName}'s credit application has been approved for TSh ${data.approvedAmount}`,
      actionUrl: '/admin/afya-finance/credit-applications',
      actionLabel: 'View Approval',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.applicationNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        amount: data.approvedAmount,
        applicationNumber: data.applicationNumber,
      },
      priority: 'high',
    })
  },

  creditApplicationRejected: async (data: {
    applicationNumber: string
    facilityName: string
    facilityId: string
    reason?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'credit_rejected',
      title: 'Credit Application Rejected',
      message: `${data.facilityName}'s credit application has been rejected${data.reason ? `: ${data.reason}` : ''}`,
      actionUrl: '/admin/afya-finance/credit-applications',
      actionLabel: 'View Rejection',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.applicationNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        applicationNumber: data.applicationNumber,
        reason: data.reason,
      },
      priority: 'high',
    })
  },

  // Pool Events
  poolCreated: async (data: {
    poolNumber: string
    productName: string
    targetParticipants: number
    unitPrice: number
    discountPercentage: number
    closesAt: string
    createdBy: string
    selectedFacilities: string[]
  }) => {
    return createAdminNotificationWithEmail({
      type: 'pool_created',
      title: 'New Pool Created',
      message: `New pool ${data.poolNumber} created for ${data.productName}. Target: ${data.targetParticipants} participants, Discount: ${data.discountPercentage}%`,
      actionUrl: '/admin/afya-finance',
      actionLabel: 'View Pool',
      serviceName: 'afya-finance',
      metadata: {
        poolNumber: data.poolNumber,
        productName: data.productName,
        targetParticipants: data.targetParticipants,
        unitPrice: data.unitPrice,
        discountPercentage: data.discountPercentage,
        closesAt: data.closesAt,
        createdBy: data.createdBy,
        selectedFacilities: data.selectedFacilities,
      },
      priority: 'normal',
    })
  },

  poolInvitation: async (data: {
    poolNumber: string
    facilityName: string
    facilityId: string
    productName: string
    targetQuantity: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'pool_invitation',
      title: 'New Pool Invitation',
      message: `${data.facilityName} has been invited to join procurement pool #${data.poolNumber} for ${data.productName}`,
      actionUrl: '/admin/afya-finance/pools',
      actionLabel: 'View Pool',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        pool: { number: data.poolNumber, product: data.productName },
        targetQuantity: data.targetQuantity,
      },
      priority: 'high',
    })
  },

  // Order Events
  orderCreated: async (data: {
    orderNumber: string
    facilityName: string
    facilityId: string
    productName: string
    quantity: number
    totalAmount: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'new_order',
      title: 'New Order',
      message: `${data.facilityName} has placed an order for ${data.quantity}x ${data.productName} (TSh ${data.totalAmount})`,
      actionUrl: '/admin/afya-finance/orders',
      actionLabel: 'View Order',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.orderNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        product: { name: data.productName },
        quantity: data.quantity,
        amount: data.totalAmount,
        orderNumber: data.orderNumber,
      },
      priority: 'high',
    })
  },

  orderAccepted: async (data: {
    orderNumber: string
    facilityName: string
    facilityId: string
    productName: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'order_accepted',
      title: 'Order Accepted',
      message: `Order #${data.orderNumber} for ${data.productName} has been accepted and is being processed`,
      actionUrl: '/admin/afya-finance/orders',
      actionLabel: 'View Order',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.orderNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        product: { name: data.productName },
        orderNumber: data.orderNumber,
      },
      priority: 'normal',
    })
  },

  orderShipped: async (data: {
    orderNumber: string
    facilityName: string
    facilityId: string
    productName: string
    trackingNumber?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'order_shipped',
      title: 'Order Shipped',
      message: `Order #${data.orderNumber} for ${data.productName} has been shipped${data.trackingNumber ? ` (Tracking: ${data.trackingNumber})` : ''}`,
      actionUrl: '/admin/afya-finance/orders',
      actionLabel: 'View Order',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.orderNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        product: { name: data.productName },
        orderNumber: data.orderNumber,
        trackingNumber: data.trackingNumber,
      },
      priority: 'normal',
    })
  },

  // Appointment Events
  appointmentBooked: async (data: {
    appointmentNumber: string
    patientName: string
    doctorName: string
    facilityName: string
    facilityId: string
    appointmentDate: string
    appointmentTime: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'appointment_booked',
      title: 'New Appointment Booked',
      message: `New appointment booked: ${data.patientName} with Dr. ${data.doctorName} at ${data.facilityName} on ${data.appointmentDate} at ${data.appointmentTime}`,
      actionUrl: '/admin/appointments',
      actionLabel: 'View Appointment',
      facilityId: data.facilityId,
      serviceName: 'afya-booking',
      transactionId: data.appointmentNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        patient: { name: data.patientName },
        doctor: { name: data.doctorName },
        appointmentDate: data.appointmentDate,
        appointmentTime: data.appointmentTime,
        appointmentNumber: data.appointmentNumber,
      },
      priority: 'high',
    })
  },

  appointmentCancelled: async (data: {
    appointmentNumber: string
    patientName: string
    facilityName: string
    facilityId: string
    reason?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'appointment_cancelled',
      title: 'Appointment Cancelled',
      message: `Appointment #${data.appointmentNumber} for ${data.patientName} at ${data.facilityName} has been cancelled${data.reason ? `: ${data.reason}` : ''}`,
      actionUrl: '/admin/appointments',
      actionLabel: 'View Cancellation',
      facilityId: data.facilityId,
      serviceName: 'afya-booking',
      transactionId: data.appointmentNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        patient: { name: data.patientName },
        appointmentNumber: data.appointmentNumber,
        reason: data.reason,
      },
      priority: 'high',
    })
  },

  // Payment Events
  paymentFailed: async (data: {
    amount: string
    serviceName: string
    transactionId: string
    userId?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Payment of TSh ${data.amount} failed for ${data.serviceName}${data.userId ? ` (User: ${data.userId})` : ''}`,
      actionUrl: '/admin/payments',
      actionLabel: 'View Payment',
      serviceName: data.serviceName,
      transactionId: data.transactionId,
      metadata: {
        amount: data.amount,
        serviceName: data.serviceName,
        transactionId: data.transactionId,
        userId: data.userId,
      },
      priority: 'high',
    })
  },

  paymentOverdue: async (data: {
    amount: string
    serviceName: string
    dueDate: string
    userId?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'payment_overdue',
      title: 'Payment Overdue',
      message: `Payment of TSh ${data.amount} is overdue for ${data.serviceName} (Due: ${data.dueDate})${data.userId ? ` (User: ${data.userId})` : ''}`,
      actionUrl: '/admin/payments',
      actionLabel: 'View Overdue Payment',
      serviceName: data.serviceName,
      metadata: {
        amount: data.amount,
        serviceName: data.serviceName,
        dueDate: data.dueDate,
        userId: data.userId,
      },
      priority: 'urgent',
    })
  },

  // User Management Events
  userRegistered: async (data: {
    userName: string
    userEmail?: string
    userRole: string
    facilityName?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'user_registration',
      title: 'New User Registration',
      message: `New user registered: ${data.userName} (${data.userRole})${data.facilityName ? ` at ${data.facilityName}` : ''}`,
      actionUrl: '/admin/users',
      actionLabel: 'View User',
      metadata: {
        user: { name: data.userName, email: data.userEmail, role: data.userRole },
        facility: data.facilityName ? { name: data.facilityName } : null,
      },
      priority: 'normal',
    })
  },

  // System Events
  powerOutageDetected: async (data: {
    siteName: string
    lastSeen: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'system_alert',
      title: 'Power Outage Detected',
      message: `Power outage detected at ${data.siteName}. Last power seen: ${data.lastSeen}`,
      actionUrl: '/admin/system-monitoring',
      actionLabel: 'View Outage',
      serviceName: 'afya-solar',
      metadata: {
        site: { name: data.siteName },
        lastSeen: data.lastSeen,
      },
      priority: 'urgent',
    })
  },

  quoteRequestCreated: async (data: {
    requestNumber: string
    facilityName: string
    facilityId: string
    technicianName: string
    amount: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'quote_request',
      title: 'New Quote Request',
      message: `${data.facilityName} has requested a quote for TSh ${data.amount} (${data.technicianName})`,
      actionUrl: '/admin/maintenance/quotes',
      actionLabel: 'View Quote',
      facilityId: data.facilityId,
      transactionId: data.requestNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        technician: { name: data.technicianName },
        amount: data.amount,
        requestNumber: data.requestNumber,
      },
      priority: 'high',
    })
  },

  featureRequestCreated: async (data: {
    requestNumber: string
    facilityName: string
    facilityId: string
    facilityEmail: string
    serviceName: string
    title: string
    description: string
    priority: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'feature_request',
      title: 'New Feature Request',
      message: `${data.facilityName} has requested a new feature for ${data.serviceName}: ${data.title}`,
      actionUrl: '/admin/feature-requests',
      actionLabel: 'View Request',
      facilityId: data.facilityId,
      serviceName: data.serviceName,
      transactionId: data.requestNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName, email: data.facilityEmail },
        serviceName: data.serviceName,
        title: data.title,
        description: data.description,
        priority: data.priority,
        requestNumber: data.requestNumber,
      },
      priority: data.priority === 'high' ? 'urgent' : data.priority === 'medium' ? 'normal' : 'low',
    })
  },

  feedbackSubmitted: async (data: {
    feedbackNumber: string
    facilityName: string
    facilityId: string
    patientName: string
    patientPhone: string
    type: string
    message: string
    rating?: number
    source: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'feedback_submitted',
      title: 'New Feedback Submitted',
      message: `${data.facilityName} has received ${data.type} feedback${data.rating ? ` (${data.rating}/5 stars)` : ''} from ${data.patientName || 'Anonymous'}`,
      actionUrl: '/admin/feedback',
      actionLabel: 'View Feedback',
      facilityId: data.facilityId,
      serviceName: 'general',
      transactionId: data.feedbackNumber,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        feedbackType: data.type,
        message: data.message,
        rating: data.rating,
        source: data.source,
        feedbackNumber: data.feedbackNumber,
      },
      priority: data.rating && data.rating <= 2 ? 'high' : 'normal',
    })
  },

  deviceRequestCreated: async (data: {
    requestId: string
    name: string
    email: string
    phone: string
    facilityName?: string
    deviceType?: string
    quantity: number
    message?: string
    facilityId?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'device_request',
      title: 'New Device Request',
      message: `${data.name} has requested ${data.quantity}x ${data.deviceType || 'device'}${data.facilityName ? ` from ${data.facilityName}` : ''}`,
      actionUrl: '/admin/device-requests',
      actionLabel: 'View Request',
      facilityId: data.facilityId || undefined,
      transactionId: data.requestId,
      metadata: {
        requesterName: data.name,
        requesterEmail: data.email,
        requesterPhone: data.phone,
        facilityName: data.facilityName,
        deviceType: data.deviceType,
        quantity: data.quantity,
        message: data.message,
        requestId: data.requestId,
      },
      priority: 'normal',
    })
  },

  // Invoice Request Events
  solarInvoiceRequestCreated: async (data: {
    requestId: string
    facilityName: string
    facilityId: string
    facilityEmail: string
    facilityPhone: string
    packageName: string
    packageId: string
    paymentPlan: string
    amount: string
    currency: string
    packageMetadata?: any
  }) => {
    return createAdminNotificationWithEmail({
      type: 'invoice_request',
      title: 'New Solar Invoice Request',
      message: `${data.facilityName} has requested to pay by invoice for ${data.packageName} (${data.paymentPlan} plan) - ${data.currency} ${data.amount}`,
      actionUrl: '/admin/afya-solar/invoice-requests',
      actionLabel: 'View Invoice Request',
      facilityId: data.facilityId,
      productId: data.packageId,
      serviceName: 'afya-solar',
      transactionId: data.requestId,
      metadata: {
        facility: {
          id: data.facilityId,
          name: data.facilityName,
          email: data.facilityEmail,
          phone: data.facilityPhone,
        },
        product: {
          id: data.packageId,
          name: data.packageName,
        },
        amount: `${data.currency} ${data.amount}`,
        paymentPlan: data.paymentPlan,
        packageMetadata: data.packageMetadata,
        requestId: data.requestId,
      },
      priority: 'high',
    })
  },

  solarPaymentCompleted: async (data: {
    transactionId: string
    externalId: string
    facilityId: string
    facilityName: string
    amount: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'solar_payment_completed',
      title: 'Afya Solar Payment Completed',
      message: `${data.facilityName} has completed an Afya Solar payment of TSh ${data.amount}.`,
      actionUrl: '/dashboard/admin',
      actionLabel: 'View Afya Solar',
      facilityId: data.facilityId,
      serviceName: 'afya-solar',
      transactionId: data.transactionId,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        amount: data.amount,
        externalId: data.externalId,
        transactionId: data.transactionId,
      },
      priority: 'high',
    })
  },

  solarPaymentFailed: async (data: {
    transactionId: string
    externalId: string
    facilityId: string
    facilityName: string
    amount: string
    failureReason?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'solar_payment_failed',
      title: 'Afya Solar Payment Failed',
      message: `Afya Solar payment of TSh ${data.amount} for ${data.facilityName} failed${data.failureReason ? `: ${data.failureReason}` : ''}.`,
      actionUrl: '/dashboard/admin',
      actionLabel: 'Review Payment',
      facilityId: data.facilityId,
      serviceName: 'afya-solar',
      transactionId: data.transactionId,
      metadata: {
        facility: { id: data.facilityId, name: data.facilityName },
        amount: data.amount,
        externalId: data.externalId,
        transactionId: data.transactionId,
        failureReason: data.failureReason,
      },
      priority: 'high',
    })
  },

  bookingInvoiceRequestCreated: async (data: {
    requestId: string
    facilityName: string
    facilityId: string
    facilityEmail: string
    facilityPhone: string
    packageName: string
    packageId: string
    packageCode: string
    billingCycle: string
    amount: string
    currency: string
    packageMetadata?: any
  }) => {
    return createAdminNotificationWithEmail({
      type: 'invoice_request',
      title: 'New Booking Invoice Request',
      message: `${data.facilityName} has requested to pay by invoice for ${data.packageName} (${data.billingCycle} billing) - ${data.currency} ${data.amount}`,
      actionUrl: '/admin/booking/invoice-requests',
      actionLabel: 'View Invoice Request',
      facilityId: data.facilityId,
      productId: data.packageId,
      serviceName: 'afya-booking',
      transactionId: data.requestId,
      metadata: {
        facility: {
          id: data.facilityId,
          name: data.facilityName,
          email: data.facilityEmail,
          phone: data.facilityPhone,
        },
        product: {
          id: data.packageId,
          name: data.packageName,
          code: data.packageCode,
        },
        amount: `${data.currency} ${data.amount}`,
        billingCycle: data.billingCycle,
        packageMetadata: data.packageMetadata,
        requestId: data.requestId,
      },
      priority: 'high',
    })
  },

  distributionHubRequestCreated: async (data: {
    requestId: string
    facilityName: string
    facilityId: string
    facilityEmail: string
    facilityPhone: string
    region: string
    city: string
    address: string
    storageCapacity?: number
    justification?: string
  }) => {
    return createAdminNotificationWithEmail({
      type: 'distribution_hub_request',
      title: 'New Distribution Hub Application',
      message: `${data.facilityName} has applied to become a distribution hub in ${data.city}, ${data.region}. Storage capacity: ${data.storageCapacity ? `${data.storageCapacity} sqm` : 'Not specified'}`,
      actionUrl: '/admin/afya-finance',
      actionLabel: 'Review Application',
      facilityId: data.facilityId,
      serviceName: 'afya-finance',
      transactionId: data.requestId,
      metadata: {
        facility: {
          id: data.facilityId,
          name: data.facilityName,
          email: data.facilityEmail,
          phone: data.facilityPhone,
        },
        location: {
          region: data.region,
          city: data.city,
          address: data.address,
        },
        storageCapacity: data.storageCapacity,
        justification: data.justification,
        requestId: data.requestId,
      },
      priority: 'high',
    })
  },
}
