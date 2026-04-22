"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CloudSun, Gauge, RefreshCw, Search, Database } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useFacilities } from "@/hooks/use-facilities"
import { extractClimateScore } from "@/lib/assessment-cycle-overview-metrics"
import { buildClimateTabModel, buildEnergyTabModel, type CycleEnergyApi } from "@/lib/assessment-cycle-admin-view-model"
import {
  AdminClimateChartSection,
  AdminEnergyChartSection,
} from "@/components/afya-solar/admin-assessment-cycle-charts"

type AssessmentCycle = {
  id: string
  facilityId: string
  assessmentNumber?: number | null
  startedAt: string | null
  completedAt: string | null
  status: string | null
}

type EnergyCyclePayload = {
  success: boolean
  facilityId: string
  sizingData: unknown
  operationsData: unknown
  bmiTrendJson: unknown
  updatedAt: string | null
}

type ClimateCyclePayload = {
  success: boolean
  responses: Array<Record<string, unknown>>
  evidence: Array<Record<string, unknown>>
  score: Record<string, unknown> | null
  topRisks: Array<Record<string, unknown>>
}

type ReportRow = {
  id: string
  assessmentCycleId: string | null
  payload: unknown
} | null

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function fmtKwh(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—"
  return `${Number(n).toFixed(2)} kWh`
}

function fmtMoney(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—"
  return formatCurrency(n)
}

function TabMetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium text-gray-600">{label}</CardDescription>
        <CardTitle className="text-xl font-bold text-gray-900">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

