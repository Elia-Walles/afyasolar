/**
 * Email notification templates for maintenance plan workflow
 */

export interface EmailData {
  recipientName: string
  recipientEmail: string
  requestNumber?: string
  proposalId?: string
  facilityName?: string
  technicianName?: string
  totalCost?: number
  reason?: string
  [key: string]: any
}

export const emailTemplates = {
  /**
   * Request submitted - notify admin
   */
  requestSubmitted: (data: EmailData) => ({
    subject: `New Maintenance Plan Request: ${data.requestNumber}`,
    html: `
      <h2>New Maintenance Plan Request</h2>
      <p>Hello Admin,</p>
      <p>A new maintenance plan request has been submitted:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Facility:</strong> ${data.facilityName}</li>
        <li><strong>Equipment Items:</strong> ${data.equipmentCount || 'N/A'}</li>
      </ul>
      <p>Please review and assign a technician.</p>
      <p><a href="${data.dashboardUrl}">View Request</a></p>
    `,
    text: `
      New Maintenance Plan Request: ${data.requestNumber}
      
      Facility: ${data.facilityName}
      Equipment Items: ${data.equipmentCount || 'N/A'}
      
      Please review and assign a technician.
      View: ${data.dashboardUrl}
    `,
  }),

  /**
   * Technician assigned - notify technician
   */
  technicianAssigned: (data: EmailData) => ({
    subject: `New Maintenance Plan Assignment: ${data.requestNumber}`,
    html: `
      <h2>New Assignment</h2>
      <p>Hello ${data.technicianName},</p>
      <p>You have been assigned to evaluate a maintenance plan request:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Facility:</strong> ${data.facilityName}</li>
        <li><strong>Equipment Items:</strong> ${data.equipmentCount || 'N/A'}</li>
      </ul>
      <p>Please review the equipment and submit a proposal.</p>
      <p><a href="${data.dashboardUrl}">View Request</a></p>
    `,
    text: `
      New Assignment: ${data.requestNumber}
      
      Facility: ${data.facilityName}
      Equipment Items: ${data.equipmentCount || 'N/A'}
      
      Please review and submit a proposal.
      View: ${data.dashboardUrl}
    `,
  }),

  /**
   * Proposal submitted - notify admin
   */
  proposalSubmitted: (data: EmailData) => ({
    subject: `Proposal Submitted: ${data.requestNumber}`,
    html: `
      <h2>Proposal Submitted</h2>
      <p>Hello Admin,</p>
      <p>A maintenance plan proposal has been submitted:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Technician:</strong> ${data.technicianName}</li>
        <li><strong>Total Cost:</strong> ${data.totalCost ? `TZS ${data.totalCost.toLocaleString()}` : 'N/A'}</li>
      </ul>
      <p>Please review and approve or reject the proposal.</p>
      <p><a href="${data.dashboardUrl}">Review Proposal</a></p>
    `,
    text: `
      Proposal Submitted: ${data.requestNumber}
      
      Technician: ${data.technicianName}
      Total Cost: ${data.totalCost ? `TZS ${data.totalCost.toLocaleString()}` : 'N/A'}
      
      Please review the proposal.
      View: ${data.dashboardUrl}
    `,
  }),

  /**
   * Proposal approved by admin - notify facility and technician
   */
  proposalApproved: (data: EmailData) => ({
    subject: `Proposal Approved: ${data.requestNumber}`,
    html: `
      <h2>Proposal Approved</h2>
      <p>Hello ${data.recipientName},</p>
      <p>The maintenance plan proposal has been approved by admin:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Total Cost:</strong> ${data.totalCost ? `TZS ${data.totalCost.toLocaleString()}` : 'N/A'}</li>
      </ul>
      <p>${data.recipientRole === 'facility' ? 'Please review and approve the proposal to proceed with payment.' : 'The proposal is now awaiting facility approval.'}</p>
      <p><a href="${data.dashboardUrl}">View Proposal</a></p>
    `,
    text: `
      Proposal Approved: ${data.requestNumber}
      
      Total Cost: ${data.totalCost ? `TZS ${data.totalCost.toLocaleString()}` : 'N/A'}
      
      ${data.recipientRole === 'facility' ? 'Please review and approve to proceed with payment.' : 'Awaiting facility approval.'}
      View: ${data.dashboardUrl}
    `,
  }),

  /**
   * Proposal rejected by admin - notify technician
   */
  proposalRejected: (data: EmailData) => ({
    subject: `Proposal Rejected: ${data.requestNumber}`,
    html: `
      <h2>Proposal Rejected</h2>
      <p>Hello ${data.technicianName},</p>
      <p>Your maintenance plan proposal has been rejected:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Reason:</strong> ${data.reason || 'No reason provided'}</li>
      </ul>
      <p>Please review and resubmit if needed.</p>
      <p><a href="${data.dashboardUrl}">View Request</a></p>
    `,
    text: `
      Proposal Rejected: ${data.requestNumber}
      
      Reason: ${data.reason || 'No reason provided'}
      
      Please review and resubmit if needed.
      View: ${data.dashboardUrl}
    `,
  }),

  /**
   * Payment required - notify facility
   */
  paymentRequired: (data: EmailData) => ({
    subject: `Payment Required: ${data.requestNumber}`,
    html: `
      <h2>Payment Required</h2>
      <p>Hello ${data.recipientName},</p>
      <p>Payment is required for your approved maintenance plan:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Total Amount:</strong> ${data.totalCost ? `TZS ${data.totalCost.toLocaleString()}` : 'N/A'}</li>
      </ul>
      <p>You can pay half or the full amount. Please proceed with payment.</p>
      <p><a href="${data.dashboardUrl}">Make Payment</a></p>
    `,
    text: `
      Payment Required: ${data.requestNumber}
      
      Total Amount: ${data.totalCost ? `TZS ${data.totalCost.toLocaleString()}` : 'N/A'}
      
      Please proceed with payment.
      View: ${data.dashboardUrl}
    `,
  }),

  /**
   * Payment confirmed - notify facility
   */
  paymentConfirmed: (data: EmailData) => ({
    subject: `Payment Confirmed: ${data.requestNumber}`,
    html: `
      <h2>Payment Confirmed</h2>
      <p>Hello ${data.recipientName},</p>
      <p>Your payment has been confirmed:</p>
      <ul>
        <li><strong>Request Number:</strong> ${data.requestNumber}</li>
        <li><strong>Amount Paid:</strong> ${data.amountPaid ? `TZS ${data.amountPaid.toLocaleString()}` : 'N/A'}</li>
      </ul>
      <p>Your maintenance plan is now active.</p>
      <p><a href="${data.dashboardUrl}">View Plan</a></p>
    `,
    text: `
      Payment Confirmed: ${data.requestNumber}
      
      Amount Paid: ${data.amountPaid ? `TZS ${data.amountPaid.toLocaleString()}` : 'N/A'}
      
      Your maintenance plan is now active.
      View: ${data.dashboardUrl}
    `,
  }),
}

/**
 * Send email notification (placeholder - integrate with your email service)
 */
export async function sendEmailNotification(
  template: keyof typeof emailTemplates,
  data: EmailData
): Promise<void> {
  // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  const emailContent = emailTemplates[template](data)
  
  console.log('Email notification:', {
    to: data.recipientEmail,
    subject: emailContent.subject,
    template,
  })

  // Example integration:
  // await sendGrid.send({
  //   to: data.recipientEmail,
  //   from: 'noreply@afyalink.com',
  //   subject: emailContent.subject,
  //   html: emailContent.html,
  //   text: emailContent.text,
  // })
}
