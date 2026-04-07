import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { ServiceJob } from '@/types'

/**
 * Fetch service jobs
 */
export function useServiceJobs(facilityId?: string, technicianId?: string, status?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['service-jobs', facilityId, technicianId, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.append('facilityId', facilityId)
      if (technicianId) params.append('technicianId', technicianId)
      if (status) params.append('status', status)

      const response = await fetch(`/api/service-jobs?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch service jobs')

      const result = await response.json()
      return result.data as ServiceJob[]
    },
    enabled: !!session && !!(technicianId || facilityId || session.user),
  })
}

/**
 * Create a new service job
 */
export function useCreateServiceJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<ServiceJob>) => {
      const response = await fetch('/api/service-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create service job')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-jobs'] })
    },
  })
}

