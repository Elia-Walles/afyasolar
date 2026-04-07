import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { Device } from '@/types'

/**
 * Fetch devices for a facility
 */
export function useDevices(facilityId?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['devices', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.append('facilityId', facilityId)

      const response = await fetch(`/api/devices?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch devices')

      const result = await response.json()
      return result.data as Device[]
    },
    enabled: !!session && !!facilityId,
  })
}

/**
 * Claim a new device
 */
export function useClaimDevice() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  return useMutation({
    mutationFn: async (data: { serialPrefix: string; serialSuffix: string; deviceType: string }) => {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          facilityId: session?.user.facilityId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to claim device')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

