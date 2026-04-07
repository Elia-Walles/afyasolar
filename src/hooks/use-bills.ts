import { useQuery } from "@tanstack/react-query"

export function useBills(facilityId?: string) {
  return useQuery({
    queryKey: ['bills', facilityId],
    queryFn: async () => {
      if (!facilityId) return []
      
      const response = await fetch(`/api/bills?facilityId=${facilityId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch bills')
      }
      const result = await response.json()
      return result.data || []
    },
    enabled: !!facilityId,
    initialData: [], // Provide initial data to prevent undefined
  })
}
