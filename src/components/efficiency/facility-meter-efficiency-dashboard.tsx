"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Activity, AlertTriangle, Gauge, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

type EfficiencyPayload = {
  paymentModel: string
  billingContext: string
  source: string
  summary: {
    avgEfficiencyPct: number
    avgPerformanceRatio: number
    underperformingDays: number
    latestUnderperforming: boolean
    avgProducedKwh: number
    avgExpectedKwh: number
  }
  daily: {
    snapshotDate: string
    producedKwh: number
    expectedKwh: number
    consumedKwh: number
    avgIrradianceWm2: number
    performanceRatio: number
    degradationYearlyPct: number
    efficiencyPct: number
    underperforming: boolean
    billingNote: string
    dataSource: string
  }[]
  alerts: { level: string; message: string; date?: string }[]
}

interface FacilityMeterEfficiencyDashboardProps {
  facilityId?: string | null
  /** Force simulated series (demo) */
  preferMock?: boolean
}

export function FacilityMeterEfficiencyDashboard({
  facilityId,
  preferMock = false,
}: FacilityMeterEfficiencyDashboardProps) {
  const [data, setData] = useState<EfficiencyPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (evaluateAlerts?: boolean) => {
      if (!facilityId) return
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({
          days: "30",
          ...(preferMock ? { mock: "1" } : {}),
          ...(evaluateAlerts ? { evaluateAlerts: "1" } : {}),
        })
        const res = await fetch(`/api/facility/${facilityId}/efficiency-performance?${qs}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load")
        setData(json.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    },
    [facilityId, preferMock]
  )

  useEffect(() => {
    load(false)
  }, [load])

  if (!facilityId) {
    return null
  }

  const chartData =
    data?.daily.map((d) => ({
      date: d.snapshotDate.slice(5),
      produced: d.producedKwh,
      expected: d.expectedKwh,
      irradiance: d.avgIrradianceWm2,
      pr: d.performanceRatio,
    })) ?? []

  return (
    <Card className="border-emerald-100 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-5 w-5 text-emerald-600" />
            Meter-based efficiency
          </CardTitle>
          <CardDescription className="text-xs mt-1 max-w-xl">
            Actual vs expected yield (kWh), irradiance, inverter performance ratio, and estimated yearly degradation —{" "}
            <span className="font-medium">blends smart-meter data when present</span> with deterministic demo data for
            empty sites.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => load(false)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
            <Activity className="h-4 w-4 mr-1" />
            Check &amp; notify
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <Badge variant="outline">Payment model: {data.paymentModel}</Badge>
              <Badge variant="outline">Data: {data.source}</Badge>
              {data.summary.latestUnderperforming && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-200">Latest period underperforming</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Avg efficiency</p>
                <p className="text-xl font-semibold">{data.summary.avgEfficiencyPct}%</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Avg perf. ratio</p>
                <p className="text-xl font-semibold">{data.summary.avgPerformanceRatio}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Underperforming days</p>
                <p className="text-xl font-semibold">{data.summary.underperformingDays}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground text-xs">Degradation (est. / yr)</p>
                <p className="text-xl font-semibold">
                  {data.daily[data.daily.length - 1]?.degradationYearlyPct?.toFixed?.(2) ??
                    data.daily[data.daily.length - 1]?.degradationYearlyPct}
                  %
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-dashed p-3 text-xs bg-amber-50/50 text-amber-950">
              <p className="font-semibold mb-1">Billing &amp; contract context</p>
              <p>{data.billingContext}</p>
            </div>
            {data.alerts.length > 0 && (
              <div className="space-y-2">
                {data.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2 rounded-lg border p-2 text-sm",
                      a.level === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="produced" name="Produced kWh" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expected" name="Expected kWh" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="l"
                    type="monotone"
                    dataKey="irradiance"
                    name="Irradiance W/m²"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="r"
                    type="monotone"
                    dataKey="pr"
                    name="Perf. ratio"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
