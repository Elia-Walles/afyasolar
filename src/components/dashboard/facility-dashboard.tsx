"use client"

import { useState } from "react"
import { useFacility } from "@/hooks/use-facilities"
import { useLiveEnergyData } from "@/hooks/use-energy-data"
import { FacilityDashboardContent } from "./facility-dashboard-content"

interface FacilityDashboardProps {
  facilityId?: string
}

export function FacilityDashboard({ facilityId }: FacilityDashboardProps) {
  const { data: facility, isLoading: facilityLoading } = useFacility(facilityId)
  const { data: liveData, isLoading: dataLoading } = useLiveEnergyData(facilityId)

  if (facilityLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return <FacilityDashboardContent facility={facility} liveData={liveData} />
}

