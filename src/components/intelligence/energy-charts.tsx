"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MeuSummary, SizingSummary } from "@/components/solar/afya-solar-sizing-tool"
import { formatCurrency } from "@/lib/utils"
import type { IntelligenceRecommendation } from "@/lib/intelligence/recommendations"

const GREEN = "#16a34a"
const GREEN_LIGHT = "#86efac"
const EMERALD = "#059669"
const MUTED = "#e5e7eb"

function ChartFallback({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 text-sm text-emerald-800/80">
      {message}
    </div>
  )
}

export function LoadBreakdownBarChart({ meu }: { meu: MeuSummary | null }) {
  const data =
    meu?.topDevices.map((d) => ({
      name: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
      kwh: Number(d.dailyKwh.toFixed(2)),
    })) ?? []

  if (!data.length) {
    return <ChartFallback message="Enter devices to see load breakdown by equipment." />
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis type="number" unit=" kWh" className="text-xs" />
        <YAxis type="category" dataKey="name" width={100} className="text-[10px]" tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => [`${v} kWh/day`, "Demand"]} />
        <Bar dataKey="kwh" name="kWh/day" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? EMERALD : GREEN} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const DONUT_COLORS = ["#16a34a", "#059669", "#34d399", "#6ee7b7", "#a7f3d0", "#86efac", "#bbf7d0", "#d1fae5"]

