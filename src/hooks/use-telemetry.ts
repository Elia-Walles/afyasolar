import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { 
  TelemetryData, 
  DeviceHealth, 
  DeviceAlert, 
  FacilityHealthSummary, 
  DeviceWithHealth 
} from '@/types/solar'

// Hook for fetching real-time telemetry data
export function useRealtimeTelemetry(facilityId?: string, deviceId?: string, enabled = true) {
  return useQuery({
    queryKey: ['telemetry', facilityId, deviceId],
    queryFn: async (): Promise<TelemetryData[]> => {
      const params = new URLSearchParams()
      if (facilityId) params.append('facilityId', facilityId)
      if (deviceId) params.append('deviceId', deviceId)
      params.append('limit', '100')

      const response = await fetch(`/api/devices/telemetry?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch telemetry data')
      }
      const result = await response.json()
      return result.data || []
    },
    refetchInterval: enabled ? 10000 : false, // Refresh every 10 seconds
    enabled: enabled && !!(facilityId || deviceId),
  })
}

// Hook for fetching device health
export function useDeviceHealth(deviceId: string, enabled = true) {
  return useQuery({
    queryKey: ['device-health', deviceId],
    queryFn: async (): Promise<{
      device: any
      health: DeviceHealth | null
      alerts: DeviceAlert[]
      performance: any
      summary: any
    }> => {
      const response = await fetch(`/api/devices/${deviceId}/health`)
      if (!response.ok) {
        throw new Error('Failed to fetch device health')
      }
      return response.json()
    },
    refetchInterval: enabled ? 15000 : false, // Refresh every 15 seconds
    enabled: enabled && !!deviceId,
  })
}

// Hook for fetching facility health summary
export function useFacilityHealth(facilityId: string, enabled = true) {
  return useQuery({
    queryKey: ['facility-health', facilityId],
    queryFn: async (): Promise<FacilityHealthSummary> => {
      const response = await fetch(`/api/facilities/${facilityId}/devices/health`)
      if (!response.ok) {
        throw new Error('Failed to fetch facility health')
      }
      const result = await response.json()
      return result.data
    },
    refetchInterval: enabled ? 30000 : false, // Refresh every 30 seconds
    enabled: enabled && !!facilityId,
  })
}

// Hook for submitting telemetry data
export function useSubmitTelemetry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (telemetryData: Partial<TelemetryData>) => {
      const response = await fetch('/api/devices/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(telemetryData),
      })

      if (!response.ok) {
        throw new Error('Failed to submit telemetry data')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['telemetry'] })
      queryClient.invalidateQueries({ queryKey: ['device-health'] })
      queryClient.invalidateQueries({ queryKey: ['facility-health'] })
    },
  })
}

// Hook for updating device health
export function useUpdateDeviceHealth() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ deviceId, healthData }: { deviceId: string; healthData: Partial<DeviceHealth> }) => {
      const response = await fetch(`/api/devices/${deviceId}/health`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(healthData),
      })

      if (!response.ok) {
        throw new Error('Failed to update device health')
      }

      return response.json()
    },
    onSuccess: (_, { deviceId }) => {
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['device-health', deviceId] })
      queryClient.invalidateQueries({ queryKey: ['facility-health'] })
    },
  })
}

// Hook for acknowledging alerts
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ alertId, acknowledgedBy }: { alertId: string; acknowledgedBy: string }) => {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acknowledgedBy }),
      })

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['device-health'] })
      queryClient.invalidateQueries({ queryKey: ['facility-health'] })
    },
  })
}

// Hook for calculating performance metrics
export function usePerformanceMetrics(telemetryData: TelemetryData[]) {
  const calculateMetrics = useCallback((data: TelemetryData[]) => {
    if (!data || data.length === 0) {
      return {
        avgPower: 0,
        peakPower: 0,
        avgEfficiency: 0,
        totalEnergy: 0,
        avgBatteryLevel: 0,
        avgTemperature: 0,
        dataPoints: 0,
      }
    }

    const validPowerData = data.filter(d => d.power && d.power > 0)
    const validEfficiencyData = data.filter(d => d.efficiency && d.efficiency > 0)
    const validBatteryData = data.filter(d => d.batteryLevel !== undefined)
    const validTempData = data.filter(d => d.temperature !== undefined)

    const avgPower = validPowerData.length > 0 
      ? validPowerData.reduce((sum, d) => sum + d.power!, 0) / validPowerData.length 
      : 0

    const peakPower = validPowerData.length > 0 
      ? Math.max(...validPowerData.map(d => d.power!)) 
      : 0

    const avgEfficiency = validEfficiencyData.length > 0 
      ? validEfficiencyData.reduce((sum, d) => sum + d.efficiency!, 0) / validEfficiencyData.length 
      : 0

    const totalEnergy = data.reduce((sum, d) => sum + (d.energyConsumed || 0), 0)

    const avgBatteryLevel = validBatteryData.length > 0 
      ? validBatteryData.reduce((sum, d) => sum + d.batteryLevel!, 0) / validBatteryData.length 
      : 0

    const avgTemperature = validTempData.length > 0 
      ? validTempData.reduce((sum, d) => sum + d.temperature!, 0) / validTempData.length 
      : 0

    return {
      avgPower: Math.round(avgPower * 100) / 100,
      peakPower: Math.round(peakPower * 100) / 100,
      avgEfficiency: Math.round(avgEfficiency * 100) / 100,
      totalEnergy: Math.round(totalEnergy * 100) / 100,
      avgBatteryLevel: Math.round(avgBatteryLevel * 100) / 100,
      avgTemperature: Math.round(avgTemperature * 100) / 100,
      dataPoints: data.length,
    }
  }, [])

  return calculateMetrics(telemetryData)
}
