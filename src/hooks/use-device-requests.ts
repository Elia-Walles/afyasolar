import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

export interface DeviceRequest {
  id: string
  facilityId?: string | null
  userId?: string | null
  name: string
  email: string
  phone: string
  facilityName?: string | null
  deviceType?: string | null
  quantity: number
  message?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled'
  adminNotes?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export function useDeviceRequests(status?: string) {
  const { data: session } = useSession()

  return useQuery<DeviceRequest[]>({
    queryKey: ['device-requests', status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.append('status', status)

      const response = await fetch(`/api/device-requests?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch device requests')

      const result = await response.json()
      return result.data || []
    },
    enabled: !!session,
  })
}

export function useUpdateDeviceRequest() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  return useMutation({
    mutationFn: async (data: { id: string; status: string; adminNotes?: string }) => {
      const response = await fetch('/api/device-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update device request')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-requests'] })
    },
  })
}

