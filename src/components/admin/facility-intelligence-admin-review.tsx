"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type CycleRow = {
  id: string
  facilityId?: string
  status?: string
  startedAt?: string
  version?: string
}

/**
 * Admin-only: load facility-scoped assessment cycles and inspect persisted energy + climate payloads.
 */
export function FacilityIntelligenceAdminReview({ facilityId }: { facilityId: string }) {
  const [cycles, setCycles] = useState<CycleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleId, setCycleId] = useState<string>("")
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [energyJson, setEnergyJson] = useState<string>("")
  const [climateJson, setClimateJson] = useState<string>("")

  useEffect(() => {
    let c = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/facility/${facilityId}/assessment-cycles`, { cache: "no-store" })
        const j = await res.json()
        if (!c && res.ok && Array.isArray(j?.cycles)) {
          setCycles(j.cycles)
          if (j.cycles[0]?.id) setCycleId(j.cycles[0].id)
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [facilityId])

  const loadBundle = useCallback(async () => {
    if (!cycleId) return
    setLoadingBundle(true)
    try {
      const [eRes, cRes] = await Promise.all([
        fetch(`/api/assessment-cycles/${cycleId}/energy`, { cache: "no-store" }),
        fetch(`/api/assessment-cycles/${cycleId}/climate`, { cache: "no-store" }),
      ])
      const eJson = await eRes.json().catch(() => ({}))
      const cJson = await cRes.json().catch(() => ({}))
      setEnergyJson(JSON.stringify(eJson, null, 2))
      setClimateJson(JSON.stringify(cJson, null, 2))
    } finally {
      setLoadingBundle(false)
    }
  }, [cycleId])

  useEffect(() => {
    if (!cycleId) return
    void loadBundle()
  }, [cycleId, loadBundle])

  return (
    <Card className="border-blue-100">
      <CardHeader>
        <CardTitle className="text-base">AfyaSolar intelligence (saved data)</CardTitle>
        <CardDescription className="text-sm">
          Review persisted energy-efficiency (devices, BMI) and climate assessment for this facility. Data is stored per
          assessment cycle and scoped by <span className="font-mono text-xs">{facilityId}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading cycles…
          </div>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assessment cycles yet. Open the facility dashboard Intelligence workflow to create one.</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <Label>Assessment cycle</Label>
                <Select value={cycleId} onValueChange={setCycleId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.startedAt ? new Date(c.startedAt).toLocaleString() : c.id.slice(0, 8)} — {c.status ?? "—"} (
                        {c.version ?? "?"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadBundle()} disabled={loadingBundle}>
                {loadingBundle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>

            <Tabs defaultValue="energy">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="energy">Energy efficiency</TabsTrigger>
                <TabsTrigger value="climate">Climate resilience</TabsTrigger>
              </TabsList>
              <TabsContent value="energy" className="mt-3">
                <div className="max-h-[min(420px,55vh)] overflow-auto rounded-md border bg-muted/30 p-3">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono">{energyJson || "—"}</pre>
                </div>
              </TabsContent>
              <TabsContent value="climate" className="mt-3">
                <div className="max-h-[min(420px,55vh)] overflow-auto rounded-md border bg-muted/30 p-3">
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono">{climateJson || "—"}</pre>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  )
}
