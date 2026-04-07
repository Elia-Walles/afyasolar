import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export function useAfyaSolarSubscribers(facilityId?: string) {
  return useQuery({
    queryKey: ['afya-solar-subscribers', facilityId],
    queryFn: async () => {
      if (!facilityId) return null
      
      const response = await fetch(`/api/afyasolar/subscribers?facilityId=${facilityId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch Afya Solar subscriber data')
      }
      const result = await response.json()
      
      if (result.success && result.data?.subscribers?.length > 0) {
        return result.data.subscribers[0] // Return first subscriber for the facility
      }
      
      return null
    },
    enabled: !!facilityId,
  })
}

export function useCreateAfyaSolarSubscriber() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/afyasolar/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create subscription')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['afya-solar-subscribers'] })
      console.log('Afya Solar subscription created:', data)
    },
    onError: (error) => {
      console.error('Error creating Afya Solar subscription:', error)
    }
  })
}

export function useUpdateAfyaSolarSubscriber() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/afyasolar/subscribers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update subscription')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['afya-solar-subscribers'] })
      console.log('Afya Solar subscription updated:', data)
    },
    onError: (error) => {
      console.error('Error updating Afya Solar subscription:', error)
    }
  })
}
