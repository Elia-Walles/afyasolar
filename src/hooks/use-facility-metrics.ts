import { useQuery } from "@tanstack/react-query"

interface FacilityMetrics {
  totalConsumption: number
  maxPower: number
  totalSolarGeneration: number
  avgBatteryLevel: number
  solarPercentage: number
  efficiency: number
  costSavings: number
  carbonCreditEarned: number
  energyEfficiencyScore: number
  deviceCount: number
  dataPoints: number
  period: string
}

export function useFacilityMetrics(facilityId?: string, days: number = 30) {
  return useQuery<FacilityMetrics | null>({
    queryKey: ["facility-metrics", facilityId, days],
    queryFn: async () => {
      if (!facilityId) return null

      const response = await fetch(`/api/facility/${facilityId}/metrics?days=${days}`)
      if (!response.ok) {
        throw new Error("Failed to fetch facility metrics")
      }

      const result = await response.json()
      return result.data ?? null
    },
    enabled: !!facilityId,
  })
}