export function AdminPortfolioAssessmentSnapshots() {
  const [facilitySearch, setFacilitySearch] = useState("")
  const [selectedFacilityId, setSelectedFacilityId] = useState("")
  const [selectedCycleId, setSelectedCycleId] = useState("")
  const [mainTab, setMainTab] = useState<"energy" | "climate">("energy")

  const {
    data: facilities = [],
    isLoading: facilitiesLoading,
    isFetching: facilitiesFetching,
    refetch: refetchFacilities,
  } = useFacilities()

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.trim().toLowerCase()
    const sorted = [...facilities].sort((a, b) => a.name.localeCompare(b.name))
    if (!q) return sorted
    return sorted.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.city && f.city.toLowerCase().includes(q)) ||
        (f.region && f.region.toLowerCase().includes(q))
    )
  }, [facilities, facilitySearch])

  useEffect(() => {
    if (filteredFacilities.length === 0) return
    if (!selectedFacilityId || !filteredFacilities.some((f) => f.id === selectedFacilityId)) {
      setSelectedFacilityId(filteredFacilities[0].id)
    }
  }, [filteredFacilities, selectedFacilityId])

  const selectedFacility = useMemo(
    () => facilities.find((f) => f.id === selectedFacilityId) ?? null,
    [facilities, selectedFacilityId]
  )

  const {
    data: cycles = [],
    isLoading: cyclesLoading,
    isFetching: cyclesFetching,
    refetch: refetchCycles,
  } = useQuery({
    queryKey: ["admin-assessment-cycles", selectedFacilityId],
    enabled: Boolean(selectedFacilityId),
    queryFn: async () => {
      const res = await fetch(`/api/facility/${selectedFacilityId}/assessment-cycles?limit=500`)
      if (!res.ok) throw new Error("Failed to load assessment cycles")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid cycles response")
      return (json.cycles || []) as AssessmentCycle[]
    },
  })

  useEffect(() => {
    if (!cycles.length) {
      setSelectedCycleId("")
      return
    }
    const hasCurrent = cycles.some((c) => c.id === selectedCycleId)
    if (!hasCurrent) setSelectedCycleId(cycles[0].id)
  }, [cycles, selectedCycleId])

  const {
    data: energyData,
    isLoading: energyLoading,
    isFetching: energyFetching,
    isError: energyError,
    error: energyQueryError,
    refetch: refetchEnergy,
  } = useQuery({
    queryKey: ["admin-assessment-cycle-energy", selectedCycleId],
    enabled: Boolean(selectedCycleId),
    queryFn: async () => {
      const res = await fetch(`/api/assessment-cycles/${selectedCycleId}/energy`)
      if (!res.ok) throw new Error("Failed to load energy assessment data")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid energy response")
      return json as EnergyCyclePayload
    },
  })

  const {
    data: climateData,
    isLoading: climateLoading,
    isFetching: climateFetching,
    isError: climateError,
    error: climateQueryError,
    refetch: refetchClimate,
  } = useQuery({
    queryKey: ["admin-assessment-cycle-climate", selectedCycleId],
    enabled: Boolean(selectedCycleId),
    queryFn: async () => {
      const res = await fetch(`/api/assessment-cycles/${selectedCycleId}/climate`)
      if (!res.ok) throw new Error("Failed to load climate assessment data")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid climate response")
      return json as ClimateCyclePayload
    },
  })

  const {
    data: cycleReports,
    isLoading: reportsLoading,
    isFetching: reportsFetching,
    isError: reportsError,
    error: reportsQueryError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["admin-assessment-cycle-reports", selectedFacilityId, selectedCycleId],
    enabled: Boolean(selectedFacilityId && selectedCycleId),
    queryFn: async () => {
      const res = await fetch(
        `/api/facility/${selectedFacilityId}/assessment-reports?assessmentCycleId=${encodeURIComponent(selectedCycleId)}`
      )
      if (!res.ok) throw new Error("Failed to load cycle assessment reports")
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || "Invalid reports response")
      return json as { energyReport: ReportRow; climateReport: ReportRow }
    },
  })

  const activeCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )

  const cycleEnergyApi: CycleEnergyApi | null = useMemo(() => {
    if (!energyData) return null
    return {
      sizingData: energyData.sizingData,
      operationsData: energyData.operationsData,
      bmiTrendJson: energyData.bmiTrendJson,
      updatedAt: energyData.updatedAt,
    }
  }, [energyData])

  const energyReportPayload = useMemo(() => {
    const row = cycleReports?.energyReport
    if (!row?.payload) return null
    return row.payload
  }, [cycleReports?.energyReport])

  const climateReportPayload = useMemo(() => {
    const row = cycleReports?.climateReport
    if (!row?.payload) return null
    return row.payload
  }, [cycleReports?.climateReport])

  const energyModel = useMemo(
    () => buildEnergyTabModel({ cycleEnergy: cycleEnergyApi, reportPayload: energyReportPayload }),
    [cycleEnergyApi, energyReportPayload]
  )

  const climateModel = useMemo(
    () =>
      buildClimateTabModel({
        climateApi: {
          score: climateData?.score ?? null,
          responses: climateData?.responses ?? [],
          evidence: climateData?.evidence ?? [],
          topRisks: climateData?.topRisks ?? [],
        },
        reportPayload: climateReportPayload,
      }),
    [climateData, climateReportPayload]
  )

  const climateScore = useMemo(() => extractClimateScore(climateData?.score ?? null), [climateData?.score])

  const energyTabLoading =
    Boolean(selectedCycleId) &&
    (energyLoading || reportsLoading || energyFetching || reportsFetching)
  const climateTabLoading =
    Boolean(selectedCycleId) &&
    (climateLoading || reportsLoading || climateFetching || reportsFetching)

  const refreshAll = () => {
    void refetchFacilities()
    void refetchCycles()
    void refetchEnergy()
    void refetchClimate()
    void refetchReports()
  }

  const busy = facilitiesFetching || cyclesFetching

  const cycleLabel = activeCycle
    ? `${new Date(activeCycle.startedAt || "").toLocaleDateString()} · ${activeCycle.status || "—"}`
    : "—"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Select facility</h2>
          <p className="text-gray-600 text-sm mt-1 max-w-3xl">
            After selecting a facility, assessments for the chosen cycle load from{" "}
            <span className="font-mono text-xs">assessment_cycle_energy_state</span>,{" "}
            <span className="font-mono text-xs">facility_energy_assessments</span> (quote/cost), and climate tables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Updating
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={refreshAll} disabled={busy}>
            <RefreshCw className={cn("h-4 w-4 mr-1", busy && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selection</CardTitle>
          <CardDescription>Choose facility and assessment cycle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Facility</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={facilitySearch}
                  onChange={(e) => setFacilitySearch(e.target.value)}
                  placeholder="Filter facilities…"
                />
              </div>
              <Select
                value={selectedFacilityId || undefined}
                onValueChange={setSelectedFacilityId}
                disabled={facilitiesLoading || filteredFacilities.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={facilitiesLoading ? "Loading…" : "Select facility"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {filteredFacilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.city ? ` (${f.city})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Current cycle</Label>
              <Select
                value={selectedCycleId || undefined}
                onValueChange={setSelectedCycleId}
                disabled={!selectedFacilityId || cyclesLoading || cycles.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={cyclesLoading ? "Loading cycles…" : "Select cycle"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {new Date(c.startedAt || "").toLocaleDateString()} · {c.status || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFacility && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline">Facility: {selectedFacility.name}</Badge>
                  <Badge variant={activeCycle?.status === "completed" ? "default" : "secondary"}>
                    Cycle status: {activeCycle?.status || "—"}
                  </Badge>
                  <Badge variant="outline" className="border-amber-300 text-amber-900 bg-amber-50">
                    Read-only (previous submission)
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "energy" | "climate")} className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 h-11">
          <TabsTrigger value="energy" className="gap-2">
            <Gauge className="h-4 w-4" />
            Energy efficiency
          </TabsTrigger>
          <TabsTrigger value="climate" className="gap-2">
            <CloudSun className="h-4 w-4" />
            Climate resilience
          </TabsTrigger>
        </TabsList>

        <TabsContent value="energy" className="space-y-4">
          {!selectedCycleId ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select an assessment cycle to load energy metrics.
              </CardContent>
            </Card>
          ) : energyError && !energyReportPayload ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-8 text-sm text-red-900">
                Could not load cycle energy state and no saved facility report was found for this cycle.{" "}
                {(energyQueryError as Error)?.message || "Unknown error."}
              </CardContent>
            </Card>
          ) : energyTabLoading ? (
            <Card>
              <CardContent className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading energy assessment data for this cycle…</p>
              </CardContent>
            </Card>
          ) : !energyModel.hasEnergyData ? (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="py-8 text-center text-sm text-amber-950">
                No energy assessment data for this cycle. Complete devices &amp; loads and/or save a Design &amp;
                Finance report linked to this cycle.
              </CardContent>
            </Card>
          ) : (
            <>
              {energyError && energyReportPayload && (
                <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
                  Cycle energy state API failed; showing values from the saved facility report when available.{" "}
                  {(energyQueryError as Error)?.message || ""}
                </p>
              )}
              {reportsError && (
                <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
                  Could not load saved facility report for this cycle. Cost fields may be incomplete.{" "}
                  {(reportsQueryError as Error)?.message || ""}
                </p>
              )}
              {energyModel.missingCostHint && (
                <p className="text-xs text-muted-foreground rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
                  Run Design &amp; Finance and save the assessment report for this cycle to populate monthly baseline,
                  after-solar, and savings cards (from <span className="font-mono">quoteData</span>).
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TabMetricCard label="Daily load" value={fmtKwh(energyModel.dailyLoadKwh)} />
                <TabMetricCard
                  label="Energy score"
                  value={energyModel.energyScorePercent != null ? `${energyModel.energyScorePercent}/100` : "—"}
                />
                <TabMetricCard
                  label="BMI score"
                  value={energyModel.bmiPercent != null ? `${energyModel.bmiPercent}/100` : "—"}
                />
                <TabMetricCard label="Baseline / month" value={fmtMoney(energyModel.baselineMonthly)} />
                <TabMetricCard label="After solar / month" value={fmtMoney(energyModel.afterSolarMonthly)} />
                <TabMetricCard label="Savings / month" value={fmtMoney(energyModel.savingsMonthly)} />
                <TabMetricCard label="Grid baseline / month" value={fmtMoney(energyModel.gridBaseline)} />
                <TabMetricCard label="Diesel baseline / month" value={fmtMoney(energyModel.dieselBaseline)} />
                <TabMetricCard
                  label="Solar offset"
                  value={energyModel.solarOffsetPercent != null ? `${energyModel.solarOffsetPercent}%` : "—"}
                />
              </div>
              <p className="text-xs text-muted-foreground">Viewing saved assessment (read-only). Cycle: {cycleLabel}</p>
              <AdminEnergyChartSection meu={energyModel.meuForCharts} bmiTrend={energyModel.bmiTrend} />
            </>
          )}
        </TabsContent>

        <TabsContent value="climate" className="space-y-4">
          {!selectedCycleId ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select an assessment cycle to load climate metrics.
              </CardContent>
            </Card>
          ) : climateError && !climateReportPayload ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-8 text-sm text-red-900">
                Could not load climate assessment for this cycle and no saved climate report was found.{" "}
                {(climateQueryError as Error)?.message || "Unknown error."}
              </CardContent>
            </Card>
          ) : climateTabLoading ? (
            <Card>
              <CardContent className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading climate assessment data…</p>
              </CardContent>
            </Card>
          ) : !climateModel.hasClimateData ? (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="py-8 text-center text-sm text-amber-950">
                No climate assessment data for this cycle. Complete the climate assessment and save results for this
                cycle.
              </CardContent>
            </Card>
          ) : (
            <>
              {climateError && climateReportPayload && (
                <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
                  Live climate API failed; metrics may come from the saved climate report only.{" "}
                  {(climateQueryError as Error)?.message || ""}
                </p>
              )}
              {reportsError && (
                <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
                  Could not load saved climate report payload for this cycle. {(reportsQueryError as Error)?.message || ""}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TabMetricCard
                  label="RCS score"
                  value={climateModel.score?.rcs != null ? `${climateModel.score.rcs}/100` : "—"}
                />
                <TabMetricCard
                  label="Tier"
                  value={climateModel.score?.tier != null ? `Tier ${climateModel.score.tier}` : "—"}
                />
                <TabMetricCard
                  label="Status"
                  value={
                    climateModel.score?.criticalAttention ? (
                      <span className="text-emerald-700">Critical attention</span>
                    ) : climateModel.score ? (
                      "Stable"
                    ) : (
                      "—"
                    )
                  }
                />
                <TabMetricCard label="Risk drivers" value={climateModel.riskDriversCount} />
                <TabMetricCard label="Responses saved" value={climateModel.responsesCount} />
                <TabMetricCard label="Red flags" value={climateModel.redFlags} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TabMetricCard
                  label="Critical attention"
                  value={climateModel.score ? (climateModel.score.criticalAttention ? "Yes" : "No") : "—"}
                />
                <TabMetricCard label="Top risk" value={climateModel.topRiskTitle} />
                <TabMetricCard
                  label="Top risk severity"
                  value={climateModel.topRiskSeverity != null ? `${climateModel.topRiskSeverity}%` : "—"}
                />
                <TabMetricCard label="Evidence items" value={climateModel.evidenceCount} />
                <TabMetricCard label="Evidence coverage" value={`${climateModel.evidenceCoveragePct}%`} />
                <TabMetricCard
                  label="Avg. risk severity"
                  value={climateModel.avgRiskSeverity != null ? `${climateModel.avgRiskSeverity}%` : "—"}
                />
              </div>
              <p className="text-xs text-muted-foreground">Viewing saved assessment (read-only). Cycle: {cycleLabel}</p>
              <AdminClimateChartSection
                score={climateScore}
                topRisks={climateData?.topRisks ?? []}
                evidence={climateData?.evidence ?? []}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            All cycles (facility)
          </CardTitle>
          <CardDescription>Up to 500 rows from assessment_cycles. Click to select.</CardDescription>
        </CardHeader>
        <CardContent>
          {cyclesLoading ? (
            <div className="py-10 flex justify-center">
              <div className="h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cycles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cycles.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase font-semibold text-gray-600">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cycles.map((c) => (
                    <tr
                      key={c.id}
                      className={cn("cursor-pointer hover:bg-gray-50", c.id === selectedCycleId && "bg-emerald-50/70")}
                      onClick={() => setSelectedCycleId(c.id)}
                    >
                      <td className="px-3 py-2 font-medium">{c.assessmentNumber ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{c.status}</Badge>
                      </td>
                      <td className="px-3 py-2">{formatDate(c.startedAt)}</td>
                      <td className="px-3 py-2">{formatDate(c.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
