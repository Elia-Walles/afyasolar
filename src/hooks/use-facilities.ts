import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import type { Facility } from '@/types'

/**
 * Comprehensive facility data with statistics
 */
export interface ComprehensiveFacility extends Facility {
  deviceCount: number
  activeDevices: number
  inactiveDevices: number
  userCount: number
  departmentCount: number
  doctorCount: number
  totalAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  completedAppointments: number
  totalPayments: number
  completedPayments: number
  pendingPayments: number
  failedPayments: number
  totalPaidAmount: number
  lastLoginAt?: Date | null
  acceptTerms?: boolean
  emailVerified?: boolean
}

/**
 * Fetch facilities
 */
export function useFacilities() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const response = await fetch('/api/facilities')
      if (!response.ok) throw new Error('Failed to fetch facilities')

      const result = await response.json()
      return result.data as Facility[]
    },
    enabled: !!session,
  })
}

/**
 * Fetch comprehensive facilities data (admin only)
 * Includes device counts, user counts, department counts, appointment stats, etc.
 */
export function useComprehensiveFacilities(search?: string, statusFilter?: string) {
  const { data: session } = useSession()

  return useQuery<ComprehensiveFacility[]>({
    queryKey: ['comprehensive-facilities', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)

      const response = await fetch(`/api/admin/facilities/comprehensive?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch comprehensive facilities data')

      const result = await response.json()
      return result.data as ComprehensiveFacility[]
    },
    enabled: !!session && session.user.role === 'admin',
  })
}

/**
 * Fetch a single facility
 */
export function useFacility(facilityId?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['facility', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.append('id', facilityId)

      const response = await fetch(`/api/facilities?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch facility')

      const result = await response.json()
      return result.data as Facility
    },
    enabled: !!session && !!facilityId,
  })
}

/**
 * Create a new facility (admin only)
 */
export function useCreateFacility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<Facility>) => {
      const response = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create facility')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
  })
}

/**
 * Update facility booking settings (slug, toggle, whatsapp)
 */
export function useUpdateFacilityBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      facilityId?: string
      bookingSlug?: string
      isBookingEnabled?: boolean
      bookingWhatsappNumber?: string | null
      bookingTimezone?: string
      themePreset?: 'classic-emerald' | 'clean-light' | 'image-hero'
      paymentEnabled?: boolean
      paymentAmount?: number
      paymentMethods?: {
        lipa_kwa_simu?: { enabled: boolean; phoneNumber?: string; instructions?: string }
        bank?: { enabled: boolean; bankName?: string; accountNumber?: string; accountName?: string; instructions?: string }
        mobile_money?: { enabled: boolean; provider?: string; phoneNumber?: string; instructions?: string }
      }
    }) => {
      const response = await fetch('/api/booking/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to update booking settings')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      toast.success('Booking settings updated')
      // Invalidate booking settings query to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['facility-booking-settings'] })
      if (variables.facilityId) {
        queryClient.invalidateQueries({ queryKey: ['facility', variables.facilityId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['facility'] })
      }
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update booking settings')
    },
  })
}

