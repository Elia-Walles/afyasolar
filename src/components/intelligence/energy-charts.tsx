"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MeuSummary, SizingSummary } from "@/components/solar/afya-solar-sizing-tool"
import { formatCurrency } from "@/lib/utils"

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

export function IntelligenceChartGrid({
  meu,
  sizing,
  facilityExtras,
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
    </div>
  )
}

/** Placeholder radar for climate resilience (Phase 3). */
export function ResilienceRadarPlaceholder() {
  return (
    <ChartFallback message="Climate resilience radar (HES / CSF / ECPQ / EDC / RRC) will appear after you complete a resilience assessment." />
  )
}
