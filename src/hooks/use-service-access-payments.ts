import { useQuery } from "@tanstack/react-query"

export function useServiceAccessPayments(facilityId?: string, serviceName?: string) {
  return useQuery({
    queryKey: ['service-access-payments', facilityId, serviceName],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.append('facilityId', facilityId)
      if (serviceName) params.append('serviceName', serviceName)

      const response = await fetch(`/api/service-access-payments?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch service access payments')
      }
      const result = await response.json()
      return result.data || []
    },
    enabled: !!facilityId || !!serviceName,
    initialData: [],
  })
}
