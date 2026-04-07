/**
 * Status Transition Validation for Maintenance Plans
 * Ensures only valid status transitions are allowed
 */

export type RequestStatus = 
  | 'pending'
  | 'technician_assigned'
  | 'evaluation_in_progress'
  | 'proposal_submitted'
  | 'admin_approved'
  | 'facility_approved'
  | 'facility_rejected'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'active'
  | 'cancelled'

export type ProposalStatus = 
  | 'draft'
  | 'submitted'
  | 'admin_approved'
  | 'admin_rejected'
  | 'facility_approved'
  | 'facility_rejected'

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'confirmed'
  | 'failed'
  | 'refunded'

/**
 * Valid status transitions for requests
 */
const REQUEST_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['technician_assigned', 'cancelled'],
  technician_assigned: ['evaluation_in_progress', 'cancelled'],
  evaluation_in_progress: ['proposal_submitted', 'cancelled'],
  proposal_submitted: ['admin_approved', 'evaluation_in_progress', 'cancelled'], // admin_rejected goes back to evaluation_in_progress
  admin_approved: ['facility_approved', 'facility_rejected', 'cancelled'],
  facility_approved: ['payment_pending', 'cancelled'],
  facility_rejected: ['cancelled'],
  payment_pending: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['active'],
  active: ['cancelled'],
  cancelled: [], // Terminal state
}

// Allow direct transition from pending to evaluation_in_progress when assigning technician
// This is a convenience transition that combines technician_assigned + evaluation_in_progress
const ALLOWED_DIRECT_TRANSITIONS: Array<[RequestStatus, RequestStatus]> = [
  ['pending', 'evaluation_in_progress'], // When admin assigns technician, go directly to evaluation
]

/**
 * Valid status transitions for proposals
 */
const PROPOSAL_STATUS_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['submitted'],
  submitted: ['admin_approved', 'admin_rejected'],
  admin_approved: ['facility_approved', 'facility_rejected'],
  admin_rejected: [], // Terminal state
  facility_approved: [], // Terminal state (leads to payment)
  facility_rejected: [], // Terminal state
}

/**
 * Valid status transitions for payments
 */
const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['paid', 'failed'],
  paid: ['confirmed', 'failed', 'refunded'],
  confirmed: ['refunded'], // Can refund even after confirmation
  failed: ['pending'], // Can retry
  refunded: [], // Terminal state
}

/**
 * Check if a status transition is valid
 */
export function isValidRequestTransition(
  from: RequestStatus,
  to: RequestStatus
): boolean {
  // Check direct transitions first
  if (ALLOWED_DIRECT_TRANSITIONS.some(([f, t]) => f === from && t === to)) {
    return true
  }
  // Check normal transitions
  return REQUEST_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function isValidProposalTransition(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  return PROPOSAL_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function isValidPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get allowed next statuses for a given status
 */
export function getAllowedNextStatuses(
  entityType: 'request' | 'proposal' | 'payment',
  currentStatus: string
): string[] {
  switch (entityType) {
    case 'request':
      return REQUEST_STATUS_TRANSITIONS[currentStatus as RequestStatus] || []
    case 'proposal':
      return PROPOSAL_STATUS_TRANSITIONS[currentStatus as ProposalStatus] || []
    case 'payment':
      return PAYMENT_STATUS_TRANSITIONS[currentStatus as PaymentStatus] || []
    default:
      return []
  }
}

/**
 * Validate status transition and throw error if invalid
 */
export function validateRequestTransition(
  from: RequestStatus,
  to: RequestStatus
): void {
  if (!isValidRequestTransition(from, to)) {
    throw new Error(
      `Invalid status transition: Cannot change from "${from}" to "${to}". ` +
      `Allowed transitions: ${REQUEST_STATUS_TRANSITIONS[from]?.join(', ') || 'none'}`
    )
  }
}

export function validateProposalTransition(
  from: ProposalStatus,
  to: ProposalStatus
): void {
  if (!isValidProposalTransition(from, to)) {
    throw new Error(
      `Invalid status transition: Cannot change from "${from}" to "${to}". ` +
      `Allowed transitions: ${PROPOSAL_STATUS_TRANSITIONS[from]?.join(', ') || 'none'}`
    )
  }
}

export function validatePaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus
): void {
  if (!isValidPaymentTransition(from, to)) {
    throw new Error(
      `Invalid status transition: Cannot change from "${from}" to "${to}". ` +
      `Allowed transitions: ${PAYMENT_STATUS_TRANSITIONS[from]?.join(', ') || 'none'}`
    )
  }
}

/**
 * Get status description for UI
 */
export function getStatusDescription(
  entityType: 'request' | 'proposal' | 'payment',
  status: string
): string {
  const descriptions: Record<string, Record<string, string>> = {
    request: {
      pending: 'Request submitted and awaiting technician assignment',
      technician_assigned: 'Technician has been assigned to evaluate the request',
      evaluation_in_progress: 'Technician is evaluating equipment and preparing proposal',
      proposal_submitted: 'Technician has submitted a maintenance plan proposal',
      admin_approved: 'Admin has approved the proposal, awaiting facility review',
      facility_approved: 'Facility has approved the proposal, payment required',
      facility_rejected: 'Facility has rejected the proposal',
      payment_pending: 'Payment is pending confirmation',
      payment_confirmed: 'Payment has been confirmed by admin',
      active: 'Maintenance plan is now active',
      cancelled: 'Request has been cancelled',
    },
    proposal: {
      draft: 'Proposal is being prepared',
      submitted: 'Proposal submitted to admin for review',
      admin_approved: 'Proposal approved by admin',
      admin_rejected: 'Proposal rejected by admin',
      facility_approved: 'Proposal approved by facility',
      facility_rejected: 'Proposal rejected by facility',
    },
    payment: {
      pending: 'Payment is pending',
      paid: 'Payment has been made',
      confirmed: 'Payment confirmed by admin',
      failed: 'Payment failed',
      refunded: 'Payment has been refunded',
    },
  }

  return descriptions[entityType]?.[status] || 'Unknown status'
}
