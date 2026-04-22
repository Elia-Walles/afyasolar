"use client"

import { useQuery } from "@tanstack/react-query"

export type AssessmentSnapshotRow = {
  facilityId: string
  facilityName: string
  city: string | null
  region: string | null
  facilityStatus: string | null
  energyAssessmentDate: string | null
  climateAssessmentDate: string | null
  energyBmiPercent: number | null
  energyBmiRawScore: number | null
  climateRcs: number | null
  climateTier: number | null
  climateCriticalAttention: boolean
  climateEvidenceCount: number
  hasEnergySnapshot: boolean
  hasClimateSnapshot: boolean
}

export function useAdminPortfolioAssessmentSnapshotSummary() {
  return useQuery({
    queryKey: ["admin-assessment-snapshot-summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/afya-solar/assessment-snapshot-summary", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load assessment snapshot summary")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid response")
      return json.data as AssessmentSnapshotRow[]
    },
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  })
}

/** Portfolio assessment snapshot table (plan naming). */
export const useAdminPortfolioAssessments = useAdminPortfolioAssessmentSnapshotSummary
