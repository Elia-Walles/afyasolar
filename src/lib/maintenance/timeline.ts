import { MaintenanceRequest } from '@/hooks/use-maintenance'

export interface TimelineEntry {
  label: string
  timestamp?: Date | string | null
  completed: boolean
}

export function buildMaintenanceTimeline(request: MaintenanceRequest): TimelineEntry[] {
  const steps: Array<[keyof MaintenanceRequest | null, string]> = [
    ['createdAt', 'Submitted'],
    ['assignedAt', 'Technician Assigned'],
    ['confirmedAt', 'Technician Confirmed'],
    ['quoteSubmittedAt', 'Report Submitted'],
    ['quoteApprovedAt', 'Admin Approved'],
    ['quoteAcceptedAt', 'Facility Approved'],
    ['advancePaidAt', 'Advance Paid'],
    ['startedAt', 'Work Started'],
    ['completedAt', 'Work Completed'],
    ['reportApprovedAt', 'Final Report Approved'],
    ['paymentCompletedAt', 'Final Payment Completed'],
  ]

  return steps.map(([field, label]) => {
    const timestamp = field ? (request as any)[field] : null
    return {
      label,
      timestamp,
      completed: Boolean(timestamp),
    }
  })
}

export function describeFacilityStatus(request: MaintenanceRequest): {
  title: string
  description: string
  intent: 'info' | 'warning' | 'success'
} {
  switch (request.status) {
    case 'pending':
      return {
        title: 'Awaiting Admin Review',
        description: 'Your request was submitted and is waiting for an AfyaSolar admin to assign a technician.',
        intent: 'info',
      }
    case 'engineer_assigned':
      return {
        title: 'Technician Assigned',
        description: 'The assigned technician will review your issue and share an initial assessment shortly.',
        intent: 'info',
      }
    case 'engineer_confirmed':
    case 'under_inspection':
    case 'quote_submitted':
      return {
        title: 'Assessment In Progress',
        description: 'The technician is preparing an assessment. You will be notified after admin review.',
        intent: 'warning',
      }
    case 'quote_approved':
      return {
        title: 'Quote Ready',
        description: 'AfyaSolar approved the assessment. Please review and accept to proceed.',
        intent: 'info',
      }
    case 'quote_accepted':
      return {
        title: 'Quote Accepted',
        description: 'Advance invoice is being prepared. You will receive payment instructions shortly.',
        intent: 'info',
      }
    case 'advance_due':
      return {
        title: 'Advance Payment Required',
        description: 'Pay the spare parts deposit so the technician can begin work.',
        intent: 'warning',
      }
    case 'advance_paid':
      return {
        title: 'Advance Recorded',
        description: 'Advance payment received. We are scheduling the technician to start work.',
        intent: 'info',
      }
    case 'in_progress':
      return {
        title: 'Work Scheduled',
        description: 'The technician is scheduled to work on this request.',
        intent: 'info',
      }
    case 'report_submitted':
      return {
        title: 'Final Report Submitted',
        description: 'Technician has submitted the final report. Admin is reviewing the findings.',
        intent: 'warning',
      }
    case 'report_approved':
      return {
        title: 'Report Approved',
        description: 'AfyaSolar approved the completion report. Please review and accept before making payment.',
        intent: 'info',
      }
    case 'final_payment_due':
      return {
        title: 'Final Payment Required',
        description: 'Please settle the remaining balance to close this service request.',
        intent: 'warning',
      }
    case 'completed':
      if (request.paymentCompletedAt) {
        return {
          title: 'Payment Recorded',
          description: 'Your payment has been recorded. You can now leave a review for this service.',
          intent: 'success',
        }
      }
      return {
        title: 'Work Completed',
        description: 'Technician has completed the work. Please complete payment to close the request.',
        intent: 'warning',
      }
    case 'reviewed':
      return {
        title: request.paymentCompletedAt ? 'Deal Closed' : 'Work Completed',
        description: request.paymentCompletedAt
          ? 'Payment is complete and the case is closed. Thank you for partnering with AfyaSolar.'
          : 'This request has been completed. Kindly leave a review.',
        intent: 'success',
      }
    default:
      return {
        title: 'Request Updated',
        description: 'The request status has changed. Check the timeline for details.',
        intent: 'info',
      }
  }
}

export function getTechnicianActionSummary(requests: MaintenanceRequest[]) {
  const pendingAssignments = requests.filter(r => r.status === 'engineer_assigned').length
  const pendingReports = requests.filter(r => r.status === 'engineer_confirmed').length
  const pendingQuotes = requests.filter(r => r.status === 'under_inspection').length
  return {
    pendingAssignments,
    pendingReports,
    pendingQuotes,
  }
}

