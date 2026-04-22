import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

export type AfyaSolarSubscriptionPaymentHistoryRow = {
  id: string
  createdAt: string | Date
  amount: string
  currency: string
  status: string
  billingCycle: string
  periodStart: string | Date
  periodEnd: string | Date
  isRenewal: boolean
  transactionStatus: string | null
  transactionId: string | null
}

export interface AfyaSolarSubscriber {
  id: string
  name: string
  city: string
  region: string
  status: 'active' | 'inactive' | 'low_credit' | 'suspended'
  creditBalance: number
  monthlyConsumption: number
  systemSize?: string
  subscriptionStatus: 'active' | 'expired' | 'trial'
  subscriptionExpiry?: string
  lastPaymentDate?: string
  monthlyRevenue?: number
  totalEnergyConsumption?: number
  smartmeterSerial?: string
  contactEmail?: string
  contactPhone?: string
  registeredDate: string
  subscriptionId?: string
  subscriptionStartDate?: string
  subscriptionAmount?: number
  packageName?: string
  packageId?: string
  paymentStatus?: string
  /** Present on single-facility admin subscriber detail. */
  subscriptionPaymentHistory?: AfyaSolarSubscriptionPaymentHistoryRow[]
}

/**
 * Fetch facilities with Afya Solar subscriptions
 */
export function useAfyaSolarSubscribers() {
  const { data: session } = useSession()

  return useQuery<AfyaSolarSubscriber[]>({
    queryKey: ['afya-solar-subscribers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/afya-solar/subscribers')
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch Afya Solar subscribers:', response.status, response.statusText, errorText)
        throw new Error(`Failed to fetch Afya Solar subscribers: ${response.status}`)
      }
      
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch subscribers')
      }
      
      return result.data as AfyaSolarSubscriber[]
    },
    enabled: !!session && session.user.role === 'admin',
    staleTime: 30_000, // 30 seconds - reduced for more fresh data
    refetchInterval: 60_000, // 1 minute
    retry: (failureCount, error: any) => {
      // Retry on network errors but not on auth errors
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        return false
      }
      return failureCount < 2 // Max 2 retries
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Max 5 seconds
  })
}

/**
 * Fetch a single Afya Solar subscriber with detailed data
 */
export function useAfyaSolarSubscriber(facilityId?: string) {
  const { data: session } = useSession()

  return useQuery<AfyaSolarSubscriber>({
    queryKey: ['afya-solar-subscriber', facilityId],
    queryFn: async () => {
      if (!facilityId) throw new Error('Facility ID is required')

      const response = await fetch(`/api/admin/afya-solar/subscribers/${facilityId}`)
      if (!response.ok) throw new Error('Failed to fetch subscriber details')

      const result = await response.json()
      return result.data as AfyaSolarSubscriber
    },
    enabled: !!session && session.user.role === 'admin' && !!facilityId,
  })
}
