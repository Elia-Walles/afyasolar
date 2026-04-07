import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface Equipment {
  id: string
  facilityId: string
  categoryId?: string | null
  name: string
  model?: string | null
  serialNumber?: string | null
  manufacturer?: string | null
  purchaseDate?: Date | string | null
  installationDate?: Date | string | null
  warrantyExpiryDate?: Date | string | null
  purchaseCost?: string | null
  locationInFacility?: string | null
  status: 'active' | 'inactive' | 'maintenance' | 'retired'
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  specifications?: string | null
  maintenanceNotes?: string | null
  images?: string | null
  qrCode?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface CreateEquipmentInput {
  name: string
  model?: string
  serialNumber?: string
  manufacturer?: string
  purchaseDate?: string
  installationDate?: string
  warrantyExpiryDate?: string
  purchaseCost?: string
  locationInFacility?: string
  status?: 'active' | 'inactive' | 'maintenance' | 'retired'
  condition?: 'excellent' | 'good' | 'fair' | 'poor'
  specifications?: string
  maintenanceNotes?: string
  categoryId?: string
}

export interface UpdateEquipmentInput extends Partial<CreateEquipmentInput> {}

export function useEquipment() {
  return useQuery<Equipment[]>({
    queryKey: ['equipment'],
    queryFn: async () => {
      const response = await fetch('/api/equipment')
      if (!response.ok) {
        throw new Error('Failed to fetch equipment')
      }
      const data = await response.json()
      return data.data
    },
  })
}

export function useCreateEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateEquipmentInput) => {
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create equipment')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipment created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateEquipmentInput }) => {
      const response = await fetch(`/api/equipment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update equipment')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipment updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/equipment/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete equipment')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipment deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