export function EnergyMixDonutChart({ meu }: { meu: MeuSummary | null }) {
  const raw = meu?.categoryBreakdown ?? []
  const data = raw.filter((d) => d.kwh > 0).map((d) => ({ name: d.category, value: Number(d.kwh.toFixed(2)) }))

  if (!data.length) {
    return <ChartFallback message="Tag device categories to see the energy mix donut." />
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [`${v} kWh/day`, ""]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function CriticalLoadStackedBar({ meu }: { meu: MeuSummary | null }) {
  const t = meu?.totalDailyLoad ?? 0
  const c = meu?.criticalityBreakdown
  if (!c || t <= 0) {
    return <ChartFallback message="Enter loads with criticality tags to compare critical vs other energy." />
  }

  const data = [
    {
      label: "Daily kWh",
      critical: Number(c.critical.toFixed(2)),
      essential: Number(c.essential.toFixed(2)),
      nonEssential: Number(c.nonEssential.toFixed(2)),
    },
  ]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="label" />
        <YAxis unit=" kWh" className="text-xs" />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="critical" stackId="a" fill="#14532d" name="Critical" />
        <Bar dataKey="essential" stackId="a" fill={EMERALD} name="Essential" />
        <Bar dataKey="nonEssential" stackId="a" fill={GREEN_LIGHT} name="Non-essential" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CostCompositionChart({
  annualGrid,
  annualDiesel,
  outageHoursPerDay,
  monthlyBaseline,
}: {
  annualGrid: number
  annualDiesel: number
  outageHoursPerDay: number
  monthlyBaseline: number
}) {
  /** Rough outage-cost proxy: share of month in outage × baseline */
  const outageCostMonthly = monthlyBaseline * Math.min(1, (outageHoursPerDay * 30) / (24 * 30))
  const gridAnnual = annualGrid
  const dieselAnnual = annualDiesel
  const outageAnnual = outageCostMonthly * 12

  const data = [
    { name: "Grid (est.)", value: Math.max(0, gridAnnual) },
    { name: "Diesel (est.)", value: Math.max(0, dieselAnnual) },
    { name: "Outage exposure (est.)", value: Math.max(0, outageAnnual) },
  ].filter((d) => d.value > 0)

  if (!data.length) {
    return <ChartFallback message="Add grid bill or diesel use to see cost composition." />
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={(v) => formatCurrency(v)} className="text-[10px]" width={72} />
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Bar dataKey="value" name="TZS / yr" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? GREEN : i === 1 ? EMERALD : MUTED} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SavingsWaterfallSimplified({
  currentAnnual,
  savingsAnnual,
}: {
  currentAnnual: number
  savingsAnnual: number
}) {
  if (currentAnnual <= 0 && savingsAnnual <= 0) {
    return <ChartFallback message="Complete cost inputs to see a savings bridge view." />
  }

  const after = Math.max(0, currentAnnual - savingsAnnual)
  const data = [
    { name: "Current annual (est.)", value: Number(currentAnnual.toFixed(0)), fill: "#dc2626" },
    { name: "After solar (est.)", value: Number(after.toFixed(0)), fill: EMERALD },
    { name: "Modelled savings / yr", value: Number(Math.min(currentAnnual, savingsAnnual).toFixed(0)), fill: GREEN },
  ]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="name" interval={0} tick={{ fontSize: 9 }} angle={-12} textAnchor="end" height={56} />
        <YAxis tickFormatter={(v) => formatCurrency(v)} className="text-[10px]" width={68} />
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function OutageExposureTimeline({
  outageHoursPerDay,
  backupHoursAvailable,
}: {
  outageHoursPerDay: number
  backupHoursAvailable: number
}) {
  const outage = Math.max(0, Math.min(24, outageHoursPerDay))
  const backup = Math.max(0, Math.min(24, backupHoursAvailable))
  const unprotected = Math.max(0, outage - backup)

  const data = [
    {
      label: "Daily exposure (hours)",
      outage,
      backup: Math.min(outage, backup),
      unprotected,
    },
  ]

  if (outage <= 0) {
    return <ChartFallback message="Add outage hours/day to see exposure and unprotected hours." />
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis unit=" h" tick={{ fontSize: 10 }} domain={[0, 24]} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="backup" stackId="a" fill={EMERALD} name="Backup covered" />
        <Bar dataKey="unprotected" stackId="a" fill="#dc2626" name="Unprotected outage" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SolarCoverageSimulationChart({
  sizing,
}: {
  sizing: SizingSummary | null
}) {
  if (!sizing || sizing.totalDailyLoad <= 0) {
    return <ChartFallback message="Run the design engine to see a solar + battery coverage simulation." />
  }

  const demand = sizing.totalDailyLoad
  // Simple illustrative split: solar covers 55%, battery covers 20%, remainder grid/diesel.
  // This is intentionally a visualization aid; the sizing engine remains source-of-truth.
  const solar = demand * 0.55
  const battery = demand * 0.2
  const remaining = Math.max(0, demand - solar - battery)

  const data = [
    { name: "Daily demand", value: Number(demand.toFixed(2)), fill: "#0f172a" },
    { name: "Solar daytime offset (est.)", value: Number(solar.toFixed(2)), fill: GREEN },
    { name: "Battery backup (est.)", value: Number(battery.toFixed(2)), fill: EMERALD },
    { name: "Grid/diesel remainder (est.)", value: Number(remaining.toFixed(2)), fill: "#f59e0b" },
  ]

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="name" interval={0} angle={-14} textAnchor="end" height={62} tick={{ fontSize: 10 }} />
        <YAxis unit=" kWh" tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => [`${v} kWh/day`, ""]} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function OpportunityMatrix({
  sizing,
  resilienceScore,
}: {
  sizing: SizingSummary | null
  resilienceScore: number | null
}) {
  if (!sizing || sizing.annualSavings <= 0 || resilienceScore == null) {
    return <ChartFallback message="Complete assessment + climate readiness to see the opportunity matrix." />
  }

  const savings = Math.max(0, sizing.annualSavings)
  const resilienceImpact = Math.max(0, Math.min(100, resilienceScore))

  const data = [{ x: savings, y: resilienceImpact, z: 1, label: "This facility" }]

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis
          type="number"
          dataKey="x"
          name="Savings"
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => formatCurrency(v)}
          label={{ value: "Cost savings potential (TZS/yr)", position: "insideBottom", offset: -10, fontSize: 10 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Resilience"
          tick={{ fontSize: 10 }}
          domain={[0, 100]}
          label={{ value: "Resilience score (0–100)", angle: -90, position: "insideLeft", fontSize: 10 }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(v: number, name: string) => {
            if (name === "Savings") return [formatCurrency(v), name]
            return [v, name]
          }}
        />
        <Scatter name="Facility" data={data} fill={EMERALD} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function ActionPriorityChart({
  recommendations,
}: {
  recommendations: IntelligenceRecommendation[]
}) {
  if (!recommendations || recommendations.length === 0) {
    return <ChartFallback message="Complete assessment inputs to generate and visualize prioritized actions." />
  }

  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 }
  const horizonWeight: Record<string, number> = { immediate: 3, medium: 2, capital: 1 }

  const data = recommendations.slice(0, 12).map((r, idx) => {
    const score = (priorityWeight[r.priority] || 1) * 10 + (horizonWeight[r.horizon] || 1) * 3
    return {
      name: r.title.length > 18 ? `${r.title.slice(0, 16)}…` : r.title,
      score,
      priority: r.priority,
      horizon: r.horizon,
      fill: r.priority === "high" ? "#dc2626" : r.priority === "medium" ? "#f59e0b" : EMERALD,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 36 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="name" interval={0} angle={-14} textAnchor="end" height={64} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v: number, name: string, ctx: any) => {
            const payload = ctx?.payload
            const extra =
              payload?.priority && payload?.horizon ? ` (${payload.priority}, ${payload.horizon})` : ""
            return [`${v}${extra}`, "Priority score"]
          }}
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ImprovementTimelineChart({
  points,
}: {
  points: { date: string; value: number }[]
}) {
  if (!points || points.length < 2) {
    return <ChartFallback message="Complete and save assessments over time to see trend." />
  }

  const data = points.map((p) => ({ date: p.date.slice(5), value: p.value }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-emerald-100" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="value" name="Score" stroke={EMERALD} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function IntelligenceChartGrid({
  meu,
  sizing,
  facilityExtras,
  resilienceScore,
  recommendations,
  bmiTrend,
}: {
  meu: MeuSummary | null
  sizing: SizingSummary | null
  facilityExtras?: {
    averageOutageHours: number
    facilityType: "on-grid" | "off-grid" | "hybrid"
    monthlyGridBill: number
    dieselLitresPerDay: number
    dieselPricePerLitre: number
  }
  resilienceScore?: number | null
  recommendations?: IntelligenceRecommendation[]
  bmiTrend?: { date: string; value: number }[]
}) {
  const annualGrid = sizing?.annualGridCost ?? 0
  const annualDiesel = sizing?.annualDieselCost ?? 0
  const averageOutageHours = facilityExtras?.averageOutageHours ?? 0
  const monthlyGridBill = facilityExtras?.monthlyGridBill ?? 0
  const dieselLitresPerDay = facilityExtras?.dieselLitresPerDay ?? 0
  const dieselPrice = facilityExtras?.dieselPricePerLitre ?? 0
  const facilityType = facilityExtras?.facilityType ?? "on-grid"
  const currentAnnualForWaterfall =
    facilityType === "off-grid" ? annualDiesel : facilityType === "on-grid" ? annualGrid : annualGrid + annualDiesel
  const savingsAnnual = sizing?.annualSavings ?? 0

  const monthlyBaseline =
    facilityType === "on-grid"
      ? monthlyGridBill
      : facilityType === "off-grid"
        ? dieselLitresPerDay * dieselPrice * 30
        : monthlyGridBill + dieselLitresPerDay * dieselPrice * 30

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Load breakdown</CardTitle>
          <CardDescription className="text-xs">Top equipment by daily kWh</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadBreakdownBarChart meu={meu} />
        </CardContent>
      </Card>
      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Energy mix by category</CardTitle>
          <CardDescription className="text-xs">Share of consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <EnergyMixDonutChart meu={meu} />
        </CardContent>
      </Card>
      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Critical vs other load</CardTitle>
          <CardDescription className="text-xs">Continuity-oriented view</CardDescription>
        </CardHeader>
        <CardContent>
          <CriticalLoadStackedBar meu={meu} />
        </CardContent>
      </Card>
      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cost composition (indicative)</CardTitle>
          <CardDescription className="text-xs">Grid, diesel, rough outage exposure</CardDescription>
        </CardHeader>
        <CardContent>
          <CostCompositionChart
            annualGrid={annualGrid}
            annualDiesel={annualDiesel}
            outageHoursPerDay={averageOutageHours}
            monthlyBaseline={monthlyBaseline}
          />
        </CardContent>
      </Card>
      <Card className="border-emerald-100 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Savings bridge (simplified)</CardTitle>
          <CardDescription className="text-xs">Current vs estimated after solar offset slider</CardDescription>
        </CardHeader>
        <CardContent>
          <SavingsWaterfallSimplified currentAnnual={currentAnnualForWaterfall} savingsAnnual={savingsAnnual} />
        </CardContent>
      </Card>

      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Outage exposure timeline</CardTitle>
          <CardDescription className="text-xs">Outage hours vs backup covered vs unprotected</CardDescription>
        </CardHeader>
        <CardContent>
          <OutageExposureTimeline outageHoursPerDay={averageOutageHours} backupHoursAvailable={4} />
        </CardContent>
      </Card>

      <Card className="border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Solar coverage simulation</CardTitle>
          <CardDescription className="text-xs">Illustrative: demand vs solar + battery contribution</CardDescription>
        </CardHeader>
        <CardContent>
          <SolarCoverageSimulationChart sizing={sizing} />
        </CardContent>
      </Card>

      <Card className="border-emerald-100 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Energy–resilience opportunity matrix</CardTitle>
          <CardDescription className="text-xs">Cost savings potential vs resilience score</CardDescription>
        </CardHeader>
        <CardContent>
          <OpportunityMatrix sizing={sizing} resilienceScore={resilienceScore ?? null} />
        </CardContent>
      </Card>

      <Card className="border-emerald-100 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Action priority chart</CardTitle>
          <CardDescription className="text-xs">Ranked actions by risk + impact + feasibility (proxy)</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionPriorityChart recommendations={recommendations ?? []} />
        </CardContent>
      </Card>

      <Card className="border-emerald-100 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Efficiency score trend</CardTitle>
          <CardDescription className="text-xs">Before/after over reassessments (local history)</CardDescription>
        </CardHeader>
        <CardContent>
          <ImprovementTimelineChart points={bmiTrend ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

/** Placeholder radar for climate resilience (Phase 3). */
export function ResilienceRadarPlaceholder() {
  return (
    <ChartFallback message="Climate resilience radar (HES / CSF / ECPQ / EDC / RRC) will appear after you complete a resilience assessment." />
  )
}
