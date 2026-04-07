import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { Payment } from '@/types'

/**
 * Fetch payments for a facility
 */
export function usePayments(facilityId?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['payments', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.append('facilityId', facilityId)

      const response = await fetch(`/api/payments?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch payments')

      const result = await response.json()
      // Handle the actual API response structure
      return result.payments || []
    },
    enabled: !!session && !!facilityId,
    initialData: [], // Provide initial data to prevent undefined
  })
}

/**
 * Create a new payment
 */
export function useCreatePayment() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  return useMutation({
    mutationFn: async (data: { amount: number; method: string }) => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          facilityId: session?.user.facilityId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['facility'] })
    },
  })
}

