"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFacilities } from "@/hooks/use-facilities"
import { ManualTelemetryForm } from "@/components/energy/manual-telemetry-form"
import { SlidersHorizontal } from "lucide-react"

/**
 * Internal admin-only tools kept outside the facility impersonation UI.
 */
export function InternalSystemTools() {
  const { data: facilities, isLoading } = useFacilities()
  const [facilityId, setFacilityId] = useState<string>("")

  const sorted = useMemo(() => {
    const list = facilities ?? []
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [facilities])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SlidersHorizontal className="h-5 w-5 text-gray-600" />
            System tools
          </CardTitle>
          <CardDescription>
            Operational utilities for testing and support. Not shown inside the facility admin view.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Facility</Label>
            <Select
              value={facilityId || undefined}
              onValueChange={setFacilityId}
              disabled={isLoading || sorted.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading facilities…" : "Select a facility"} />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {facilityId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual telemetry sample</CardTitle>
            <CardDescription>
              Record a sample energy reading for the selected facility (testing dashboards before meter
              integration).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManualTelemetryForm facilityId={facilityId} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Select a facility to enable manual telemetry.</p>
      )}
    </div>
  )
}
