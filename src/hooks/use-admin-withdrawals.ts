import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface Withdrawal {
  id: string
  technicianId: string
  amount: string
  currency: string
  withdrawalMethod: string | null
  accountDetails: any
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled'
  adminNotes: string | null
  processedAt: Date | null
  processedBy: string | null
  createdAt: Date
  updatedAt: Date
  technician?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  }
}

interface WithdrawalsResponse {
  success: boolean
  data: Withdrawal[]
  counts: {
    pending: number
  }
}

/**
 * Get all withdrawals (admin only)
 */
export function useAdminWithdrawals(status?: string) {
  return useQuery<WithdrawalsResponse>({
    queryKey: ['admin-withdrawals', status],
    queryFn: async () => {
      const url = status && status !== 'all' 
        ? `/api/admin/withdrawals?status=${status}`
        : '/api/admin/withdrawals'
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch withdrawals')
      }
      return response.json()
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  })
}

/**
 * Update withdrawal status
 */
export function useUpdateWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      const response = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update withdrawal')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate all withdrawal queries
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] })
      // Also invalidate technician balance queries
      queryClient.invalidateQueries({ queryKey: ['technician-balance'] })
      queryClient.invalidateQueries({ queryKey: ['technician-withdrawals'] })
      toast.success('Withdrawal status updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update withdrawal')
    },
  })
}
