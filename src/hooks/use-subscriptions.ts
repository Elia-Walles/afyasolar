import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { notifyError, notifySuccess } from "@/lib/toast-feedback"
import { getErrorMessage } from "@/lib/get-error-message"

interface Subscription {
  id: string
  facilityId: string
  serviceName: string
  status: 'active' | 'expired' | 'cancelled' | 'pending'
  planType?: string | null
  startDate: Date | string
  expiryDate?: Date | string | null
  isActive?: boolean
}

interface SubscriptionCheck {
  hasAccess: boolean
  subscription: Subscription | null
  message: string
}

export function useSubscriptions(facilityId?: string) {
  return useQuery<Subscription[]>({
    queryKey: ["subscriptions", facilityId],
    queryFn: async () => {
      const response = await fetch("/api/subscriptions")
      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions")
      }
      const data = await response.json()
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.data)) return data.data
      return []
    },
    enabled: !!facilityId,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  })
}

export function useSubscriptionCheck(serviceName: string, facilityId?: string) {
  return useQuery<SubscriptionCheck>({
    queryKey: ["subscription-check", serviceName, facilityId],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions/check?service=${serviceName}`)
      if (!response.ok) {
        throw new Error("Failed to check subscription")
      }
      return response.json()
    },
    enabled: !!facilityId && !!serviceName,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  })
}

export function useSubscribe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      serviceName: string
      planType?: string
      billingCycle?: string
      amount?: number
      paymentMethod?: string
      facilityId?: string
      packageName?: string
      packageCode?: string
      packageRatedKw?: number
      totalPackagePrice?: number
    }) => {
      // First, create the regular subscription
      const subscriptionResponse = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceName: data.serviceName,
          planType: data.planType,
          billingCycle: data.billingCycle,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
        }),
      })

      if (!subscriptionResponse.ok) {
        const error = await subscriptionResponse.json()
        throw new Error(error.error || "Failed to subscribe")
      }

      const subscriptionResult = await subscriptionResponse.json()

      // If this is an Afya Solar subscription, also create a subscriber record
      if (data.serviceName === 'afya-solar' && data.facilityId && data.packageName) {
        try {
          // Get facility information
          const facilityResponse = await fetch(`/api/facility/${data.facilityId}`)
          const facilityData = facilityResponse.ok ? await facilityResponse.json() : { data: {} }

          // Create Afya Solar subscriber record
          const subscriberResponse = await fetch('/api/afyasolar/subscribers/auto-create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              facilityId: data.facilityId,
              facilityName: facilityData.data?.name || 'Unknown Facility',
              facilityEmail: facilityData.data?.email || '',
              facilityPhone: facilityData.data?.phone || '',
              packageId: data.packageCode || 'PKG_10KW',
              packageName: data.packageName,
              packageCode: data.packageCode || 'PKG_10KW',
              packageRatedKw: data.packageRatedKw || 10,
              planType: data.planType === 'full' ? 'CASH' : data.planType === 'installment' ? 'INSTALLMENT' : 'PAAS',
              totalPackagePrice: data.totalPackagePrice || 14900000,
              paymentMethod: data.paymentMethod
            }),
          })

          if (!subscriberResponse.ok) {
            console.error('Failed to create Afya Solar subscriber record:', await subscriberResponse.json())
          }
        } catch (error) {
          console.error('Error creating Afya Solar subscriber record:', error)
        }
      }

      return subscriptionResult
    },
    onSuccess: (_, variables) => {
      notifySuccess(
        "Subscription updated",
        variables.serviceName === "afya-solar" ? "Your Afya Solar subscription is active." : "Your subscription was saved."
      )
      // Invalidate all subscription-related queries
      queryClient.invalidateQueries({ queryKey: ["subscriptions"], exact: false })
      queryClient.invalidateQueries({ queryKey: ["subscription-check"], exact: false })
      queryClient.invalidateQueries({ queryKey: ["afya-solar-subscribers"], exact: false })
      // Also refetch immediately
      queryClient.refetchQueries({ queryKey: ["subscriptions"], exact: false })
      queryClient.refetchQueries({ queryKey: ["subscription-check"], exact: false })
      queryClient.refetchQueries({ queryKey: ["afya-solar-subscribers"], exact: false })
    },
    onError: (e) => {
      notifyError("Subscription failed", getErrorMessage(e))
    },
  })
}

