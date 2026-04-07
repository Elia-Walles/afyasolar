'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Gauge,
  TrendingDown,
  Zap,
  Building2,
  ChevronRight,
  CheckCircle2,
  Leaf,
  BarChart3,
  RefreshCw,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ManagementPanelPageSkeleton,
  ManagementPanelErrorState,
} from '@/components/management-panel/management-panel-loading'
import { Button } from '@/components/ui/button'

interface SimulatedFacility {
  id: string
  name: string
  location: string
  region: string
  facilityType: string
  status: string
  energyConsumptionBefore: number
  energyConsumptionAfter: number
  monthlyEnergySavings: number
  solarCapacity: number
  batteryCapacity: number
  carbonEmissionReduction: number
}

// Simulated but consistent efficiency data per facility (derived from id + name hash)
function getEfficiencyData(f: SimulatedFacility) {
  const reductionPercent =
    f.energyConsumptionBefore > 0
      ? Math.round((f.monthlyEnergySavings / f.energyConsumptionBefore) * 100)
      : 0
  const hash = (f.id + f.name).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const seed = hash % 100

  const score = Math.min(100, Math.max(45, reductionPercent + 35 + (seed % 15)))
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D'
  const euiBefore = (f.energyConsumptionBefore * (12 + (seed % 8))) / 100
  const euiAfter = (f.energyConsumptionAfter * (12 + (seed % 8))) / 100
  const vsBenchmark = (seed % 3 === 0 ? -1 : 1) * (8 + (seed % 10))
  const improvements = [
    'Solar PV installation',
    'Battery backup & peak shaving',
    'LED lighting upgrade',
    'Smart metering & monitoring',
    'Power factor correction',
    'Cooling system optimization',
  ]
  const numImprovements = 2 + (seed % 3)
  const start = seed % improvements.length
  const keyImprovements = []
  for (let i = 0; i < numImprovements; i++) {
    keyImprovements.push(improvements[(start + i) % improvements.length])
  }

  return {
    score: Math.round(score),
    grade,
    euiBefore: Math.round(euiBefore * 10) / 10,
    euiAfter: Math.round(euiAfter * 10) / 10,
    vsSectorBenchmark: vsBenchmark,
    keyImprovements,
    trend: seed % 5 === 0 ? 'Stable' : 'Improving',
    reductionPercent,
  }
}

type EfficiencyData = ReturnType<typeof getEfficiencyData>

const gradeColors: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-gray-100 text-gray-800 border-gray-200',
}

type MeterInsight = {
  paymentModel: string
  source: string
  summary: {
    avgEfficiencyPct: number
    underperformingDays: number
    latestUnderperforming: boolean
  }
  billingContext: string
}

