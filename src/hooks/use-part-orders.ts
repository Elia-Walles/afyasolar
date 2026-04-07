import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { SparePart } from "./use-spare-parts"

export interface PartOrder {
  order: {
    id: string
    partId: string
    requestedById?: string | null
    requestedByType: "technician" | "admin" | "system"
    maintenanceRequestId?: string | null
    quantity: number
    unitPrice?: string | null
    totalPrice?: string | null
    status:
      | "draft"
      | "pending_approval"
      | "approved"
      | "rejected"
      | "ordered"
      | "received"
      | "cancelled"
    priority: "low" | "medium" | "high"
    neededBy?: string | null
    approvedById?: string | null
    approvedAt?: string | null
    receivedAt?: string | null
    vendorName?: string | null
    trackingNumber?: string | null
    notes?: string | null
    createdAt: string
    updatedAt: string
  }
  part?: SparePart
}

export interface OrderFilters {
  status?: PartOrder["order"]["status"] | "all"
}

export interface CreateOrderInput {
  partId: string
  maintenanceRequestId?: string
  quantity: number
  priority?: "low" | "medium" | "high"
  neededBy?: string
  notes?: string
}

export interface UpdateOrderInput {
  status?: PartOrder["order"]["status"]
  unitPrice?: number
  totalPrice?: number
  approvedById?: string
  approvedAt?: string
  receivedAt?: string
  vendorName?: string | null
  trackingNumber?: string | null
  notes?: string | null
}

export function usePartOrders(filters?: OrderFilters) {
  return useQuery<PartOrder[]>({
    queryKey: ["part-orders", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status)
      }
      const response = await fetch(`/api/part-orders${params.toString() ? `?${params}` : ""}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to fetch part orders")
      }
      const data = await response.json()
      return data.data as PartOrder[]
    },
  })
}

export function useCreatePartOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateOrderInput) => {
      const response = await fetch("/api/part-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create part order")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["part-orders"] })
      toast.success("Part order submitted")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdatePartOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateOrderInput }) => {
      const response = await fetch(`/api/part-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update order")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["part-orders"] })
      toast.success("Part order updated")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

