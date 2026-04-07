export type VisitType = 'standalone' | 'widget'

export interface VisitRecord {
  id: string
  facilityId: string
  visitType: VisitType
  referrer?: string | null
  userAgent?: string | null
  ipAddress?: string | null
  sessionId?: string | null
  selectedDepartment: boolean
  selectedDoctor: boolean
  selectedTimeSlot: boolean
  confirmedBooking: boolean
  createdAt: string
}

export interface VisitStats {
  totalVisits: number
  widgetVisits: number
  standaloneVisits: number
  conversionRate: number
  selectionRate: number
  doctorSelectionRate: number
  slotSelectionRate: number
  bookingRate: number
}

