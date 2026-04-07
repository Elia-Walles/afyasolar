"use client"

import { useQuery } from '@tanstack/react-query'

export interface AuditLog {
  userId?: string
  userEmail?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  success: boolean
  error?: string
  timestamp: string
}

export function useAuditLogs(limit: number = 50) {
  return useQuery<AuditLog[]>({
    queryKey: ['audit-logs', limit],
    queryFn: async () => {
      const response = await fetch(`/api/audit/logs?limit=${limit}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch audit logs')
      }
      const data = await response.json()
      return data.data as AuditLog[]
    },
  })
}

