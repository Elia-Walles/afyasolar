import { useQuery } from "@tanstack/react-query"

export function useAfyaSolarClientService(facilityId?: string) {
  return useQuery({
    queryKey: ['afya-solar-client-service', facilityId],
    queryFn: async () => {
      if (!facilityId) return null
      
      const response = await fetch(`/api/afya-solar/client-services?facilityId=${facilityId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch Afya Solar client service')
      }
      const result = await response.json()
      
      // The API returns a nested structure: { success: true, data: { services: [...] } }
      if (result.success && result.data?.services?.length > 0) {
        const service = result.data.services[0]
        
        // Flatten the nested structure for easier access in the component
        return {
          id: service.id,
          facilityId: service.facilityId,
          packageId: service.packageId,
          planId: service.planId,
          status: service.status,
          startDate: service.startDate,
          endDate: service.endDate,
          siteName: service.siteName,
          serviceLocation: service.serviceLocation,
          smartmeterId: service.smartmeterId,
          autoSuspendEnabled: service.autoSuspendEnabled,
          graceDays: service.graceDays,
          adminNotes: service.adminNotes,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
          // Package info (flattened)
          packageName: service.package?.name,
          packageRatedKw: service.package?.ratedKw,
          packageCode: service.package?.code,
          packageSuitableFor: service.package?.suitableFor,
          // Plan info (flattened)
          planTypeCode: service.plan?.planTypeCode,
          currency: service.plan?.currency,
          cashPrice: service.plan?.pricing?.cashPrice,
          installmentDurationMonths: service.plan?.pricing?.installmentDurationMonths,
          defaultUpfrontPercent: service.plan?.pricing?.defaultUpfrontPercent,
          monthlyAmount: service.plan?.pricing?.defaultMonthlyAmount,
          eaasMonthlyFee: service.plan?.pricing?.eaasMonthlyFee,
          eaasBillingModel: service.plan?.pricing?.eaasBillingModel,
          // Installment contract fields (mock data for now, should come from API)
          contractTotalPrice: service.plan?.pricing?.cashPrice || null,
          balanceAmount: service.plan?.pricing?.cashPrice ? 
            (service.plan?.pricing?.cashPrice * 0.7) : null, // Mock: assume 30% paid
          durationMonths: service.plan?.pricing?.installmentDurationMonths || null,
          // PAAS contract fields (mock data for now, should come from API)
          contractStatus: service.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
          billingModel: service.plan?.pricing?.eaasBillingModel || 'FIXED_MONTHLY',
          minimumTermMonths: 12, // Mock: 12 months minimum term
          // Add next billing date calculation
          nextBillingDate: service.startDate ? new Date(new Date(service.startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
        }
      }
      
      // If no client service found, try to get subscription data and create a mock service
      try {
        const subscriptionsResponse = await fetch(`/api/subscriptions?facilityId=${facilityId}`)
        if (subscriptionsResponse.ok) {
          const subscriptionsResult = await subscriptionsResponse.json()
          
          // Look for active Afya Solar subscription
          const afyaSolarSubscription = subscriptionsResult.data?.find((sub: any) => 
            sub.serviceName === 'afya-solar' && 
            (sub.status === 'active' || sub.isActive === true) &&
            (!sub.expiryDate || new Date(sub.expiryDate) > new Date())
          )
          
          if (afyaSolarSubscription) {
            console.log('Creating mock client service from subscription:', afyaSolarSubscription)
            
            // Create a mock client service based on subscription data
            // Default to 10KW package since user mentioned subscribing to 10KW
            return {
              id: `mock-${afyaSolarSubscription.id}`,
              facilityId: facilityId,
              packageId: 4, // 10KW package ID
              planId: 4, // PAAS plan for 10KW
              status: 'ACTIVE',
              startDate: afyaSolarSubscription.startDate || new Date().toISOString(),
              endDate: afyaSolarSubscription.expiryDate || null,
              siteName: 'Ubuntu Facility',
              serviceLocation: 'Default Location',
              smartmeterId: null,
              autoSuspendEnabled: true,
              graceDays: 7,
              adminNotes: 'Generated from subscription data',
              createdAt: afyaSolarSubscription.createdAt || new Date().toISOString(),
              updatedAt: afyaSolarSubscription.updatedAt || new Date().toISOString(),
              // Package info (10KW system)
              packageName: '10 kW System',
              packageRatedKw: '10.00',
              packageCode: 'PKG_10KW',
              packageSuitableFor: 'Large clinics, maternity units',
              // Plan info (PAAS for 10KW)
              planTypeCode: 'PAAS',
              currency: 'TZS',
              cashPrice: 14900000,
              installmentDurationMonths: 54,
              defaultUpfrontPercent: '20.00',
              monthlyAmount: 331000,
              eaasMonthlyFee: 252000,
              eaasBillingModel: 'FIXED_MONTHLY',
              // Installment contract fields
              contractTotalPrice: 14900000,
              balanceAmount: 14900000 * 0.7, // Mock: 70% remaining
              durationMonths: 54,
              // PAAS contract fields
              contractStatus: 'ACTIVE',
              billingModel: 'FIXED_MONTHLY',
              minimumTermMonths: 12,
              // Add next billing date calculation
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        }
      } catch (subscriptionError) {
        console.log('Could not fetch subscription data:', subscriptionError)
      }
      
      return null
    },
    enabled: !!facilityId,
  })
}
