export type QuoteVisibilityPolicy = 'admin_only' | 'facility_after_approval' | 'always_visible'
export type CommentDefaultVisibility = 'internal' | 'facility' | 'technician'

export interface MaintenanceWorkflowSettings {
  quoteVisibility: QuoteVisibilityPolicy
  requireReportBeforeQuote: boolean
  commentDefaults: {
    admin: CommentDefaultVisibility
    technician: CommentDefaultVisibility
    facility: CommentDefaultVisibility
  }
  reminders: {
    reportDueHours: number
    quoteDueHours: number
  }
}

const defaultSettings: MaintenanceWorkflowSettings = {
  quoteVisibility: 'facility_after_approval',
  requireReportBeforeQuote: true,
  commentDefaults: {
    admin: 'internal',
    technician: 'technician',
    facility: 'facility',
  },
  reminders: {
    reportDueHours: 24,
    quoteDueHours: 48,
  },
}

let currentSettings = defaultSettings

export function getMaintenanceSettings(): MaintenanceWorkflowSettings {
  return currentSettings
}

type MaintenanceSettingsUpdate = Partial<Omit<MaintenanceWorkflowSettings, 'commentDefaults' | 'reminders'>> & {
  commentDefaults?: Partial<MaintenanceWorkflowSettings['commentDefaults']>
  reminders?: Partial<MaintenanceWorkflowSettings['reminders']>
}

export function updateMaintenanceSettings(partial: MaintenanceSettingsUpdate) {
  currentSettings = {
    ...currentSettings,
    ...partial,
    commentDefaults: {
      ...currentSettings.commentDefaults,
      ...(partial.commentDefaults || {}),
    },
    reminders: {
      ...currentSettings.reminders,
      ...(partial.reminders || {}),
    },
  }
}

