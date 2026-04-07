import { maintenanceQuotes } from '@/lib/db/schema'
import { getMaintenanceSettings } from '@/lib/settings/visibility-settings'

type QuoteRow = typeof maintenanceQuotes.$inferSelect

const REPORT_VERSION = 'tech_report_v1'

interface ReportDetailsPayload {
  version: string
  shortReport: string
  estimatedTime: string
  maintenanceCost: number
  equipmentNeeded?: string | null
}

export interface ReportDetails {
  summary: string
  estimatedTime: string
  maintenanceCost: string
  equipmentNeeded?: string | null
}

export function serializeReportDetails(details: {
  shortReport: string
  estimatedTime: string
  maintenanceCost: number
  equipmentNeeded?: string | null
}): string {
  const payload: ReportDetailsPayload = {
    version: REPORT_VERSION,
    shortReport: details.shortReport,
    estimatedTime: details.estimatedTime,
    maintenanceCost: details.maintenanceCost,
    equipmentNeeded: details.equipmentNeeded || null,
  }
  return JSON.stringify(payload)
}

function parseReportDetails(raw?: string | null): ReportDetails | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ReportDetailsPayload
    if (parsed?.version === REPORT_VERSION) {
      return {
        summary: parsed.shortReport,
        estimatedTime: parsed.estimatedTime,
        maintenanceCost: parsed.maintenanceCost?.toString() ?? '',
        equipmentNeeded: parsed.equipmentNeeded || null,
      }
    }
  } catch {
    // ignore - treat as plain text
  }
  return null
}

export function formatQuoteResponse(quote: QuoteRow | null) {
  if (!quote) return null
  const reportDetails = parseReportDetails(quote.description)
  return {
    ...quote,
    description: reportDetails?.summary ?? quote.description,
    reportDetails,
  }
}

export function shouldQuoteBeVisibleToFacility(quote: ReturnType<typeof formatQuoteResponse> | null) {
  if (!quote) return false
  const settings = getMaintenanceSettings()
  if (settings.quoteVisibility === 'always_visible') return true
  if (settings.quoteVisibility === 'admin_only') return false
  // Default: show quotes (and report details) as soon as the technician submits them
  return quote.status === 'approved' || quote.status === 'pending'
}

