interface SendSMSOptions {
  to: string;
  message: string;
  sender?: string;
}

/**
 * Normalize and validate Tanzania phone number to E.164 (255 + 9 digits).
 * Accepts: 0712345678, 712345678, 255712345678, +255712345678.
 * Returns null if invalid (wrong length or not a mobile prefix 6/7/8).
 */
export function normalizeTanzaniaPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;

  let normalized: string;
  if (digits.startsWith('255') && digits.length === 12) {
    normalized = digits;
  } else if (digits.startsWith('255') && digits.length > 12) {
    normalized = digits.slice(0, 12);
  } else if (digits.startsWith('255') && digits.length >= 9) {
    normalized = '255' + digits.slice(3, 12);
  } else if (digits.startsWith('0') && digits.length === 10) {
    normalized = '255' + digits.slice(1);
  } else if (digits.length === 9 && /^[678]/.test(digits)) {
    normalized = '255' + digits;
  } else if (digits.length >= 9 && /^[678]/.test(digits)) {
    normalized = '255' + digits.slice(0, 9);
  } else {
    return null;
  }

  if (normalized.length !== 12 || !normalized.startsWith('255') || !/^255[678]\d{8}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export async function sendSMS({ to, message, sender = 'Afyalink' }: SendSMSOptions): Promise<{ success: boolean; message: string }> {
  try {
    const recipient = normalizeTanzaniaPhone(to);
    if (!recipient) {
      console.warn('[SMS] Invalid phone number (not sent):', to);
      return {
        success: false,
        message: `${to} is not a valid Tanzania mobile number (use 0712345678 or 255712345678)`,
      };
    }
    const postData = {
      recipient,
      sender_id: sender,
      type: 'plain',
      message: message
    };

    const response = await fetch('https://smartsms.ipab.co.tz/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMARTSMS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(postData)
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('SMS API Error:', responseData);
      return {
        success: false,
        message: `Failed to send SMS: ${response.status} ${response.statusText}`
      };
    }

    return {
      success: true,
      message: 'SMS sent successfully'
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      message: `Error sending SMS: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function sendVerificationCodeSMS(phoneNumber: string, code: string): Promise<{ success: boolean; message: string }> {
  const message = `AfyaLink: Your verification code is ${code}. Valid 5 min.`;

  return sendSMS({
    to: phoneNumber,
    message,
    sender: 'Afyalink'
  });
}

export async function sendTechnicianAssignmentSMS(technicianPhone: string, jobDetails: {
  jobId: string;
  customerName: string;
  location: string;
  scheduledDate?: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `New Job Assigned!\n\n` +
    `Job #${jobDetails.jobId}\n` +
    `Customer: ${jobDetails.customerName}\n` +
    `Location: ${jobDetails.location}\n` +
    (jobDetails.scheduledDate ? `Scheduled: ${jobDetails.scheduledDate}\n` : '') +
    `\nLogin to view details.`;

  return sendSMS({
    to: technicianPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendTechnicianRoleAssignmentSMS(technicianPhone: string, roleDetails: {
  roleType: 'maintenance_request' | 'maintenance_plan';
  jobId: string;
  customerName: string;
  location: string;
  scheduledDate?: string;
}): Promise<{ success: boolean; message: string }> {
  const roleTypeText = roleDetails.roleType === 'maintenance_request' ? 'Maintenance Request' : 'Maintenance Plan Evaluation'
  
  const message = `AfyaLink: New ${roleTypeText} Assigned!\n\n` +
    `Job #${roleDetails.jobId}\n` +
    `Customer: ${roleDetails.customerName}\n` +
    `Location: ${roleDetails.location}\n` +
    (roleDetails.scheduledDate ? `Scheduled: ${roleDetails.scheduledDate}\n` : '') +
    `\nPlease login to view details and start work.\n` +
    `https://app.ubuntuafyalink.co.tz/dashboard\n\n` +
    `Thank you! - AfyaLink Team`

  return sendSMS({
    to: technicianPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendPaymentVerificationSMS(phoneNumber: string, paymentDetails: {
  transactionId: string;
  externalId: string;
  amount: string;
  currency: string;
  serviceName: string;
  serviceDisplayName: string;
  billingCycle: 'monthly' | 'yearly' | null;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date;
  paymentMethod?: string;
}): Promise<{ success: boolean; message: string }> {
  // Format service name
  const serviceDisplay = paymentDetails.serviceDisplayName || paymentDetails.serviceName
  
  // Format billing cycle
  const billingCycleText = paymentDetails.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'
  
  // Format dates
  const startDate = paymentDetails.subscriptionStartDate.toLocaleDateString('en-TZ', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const endDate = paymentDetails.subscriptionEndDate.toLocaleDateString('en-TZ', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  // Calculate duration
  const durationMs = paymentDetails.subscriptionEndDate.getTime() - paymentDetails.subscriptionStartDate.getTime()
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24))
  const durationText = durationDays >= 365 
    ? `${Math.floor(durationDays / 365)} year${Math.floor(durationDays / 365) > 1 ? 's' : ''}`
    : `${Math.floor(durationDays / 30)} month${Math.floor(durationDays / 30) > 1 ? 's' : ''}`

  const message = `AfyaLink Payment Verified!\n\n` +
    `Transaction ID: ${paymentDetails.externalId}\n` +
    `Amount: ${paymentDetails.currency} ${Number(paymentDetails.amount).toLocaleString()}\n` +
    `Service: ${serviceDisplay}\n` +
    `Plan: ${billingCycleText}\n` +
    `Duration: ${durationText}\n` +
    `Valid From: ${startDate}\n` +
    `Valid Until: ${endDate}\n\n` +
    `Your payment has been verified and your subscription is now active. Thank you!`

  return sendSMS({
    to: phoneNumber,
    message,
    sender: 'Afyalink'
  });
}

export async function sendPoolInvitationSMS(facilityPhone: string, poolDetails: {
  poolNumber: string;
  productName: string;
  targetQuantity: string;
  unitPrice: string;
  discountPercentage: string;
  deadline: string;
  deliveryRegion?: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `AfyaLink Pool Invitation!\n\n` +
    `Pool Number: ${poolDetails.poolNumber}\n` +
    `Product: ${poolDetails.productName}\n` +
    `Target Quantity: ${poolDetails.targetQuantity}\n` +
    `Unit Price: TSh ${parseFloat(poolDetails.unitPrice).toLocaleString()}\n` +
    (poolDetails.discountPercentage && poolDetails.discountPercentage !== '0' ? `Discount: ${poolDetails.discountPercentage}%\n` : '') +
    `Deadline: ${new Date(poolDetails.deadline).toLocaleDateString('en-TZ', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n` +
    (poolDetails.deliveryRegion ? `Delivery Region: ${poolDetails.deliveryRegion}\n` : '') +
    `\nYou have been invited to join this procurement pool.\n\n` +
    `🔗 Login to accept: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you!`

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendFacilityOrderAcceptanceSMS(facilityPhone: string, orderDetails: {
  orderNumber: string;
  productName: string;
  quantity: number;
  totalAmount: string;
  currency: string;
  estimatedDelivery?: Date | null;
  deliveryAddress?: string | null;
}): Promise<{ success: boolean; message: string }> {
  const deliveryInfo = orderDetails.estimatedDelivery 
    ? `Est. Delivery: ${orderDetails.estimatedDelivery.toLocaleDateString('en-TZ', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      })}\n` 
    : ''
  
  const addressInfo = orderDetails.deliveryAddress 
    ? `Delivery: ${orderDetails.deliveryAddress}\n` 
    : ''

  const message = `AfyaLink: Order Accepted! 🎉\n\n` +
    `Order #${orderDetails.orderNumber}\n` +
    `Product: ${orderDetails.productName}\n` +
    `Quantity: ${orderDetails.quantity}\n` +
    `Total: ${orderDetails.currency} ${Number(orderDetails.totalAmount).toLocaleString()}\n` +
    `${deliveryInfo}` +
    `${addressInfo}` +
    `\nYour order has been accepted and is being processed.\n` +
    `🔗 Track order: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendFacilityCreditApprovalSMS(facilityPhone: string, creditDetails: {
  applicationNumber: string;
  approvedAmount: string;
  currency: string;
  creditLimit: string;
  interestRate: string;
  repaymentTerms: number;
  purpose?: string | null;
}): Promise<{ success: boolean; message: string }> {
  const purposeInfo = creditDetails.purpose 
    ? `Purpose: ${creditDetails.purpose}\n` 
    : ''

  const message = `AfyaLink: Credit Application Approved! ✅\n\n` +
    `Application: ${creditDetails.applicationNumber}\n` +
    `Approved Amount: ${creditDetails.currency} ${Number(creditDetails.approvedAmount).toLocaleString()}\n` +
    `Credit Limit: ${creditDetails.currency} ${Number(creditDetails.creditLimit).toLocaleString()}\n` +
    `Interest Rate: ${creditDetails.interestRate}%\n` +
    `Repayment Terms: ${creditDetails.repaymentTerms} days\n` +
    `${purposeInfo}` +
    `\nYour credit facility is now active and ready to use.\n` +
    `🔗 Manage credit: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

/**
 * Send SMS notification to patient when appointment is booked successfully
 */
export async function sendPatientAppointmentConfirmationSMS(patientPhone: string, appointmentDetails: {
  appointmentNumber: string;
  patientName: string;
  doctorName: string;
  departmentName: string;
  facilityName: string;
  appointmentDate: Date;
  appointmentTime: string;
  accessCode?: string;
}): Promise<{ success: boolean; message: string }> {
  const formattedDate = appointmentDetails.appointmentDate.toLocaleDateString('en-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const accessCodeInfo = appointmentDetails.accessCode 
    ? `\nAccess Code: ${appointmentDetails.accessCode}\n(Use this to view your appointment online)` 
    : '';

  const message = `AfyaLink: Appointment Confirmed! ✅\n\n` +
    `Dear ${appointmentDetails.patientName},\n\n` +
    `Your appointment has been confirmed:\n\n` +
    `Appointment #: ${appointmentDetails.appointmentNumber}\n` +
    `Doctor: Dr. ${appointmentDetails.doctorName}\n` +
    `Department: ${appointmentDetails.departmentName}\n` +
    `Facility: ${appointmentDetails.facilityName}\n` +
    `Date: ${formattedDate}\n` +
    `Time: ${appointmentDetails.appointmentTime}\n` +
    `${accessCodeInfo}\n\n` +
    `Please arrive 10 minutes early. See you soon!\n\n` +
    `Thank you! - ${appointmentDetails.facilityName}`;

  return sendSMS({
    to: patientPhone,
    message,
    sender: 'Afyalink'
  });
}

/**
 * Send SMS notification to doctor when a new appointment is booked
 */
export async function sendDoctorAppointmentNotificationSMS(doctorPhone: string, appointmentDetails: {
  appointmentNumber: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  departmentName: string;
  facilityName: string;
  appointmentDate: Date;
  appointmentTime: string;
  notes?: string | null;
}): Promise<{ success: boolean; message: string }> {
  const formattedDate = appointmentDetails.appointmentDate.toLocaleDateString('en-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const notesInfo = appointmentDetails.notes 
    ? `\nNotes: ${appointmentDetails.notes}` 
    : '';

  const message = `AfyaLink: New Appointment Booking 📅\n\n` +
    `Dear Dr. ${appointmentDetails.doctorName},\n\n` +
    `You have a new appointment:\n\n` +
    `Appointment #: ${appointmentDetails.appointmentNumber}\n` +
    `Patient: ${appointmentDetails.patientName}\n` +
    `Phone: ${appointmentDetails.patientPhone}\n` +
    `Department: ${appointmentDetails.departmentName}\n` +
    `Date: ${formattedDate}\n` +
    `Time: ${appointmentDetails.appointmentTime}${notesInfo}\n\n` +
    `Please review in your dashboard.\n\n` +
    `Thank you! - ${appointmentDetails.facilityName}`;

  return sendSMS({
    to: doctorPhone,
    message,
    sender: 'Afyalink'
  });
}

/**
 * Send SMS notification to patient when appointment change is proposed
 */
export async function sendAppointmentChangeRequestSMS(patientPhone: string, changeDetails: {
  appointmentNumber: string;
  patientName: string;
  facilityName: string;
  currentDoctor: string;
  currentDate: string;
  currentTime: string;
  proposedDoctor?: string;
  proposedDate: string;
  proposedTime: string;
  reason?: string | null;
  confirmationLink: string;
}): Promise<{ success: boolean; message: string }> {
  const doctorChange = changeDetails.proposedDoctor && changeDetails.proposedDoctor !== changeDetails.currentDoctor
  const changes = []
  
  if (doctorChange) {
    changes.push(`Doctor: ${changeDetails.currentDoctor} → ${changeDetails.proposedDoctor}`)
  }
  
  if (changeDetails.currentDate !== changeDetails.proposedDate || changeDetails.currentTime !== changeDetails.proposedTime) {
    changes.push(`Time: ${changeDetails.currentDate} ${changeDetails.currentTime} → ${changeDetails.proposedDate} ${changeDetails.proposedTime}`)
  }

  const reasonInfo = changeDetails.reason 
    ? `\nReason: ${changeDetails.reason}\n` 
    : '';

  const message = `AfyaLink: Appointment Change Request 🔄\n\n` +
    `Dear ${changeDetails.patientName},\n\n` +
    `${changeDetails.facilityName} has requested to change your appointment:\n\n` +
    `Appointment #: ${changeDetails.appointmentNumber}\n` +
    `\nProposed Changes:\n${changes.join('\n')}${reasonInfo}\n` +
    `Please confirm if you accept these changes:\n` +
    `${changeDetails.confirmationLink}\n\n` +
    `If you don't accept, please contact the facility.\n\n` +
    `Thank you! - ${changeDetails.facilityName}`;

  return sendSMS({
    to: patientPhone,
    message,
    sender: 'Afyalink'
  });
}

/**
 * Send SMS notification to patient when change is confirmed
 */
export async function sendAppointmentChangeConfirmedSMS(patientPhone: string, details: {
  appointmentNumber: string;
  patientName: string;
  facilityName: string;
  doctor: string;
  date: string;
  time: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `AfyaLink: Appointment Updated ✅\n\n` +
    `Dear ${details.patientName},\n\n` +
    `Your appointment has been updated:\n\n` +
    `Appointment #: ${details.appointmentNumber}\n` +
    `Doctor: Dr. ${details.doctor}\n` +
    `Date: ${details.date}\n` +
    `Time: ${details.time}\n\n` +
    `Please arrive 10 minutes early.\n\n` +
    `Thank you! - ${details.facilityName}`;

  return sendSMS({
    to: patientPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// MAINTENANCE SERVICE SMS FUNCTIONS
// ============================================

export async function sendMaintenanceRequestCreatedSMS(facilityPhone: string, details: {
  requestNumber: string;
  deviceName: string;
  urgencyLevel: string;
}): Promise<{ success: boolean; message: string }> {
  const urgencyEmoji = details.urgencyLevel === 'critical' ? '🚨' : details.urgencyLevel === 'high' ? '⚡' : details.urgencyLevel === 'medium' ? '⚠️' : 'ℹ️';
  
  const message = `${urgencyEmoji} AfyaLink: Maintenance Request Created!\n\n` +
    `Request #${details.requestNumber}\n` +
    `Device: ${details.deviceName}\n` +
    `Urgency: ${details.urgencyLevel.toUpperCase()}\n\n` +
    `We'll assign a technician and notify you shortly.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendTechnicianAcceptedAssignmentSMS(facilityPhone: string, details: {
  requestNumber: string;
  technicianName: string;
  deviceName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `✅ AfyaLink: Technician Accepted Assignment!\n\n` +
    `Request #${details.requestNumber}\n` +
    `Device: ${details.deviceName}\n` +
    `Technician: ${details.technicianName}\n\n` +
    `Technician has confirmed and will contact you soon.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendQuoteSubmittedSMS(facilityPhone: string, details: {
  requestNumber: string;
  technicianName: string;
  amount: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `💰 AfyaLink: Quote Submitted!\n\n` +
    `Request #${details.requestNumber}\n` +
    `Technician: ${details.technicianName}\n` +
    `Quote Amount: TSh ${Number(details.amount).toLocaleString()}\n\n` +
    `Quote is under admin review.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendQuoteRejectedSMS(technicianPhone: string, details: {
  requestNumber: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `❌ AfyaLink: Quote Rejected\n\n` +
    `Request #${details.requestNumber}\n` +
    `Your quote was not approved.\n` +
    (details.reason ? `Reason: ${details.reason}\n\n` : '\n') +
    `Please review and submit revised quote.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/dashboard/technician\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: technicianPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendWorkStartedSMS(facilityPhone: string, details: {
  requestNumber: string;
  technicianName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🔨 AfyaLink: Work Started!\n\n` +
    `Request #${details.requestNumber}\n` +
    `Technician: ${details.technicianName}\n` +
    `Work has begun on your device.\n\n` +
    `Track: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendMaintenanceCompletedSMS(facilityPhone: string, details: {
  requestNumber: string;
  technicianName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🎉 AfyaLink: Maintenance Complete!\n\n` +
    `Request #${details.requestNumber}\n` +
    `Technician: ${details.technicianName}\n` +
    `Work has been completed successfully.\n\n` +
    `Please review and provide feedback.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/dashboard/facility\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// BOOKING SERVICE SMS FUNCTIONS
// ============================================

export async function sendAppointmentReminderSMS(patientPhone: string, details: {
  appointmentNumber: string;
  patientName: string;
  doctorName: string;
  facilityName: string;
  appointmentDate: string;
  appointmentTime: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⏰ AfyaLink: Appointment Reminder!\n\n` +
    `Dear ${details.patientName},\n\n` +
    `Your appointment is tomorrow:\n\n` +
    `Appointment #: ${details.appointmentNumber}\n` +
    `Doctor: Dr. ${details.doctorName}\n` +
    `Facility: ${details.facilityName}\n` +
    `Date: ${details.appointmentDate}\n` +
    `Time: ${details.appointmentTime}\n\n` +
    `Please arrive 10 minutes early.\n` +
    `Reply CANCEL to reschedule.\n\n` +
    `Thank you! - ${details.facilityName}`;

  return sendSMS({
    to: patientPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendAppointmentCancelledSMS(patientPhone: string, details: {
  appointmentNumber: string;
  patientName: string;
  facilityName: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `❌ AfyaLink: Appointment Cancelled\n\n` +
    `Dear ${details.patientName},\n\n` +
    `Your appointment has been cancelled:\n\n` +
    `Appointment #: ${details.appointmentNumber}\n` +
    `Facility: ${details.facilityName}\n` +
    (details.reason ? `Reason: ${details.reason}\n\n` : '\n') +
    `Please contact facility to reschedule.\n\n` +
    `Thank you! - ${details.facilityName}`;

  return sendSMS({
    to: patientPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendNoShowDetectedSMS(patientPhone: string, details: {
  appointmentNumber: string;
  patientName: string;
  facilityName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⚠️ AfyaLink: No-Show Detected\n\n` +
    `Dear ${details.patientName},\n\n` +
    `You missed your appointment:\n\n` +
    `Appointment #: ${details.appointmentNumber}\n` +
    `Facility: ${details.facilityName}\n\n` +
    `Please contact facility to reschedule.\n` +
    `Reply RESCHEDULE to book new time.\n\n` +
    `Thank you! - ${details.facilityName}`;

  return sendSMS({
    to: patientPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// PAYMENT SERVICE SMS FUNCTIONS
// ============================================

export async function sendPaymentFailedSMS(userPhone: string, details: {
  amount: string;
  transactionId: string;
  serviceName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `❌ AfyaLink: Payment Failed\n\n` +
    `Your payment could not be processed:\n\n` +
    `Amount: TSh ${Number(details.amount).toLocaleString()}\n` +
    `Transaction ID: ${details.transactionId}\n` +
    `Service: ${details.serviceName}\n\n` +
    `Please check your payment method or try again.\n` +
    `Support: https://app.ubuntuafyalink.co.tz/support\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendPaymentOverdueSMS(userPhone: string, details: {
  amount: string;
  dueDate: string;
  serviceName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⚠️ AfyaLink: Payment Overdue\n\n` +
    `Your payment is overdue:\n\n` +
    `Amount: TSh ${Number(details.amount).toLocaleString()}\n` +
    `Due Date: ${details.dueDate}\n` +
    `Service: ${details.serviceName}\n\n` +
    `Please pay immediately to avoid service interruption.\n` +
    `Pay: https://app.ubuntuafyalink.co.tz/payments\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendSubscriptionRenewalReminderSMS(userPhone: string, details: {
  serviceName: string;
  renewalDate: string;
  amount: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⏰ AfyaLink: Subscription Renewal Reminder\n\n` +
    `Your subscription will renew in 7 days:\n\n` +
    `Service: ${details.serviceName}\n` +
    `Renewal Date: ${details.renewalDate}\n` +
    `Amount: TSh ${Number(details.amount).toLocaleString()}\n\n` +
    `Manage: https://app.ubuntuafyalink.co.tz/settings\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// AFYA FINANCE SMS FUNCTIONS
// ============================================

export async function sendCreditApplicationSubmittedSMS(facilityPhone: string, details: {
  applicationNumber: string;
  requestedAmount: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `📋 AfyaLink: Credit Application Submitted!\n\n` +
    `Application #: ${details.applicationNumber}\n` +
    `Requested Amount: TSh ${Number(details.requestedAmount).toLocaleString()}\n\n` +
    `Your application is under review.\n` +
    `We'll notify you of the decision within 2-3 business days.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendCreditApplicationRejectedSMS(facilityPhone: string, details: {
  applicationNumber: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `❌ AfyaLink: Credit Application Not Approved\n\n` +
    `Application #: ${details.applicationNumber}\n` +
    `Unfortunately, we couldn't approve your application at this time.\n` +
    (details.reason ? `Reason: ${details.reason}\n\n` : '\n') +
    `You can reapply after 30 days.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendCreditPaymentDueReminderSMS(facilityPhone: string, details: {
  amount: string;
  dueDate: string;
  applicationNumber: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⚠️ AfyaLink: Credit Payment Due\n\n` +
    `Your credit payment is due in 3 days:\n\n` +
    `Application #: ${details.applicationNumber}\n` +
    `Amount: TSh ${Number(details.amount).toLocaleString()}\n` +
    `Due Date: ${details.dueDate}\n\n` +
    `Please ensure sufficient funds for automatic deduction.\n` +
    `Pay: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendOrderShippedSMS(facilityPhone: string, details: {
  orderNumber: string;
  productName: string;
  trackingNumber?: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `📦 AfyaLink: Order Shipped!\n\n` +
    `Order #${details.orderNumber}\n` +
    `Product: ${details.productName}\n` +
    (details.trackingNumber ? `Tracking: ${details.trackingNumber}\n\n` : '\n') +
    `Your order has been shipped and is on its way.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// AFYA SOLAR SMS FUNCTIONS
// ============================================

export async function sendSolarPackagePurchaseSMS(facilityPhone: string, details: {
  packageName: string;
  amount: string;
  paymentPlan: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `☀️ AfyaLink: Solar Package Purchased!\n\n` +
    `Package: ${details.packageName}\n` +
    `Amount: TSh ${Number(details.amount).toLocaleString()}\n` +
    `Payment Plan: ${details.paymentPlan}\n\n` +
    `Thank you for choosing Afya Solar!\n` +
    `Our team will contact you for installation.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendPowerOutageDetectedSMS(facilityPhone: string, details: {
  siteName: string;
  lastSeen: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⚠️ AfyaLink: Power Outage Detected!\n\n` +
    `Site: ${details.siteName}\n` +
    `Last Power Seen: ${details.lastSeen}\n\n` +
    `Our team has been notified and is working to restore power.\n` +
    `Track: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendSolarPaymentDueSMS(facilityPhone: string, details: {
  amount: string;
  dueDate: string;
  packageName: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `⚠️ AfyaLink: Solar Payment Due\n\n` +
    `Your solar payment is due soon:\n\n` +
    `Package: ${details.packageName}\n` +
    `Amount: TSh ${Number(details.amount).toLocaleString()}\n` +
    `Due Date: ${details.dueDate}\n\n` +
    `Pay to avoid service interruption.\n` +
    `Pay: https://app.ubuntuafyalink.co.tz/services/afya-solar\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: facilityPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// USER MANAGEMENT SMS FUNCTIONS
// ============================================

export async function sendUserInvitationSMS(userPhone: string, details: {
  inviterName: string;
  facilityName: string;
  role: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🎉 AfyaLink: You're Invited!\n\n` +
    `${details.inviterName} invited you to join ${details.facilityName}\n` +
    `Role: ${details.role}\n\n` +
    `Click to accept and complete registration:\n` +
    `https://app.ubuntuafyalink.co.tz/register\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendPasswordChangedSMS(userPhone: string, details: {
  timestamp: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🔒 AfyaLink: Password Changed\n\n` +
    `Your password was successfully changed.\n\n` +
    `Time: ${details.timestamp}\n\n` +
    `If this wasn't you, please contact support immediately.\n` +
    `Support: https://app.ubuntuafyalink.co.tz/support\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendNewDeviceLoginSMS(userPhone: string, details: {
  device: string;
  location: string;
  timestamp: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🔐 AfyaLink: New Device Login\n\n` +
    `New login detected on your account:\n\n` +
    `Device: ${details.device}\n` +
    `Location: ${details.location}\n` +
    `Time: ${details.timestamp}\n\n` +
    `If this wasn't you, please secure your account immediately.\n` +
    `Secure: https://app.ubuntuafyalink.co.tz/security\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

// ============================================
// SYSTEM ALERTS SMS FUNCTIONS
// ============================================

export async function sendSystemMaintenanceSMS(userPhone: string, details: {
  startTime: string;
  duration: string;
  affectedServices: string[];
}): Promise<{ success: boolean; message: string }> {
  const message = `🔧 AfyaLink: Scheduled Maintenance\n\n` +
    `System maintenance is scheduled:\n\n` +
    `Start Time: ${details.startTime}\n` +
    `Duration: ${details.duration}\n` +
    `Affected Services: ${details.affectedServices.join(', ')}\n\n` +
    `Services may be unavailable during this time.\n` +
    `Status: https://app.ubuntuafyalink.co.tz/status\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendSystemDowntimeAlertSMS(userPhone: string, details: {
  issue: string;
  estimatedResolution: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🚨 AfyaLink: System Downtime Alert\n\n` +
    `We're experiencing technical issues:\n\n` +
    `Issue: ${details.issue}\n` +
    `Estimated Resolution: ${details.estimatedResolution}\n\n` +
    `Our team is working to resolve this quickly.\n` +
    `Status: https://app.ubuntuafyalink.co.tz/status\n\n` +
    `Thank you for your patience! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}

export async function sendSecurityBreachAlertSMS(userPhone: string, details: {
  threat: string;
  actionRequired: string;
}): Promise<{ success: boolean; message: string }> {
  const message = `🚨 AfyaLink: Security Alert\n\n` +
    `Security threat detected:\n\n` +
    `Threat: ${details.threat}\n` +
    `Action Required: ${details.actionRequired}\n\n` +
    `Please take immediate action to secure your account.\n` +
    `Security: https://app.ubuntuafyalink.co.tz/security\n\n` +
    `Thank you! - AfyaLink Team`;

  return sendSMS({
    to: userPhone,
    message,
    sender: 'Afyalink'
  });
}