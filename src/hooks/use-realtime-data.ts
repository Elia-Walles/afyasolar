'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseRealtimeDataOptions<T> {
  /** Function to fetch data from the API */
  fetcher: () => Promise<T>
  /** Polling interval in milliseconds (default: 30000ms = 30 seconds) */
  interval?: number
  /** Whether to enable polling (default: true) */
  enabled?: boolean
  /** Callback when data changes */
  onDataChange?: (newData: T, oldData: T | null) => void
  /** Whether to refetch on window focus (default: true) */
  refetchOnFocus?: boolean
  /** Whether to refetch on reconnect (default: true) */
  refetchOnReconnect?: boolean
}

interface UseRealtimeDataReturn<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
  lastUpdated: Date | null
}

/**
 * Hook for real-time data polling with automatic refresh
 * This ensures data is kept up-to-date across the application
 */
export function useRealtimeData<T>({
  fetcher,
  interval = 30000,
  enabled = true,
  onDataChange,
  refetchOnFocus = true,
  refetchOnReconnect = true,
}: UseRealtimeDataOptions<T>): UseRealtimeDataReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  const dataRef = useRef<T | null>(null)
  const isMountedRef = useRef(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      const newData = await fetcher()
      
      if (!isMountedRef.current) return

      // Check if data has changed
      const oldData = dataRef.current
      const hasChanged = JSON.stringify(newData) !== JSON.stringify(oldData)

      if (hasChanged) {
        dataRef.current = newData
        setData(newData)
        setLastUpdated(new Date())
        
        if (onDataChange && oldData !== null) {
          onDataChange(newData, oldData)
        }
      }
      
      setError(null)
    } catch (err) {
      if (!isMountedRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to fetch data'))
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [fetcher, enabled, onDataChange])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    await fetchData()
  }, [fetchData])

  // Initial fetch and polling setup
  useEffect(() => {
    isMountedRef.current = true
    
    // Initial fetch
    fetchData()

    // Set up polling interval
    if (enabled && interval > 0) {
      intervalRef.current = setInterval(fetchData, interval)
    }

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchData, enabled, interval])

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus) return

    const handleFocus = () => {
      fetchData()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData, refetchOnFocus])

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect) return

    const handleOnline = () => {
      fetchData()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fetchData, refetchOnReconnect])

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  }
}

/**
 * Hook for real-time maintenance requests with notifications
 */
export function useRealtimeMaintenanceRequests(
  filters?: {
    status?: string
    facilityId?: string
    technicianId?: string
    view?: 'available' | 'my' | 'all'
  },
  options?: Partial<UseRealtimeDataOptions<any>>
) {
  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.facilityId) params.append('facilityId', filters.facilityId)
    if (filters?.technicianId) params.append('technicianId', filters.technicianId)
    if (filters?.view) params.append('view', filters.view)

    const response = await fetch(`/api/maintenance/requests?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch maintenance requests')
    const result = await response.json()
    return result.data
  }, [filters?.status, filters?.facilityId, filters?.technicianId, filters?.view])

  return useRealtimeData({
    fetcher,
    interval: 15000, // Poll every 15 seconds for maintenance requests
    ...options,
  })
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications(
  userId?: string,
  options?: Partial<UseRealtimeDataOptions<any>>
) {
  const fetcher = useCallback(async () => {
    const response = await fetch('/api/notifications')
    if (!response.ok) throw new Error('Failed to fetch notifications')
    const result = await response.json()
    return result.data
  }, [])

  return useRealtimeData({
    fetcher,
    interval: 10000, // Poll every 10 seconds for notifications
    ...options,
  })
}

/**
 * Hook for real-time appointments
 */
export function useRealtimeAppointments(
  facilityId?: string,
  options?: Partial<UseRealtimeDataOptions<any>>
) {
  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    if (facilityId) params.append('facilityId', facilityId)
    
    const response = await fetch(`/api/booking/appointments?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch appointments')
    const result = await response.json()
    return result.data
  }, [facilityId])

  return useRealtimeData({
    fetcher,
    interval: 20000, // Poll every 20 seconds for appointments
    ...options,
  })
}

/**
 * Hook for real-time technician balance
 */
export function useRealtimeTechnicianBalance(
  technicianId?: string,
  options?: Partial<UseRealtimeDataOptions<any>>
) {
  const fetcher = useCallback(async () => {
    if (!technicianId) return null
    
    const response = await fetch(`/api/technicians/${technicianId}/balance`)
    if (!response.ok) throw new Error('Failed to fetch balance')
    const result = await response.json()
    return result.data
  }, [technicianId])

  return useRealtimeData({
    fetcher,
    interval: 30000, // Poll every 30 seconds for balance
    enabled: !!technicianId,
    ...options,
  })
}

