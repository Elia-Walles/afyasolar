import { useQuery } from "@tanstack/react-query"

export function useNotificationCount() {
  return useQuery({
    queryKey: ['admin-notification-count'],
    queryFn: async () => {
      const response = await fetch('/api/admin/notifications?unreadOnly=true&limit=50')
      if (!response.ok) {
        throw new Error('Failed to fetch notification count')
      }
      const data = await response.json()
      return data.notifications?.length || 0
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  })
}
