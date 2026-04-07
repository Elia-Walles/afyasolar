import { useQuery } from "@tanstack/react-query"

export function useAfyaSolarInvoiceRequests(facilityId?: string) {
  return useQuery({
    queryKey: ['afya-solar-invoice-requests', facilityId],
    queryFn: async () => {
      if (!facilityId) return []

      // Facility-scoped endpoint uses session.user.facilityId on the server,
      // so we don't need to pass facilityId in the URL.
      const response = await fetch(`/api/afya-solar/invoice-requests`)
      if (!response.ok) {
        throw new Error('Failed to fetch invoice requests')
      }
      const result = await response.json()
      return result.data || []
    },
    enabled: !!facilityId,
    initialData: [],
  })
}