export function ManagementPanelEnergyEfficiency() {
  const [facilities, setFacilities] = useState<SimulatedFacility[]>([])
  const [efficiencyMap, setEfficiencyMap] = useState<Record<string, EfficiencyData>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFacility, setSelectedFacility] = useState<SimulatedFacility | null>(null)
  const [meterInsight, setMeterInsight] = useState<MeterInsight | null>(null)
  const [meterLoading, setMeterLoading] = useState(false)

  const fetchData = async () => {
    try {
      setError(null)
      setRefreshing(true)
      const res = await fetch('/api/management-panel/facilities')
      if (!res.ok) throw new Error('Failed to fetch facilities')
      const data = await res.json()
      const list = data.facilities || []
      setFacilities(list)
      const map: Record<string, EfficiencyData> = {}
      list.forEach((f: SimulatedFacility) => {
        map[f.id] = getEfficiencyData(f)
      })
      setEfficiencyMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load efficiency data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!selectedFacility) {
      setMeterInsight(null)
      return
    }
    let cancelled = false
    setMeterLoading(true)
    const qs = new URLSearchParams({
      facilityId: selectedFacility.id,
      solarCapacityKw: String(selectedFacility.solarCapacity || 5),
      mock: "1",
    })
    fetch(`/api/management-panel/efficiency-meter?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.data) {
          setMeterInsight({
            paymentModel: j.data.paymentModel,
            source: j.data.source,
            summary: j.data.summary,
            billingContext: j.data.billingContext,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setMeterInsight(null)
      })
      .finally(() => {
        if (!cancelled) setMeterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedFacility])

  const overallScore =
    facilities.length > 0
      ? Math.round(
          facilities.reduce((sum, f) => sum + (efficiencyMap[f.id]?.score ?? 0), 0) / facilities.length
        )
      : 0
  const overallGrade = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : 'D'

  if (loading) {
    return <ManagementPanelPageSkeleton titleWidth="w-44" rows={5} />
  }

  if (error) {
    return (
      <ManagementPanelErrorState
        title="Unable to load efficiency data"
        message={error}
        onRetry={fetchData}
      />
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="animate-in fade-in duration-300">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Energy Efficiency</h1>
          <p className="text-sm text-gray-500 mt-1">Efficiency scores, EUI, and improvements by facility</p>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                Average efficiency score
                <span title="0–100 score for energy use after solar; higher is better." className="text-gray-400 cursor-help">
                  <HelpCircle className="w-3.5 h-3.5" />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{overallScore}</p>
              <Badge className={cn('mt-2', gradeColors[overallGrade])}>Grade {overallGrade}</Badge>
            </CardContent>
          </Card>
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Sites improving
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {Object.values(efficiencyMap).filter((e) => e.trend === 'Improving').length}
              </p>
              <p className="text-sm text-gray-500 mt-1">of {facilities.length} sites</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Total energy saved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                {facilities
                  .reduce((sum, f) => sum + (f.monthlyEnergySavings ?? 0), 0)
                  .toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">kWh per month</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-facility efficiency cards */}
        <Card className="rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5" />
              Efficiency by facility
            </CardTitle>
            <CardDescription>
              Click a row to view full efficiency details and improvements
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden scroll-smooth [scrollbar-gutter:stable]">
              {facilities.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Gauge className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No facility data loaded.</p>
                </div>
              )}
              {facilities.map((f) => {
                const eff = efficiencyMap[f.id]
                if (!eff) return null
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFacility(f)}
                    className={cn(
                      'w-full text-left flex flex-wrap items-center gap-4 p-4 border-b last:border-b-0',
                      'transition-colors hover:bg-gray-50 focus:outline-none focus:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{f.name}</p>
                        <p className="text-sm text-gray-500">
                          {f.location}, {f.region} · {f.facilityType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Score</p>
                        <p className="text-lg font-bold text-gray-900">{eff.score}</p>
                      </div>
                      <Badge className={cn('shrink-0', gradeColors[eff.grade])}>
                        Grade {eff.grade}
                      </Badge>
                      <div className="text-center" title="Energy Use Intensity: consumption per m² per month; lower is better.">
                        <p className="text-xs text-gray-500">EUI (now)</p>
                        <p className="text-sm font-medium text-gray-700">{eff.euiAfter} kWh/m²/mo</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {eff.trend}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedFacility} onOpenChange={(open) => !open && setSelectedFacility(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scroll-smooth">
          {selectedFacility && efficiencyMap[selectedFacility.id] && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Energy efficiency – {selectedFacility.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedFacility.location}, {selectedFacility.region} · {selectedFacility.facilityType}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-2">
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    Meter-based yield (demo)
                  </h4>
                  {meterLoading && <p className="text-xs text-gray-500">Loading meter insight…</p>}
                  {!meterLoading && meterInsight && (
                    <>
                      <p className="text-xs text-gray-600">
                        Model: <span className="font-medium">{meterInsight.paymentModel}</span> · Data:{" "}
                        <span className="font-medium">{meterInsight.source}</span>
                      </p>
                      <p className="text-sm text-gray-800">
                        Avg efficiency {meterInsight.summary.avgEfficiencyPct}% · Underperforming days:{" "}
                        {meterInsight.summary.underperformingDays}
                        {meterInsight.summary.latestUnderperforming && (
                          <Badge className="ml-2 bg-amber-100 text-amber-900 border-amber-200">Latest: low</Badge>
                        )}
                      </p>
                      <p className="text-xs text-gray-600">{meterInsight.billingContext}</p>
                    </>
                  )}
                  {!meterLoading && !meterInsight && (
                    <p className="text-xs text-gray-500">Could not load meter insight.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-6 text-center min-w-[120px]">
                    <p className="text-4xl font-bold text-gray-900">{efficiencyMap[selectedFacility.id].score}</p>
                    <p className="text-sm text-gray-500 mt-1">Efficiency score</p>
                  </div>
                  <Badge className={cn('text-base px-4 py-2', gradeColors[efficiencyMap[selectedFacility.id].grade])}>
                    Grade {efficiencyMap[selectedFacility.id].grade}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    {efficiencyMap[selectedFacility.id].trend}
                  </Badge>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Energy use intensity (EUI)
                    <span title="Energy consumption per square metre per month; used to compare similar facilities." className="text-gray-400 cursor-help ml-1 inline-flex align-middle">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </span>
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Before</span>
                    <span className="font-medium">{efficiencyMap[selectedFacility.id].euiBefore} kWh/m²/month</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">After</span>
                    <span className="font-medium text-emerald-600">{efficiencyMap[selectedFacility.id].euiAfter} kWh/m²/month</span>
                  </div>
                  <p className="text-xs text-gray-500 pt-1">
                    Simulated per m² for comparison with sector benchmarks.
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Vs sector benchmark</h4>
                  <p className="text-sm text-gray-700">
                    {efficiencyMap[selectedFacility.id].vsSectorBenchmark > 0
                      ? `${efficiencyMap[selectedFacility.id].vsSectorBenchmark}% below sector average`
                      : `${Math.abs(efficiencyMap[selectedFacility.id].vsSectorBenchmark)}% above sector average`}{' '}
                    for similar facilities.
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Key improvements implemented
                  </h4>
                  <ul className="space-y-2">
                    {efficiencyMap[selectedFacility.id].keyImprovements.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-gray-50 border p-4 flex items-start gap-3">
                  <Leaf className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Carbon impact</p>
                    <p className="text-sm text-gray-600">
                      {selectedFacility.carbonEmissionReduction} kg CO₂ equivalent reduced per month
                      from lower grid consumption and solar generation.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
