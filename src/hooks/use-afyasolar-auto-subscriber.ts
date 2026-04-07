import { useMutation, useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

// Hook to automatically create subscriber record when Afya Solar subscription is created
export function useAfyaSolarAutoSubscriber() {
  const { data: session } = useSession()
  
  const createSubscriberMutation = useMutation({
    mutationFn: async (subscriptionData: {
      facilityId: string
      facilityName: string
      facilityEmail?: string
      facilityPhone?: string
      packageId: string
      packageName: string
      packageCode: string
      packageRatedKw: number
      planType: 'CASH' | 'INSTALLMENT' | 'PAAS'
      totalPackagePrice: number
      paymentMethod?: string
    }) => {
      const response = await fetch('/api/afyasolar/subscribers/auto-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create Afya Solar subscriber record')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      console.log('✅ Afya Solar subscriber record created automatically:', data)
    },
    onError: (error) => {
      console.error('❌ Failed to create Afya Solar subscriber record:', error)
    }
  })
  
  return createSubscriberMutation
}

// Hook to check if user already has an Afya Solar subscriber record
export function useAfyaSolarSubscriberExists(facilityId?: string) {
  return useQuery({
    queryKey: ['afya-solar-subscriber-exists', facilityId],
    queryFn: async () => {
      if (!facilityId) return null
      
      const response = await fetch(`/api/afyasolar/subscribers?facilityId=${facilityId}`)
      if (!response.ok) {
        throw new Error('Failed to check Afya Solar subscriber status')
      }
      const result = await response.json()
      
      return result.success && result.data?.subscribers?.length > 0 
        ? result.data.subscribers[0] 
        : null
    },
    enabled: !!facilityId,
  })
}

// Hook to sync existing Afya Solar subscriptions to the new table
export function useSyncAfyaSolarSubscriptions() {
  const { data: session } = useSession()
  
  const syncMutation = useMutation({
    mutationFn: async (facilityId: string) => {
      const response = await fetch('/api/afyasolar/subscribers/sync-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ facilityId }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sync Afya Solar subscriptions')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      console.log('✅ Afya Solar subscriptions synced:', data)
    },
    onError: (error) => {
      console.error('❌ Failed to sync Afya Solar subscriptions:', error)
    }
  })
  
  return syncMutation
}
