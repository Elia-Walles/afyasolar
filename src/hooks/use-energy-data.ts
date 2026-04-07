import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { EnergyData, LiveEnergyData } from '@/types'

/**
 * Fetch energy data for a device or facility
 */
export function useEnergyData(deviceId?: string, facilityId?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['energy-data', deviceId, facilityId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (deviceId) params.append('deviceId', deviceId)
      if (facilityId) params.append('facilityId', facilityId)

      const response = await fetch(`/api/energy?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch energy data')

      const result = await response.json()
      return result.telemetry || [] as EnergyData[]
    },
    enabled: !!session && (!!deviceId || !!facilityId),
    refetchInterval: 5000, // Refetch every 5 seconds for live data
  })
}

/**
 * Fetch live energy data summary
 */
export function useLiveEnergyData(facilityId?: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['live-energy-data', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.append('facilityId', facilityId)
      params.append('limit', '1')

      const response = await fetch(`/api/energy?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch live energy data')

      const result = await response.json()
      const latest = result.telemetry?.[0] as EnergyData | undefined

      if (!latest) {
        return null
      }

      // Calculate live data summary
      const liveData: LiveEnergyData = {
        currentUsage: Number(latest.power),
        todayTotal: Number(latest.energy),
        projectedConsumption: Number(latest.energy) * 1.2, // Estimate
        projectionPercent: 2.0,
        currentRate: 357.14285, // TSh per kWh
        maxDemand: Number(latest.power) * 1.1,
        maxDemandTime: new Date(latest.timestamp).toLocaleTimeString(),
        creditBalance: Number(latest.creditBalance),
        solarGeneration: latest.solarGeneration ? Number(latest.solarGeneration) : undefined,
        batteryLevel: latest.batteryLevel ? Number(latest.batteryLevel) : undefined,
        costToDate: Number(latest.energy) * 357.14285,
        billPeriod: 'Apr 1 - May 1',
        lastUpdate: new Date(latest.timestamp).toLocaleTimeString(),
        gridCost: Number(latest.energy) * 357.14285,
        solarCost: Number(latest.energy) * 357.14285 * 0.6, // 40% savings
        totalSavings: Number(latest.energy) * 357.14285 * 0.4,
        savingsPercent: 43.5,
      }

      return liveData
    },
    enabled: !!session && !!facilityId,
    refetchInterval: 5000,
  })
}

/**
 * Create new energy data entry
 */
export function useCreateEnergyData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<EnergyData>) => {
      const response = await fetch('/api/energy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create energy data')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['energy-data'] })
    },
  })
}

