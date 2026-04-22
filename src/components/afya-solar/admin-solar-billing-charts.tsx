"use client"

import { useMemo } from "react"
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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/utils"

export type SolarBillingAccessPaymentRow = {
  amount: string | number
  status: string
  paidAt?: string | Date | null
  createdAt?: string | Date | null
}

const CHART_COLORS = ["#059669", "#d97706", "#dc2626", "#6366f1", "#64748b"]

function timeRangeCutoffMs(range: "7d" | "30d" | "90d" | "1y"): number {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  switch (range) {
    case "7d":
      return now - 7 * day
    case "30d":
      return now - 30 * day
    case "90d":
      return now - 90 * day
    case "1y":
      return now - 365 * day
    default:
      return now - 30 * day
  }
}

function rowEffectiveMs(row: SolarBillingAccessPaymentRow): number {
  const raw = row.paidAt ?? row.createdAt
  if (!raw) return 0
  const t = typeof raw === "string" ? new Date(raw).getTime() : raw.getTime()
  return Number.isNaN(t) ? 0 : t
}

function formatMonthLabel(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function AdminSolarBillingCharts({
  payments,
  timeRange,
  isLoading = false,
}: {
  payments: SolarBillingAccessPaymentRow[]
  timeRange: "7d" | "30d" | "90d" | "1y"
  isLoading?: boolean
}) {
  const cutoff = timeRangeCutoffMs(timeRange)

  const inWindow = useMemo(
    () => payments.filter((p) => rowEffectiveMs(p) >= cutoff),
    [payments, cutoff]
  )

  const byMonth = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of inWindow) {
      if (String(p.status).toLowerCase() !== "completed") continue
      const ms = rowEffectiveMs(p)
      if (!ms) continue
      const key = formatMonthLabel(ms)
      m.set(key, (m.get(key) || 0) + Number(p.amount || 0))
    }
    return [...m.entries()]
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [inWindow])

  const byStatus = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>()
    for (const p of inWindow) {
      const st = String(p.status || "unknown")
      const cur = m.get(st) || { count: 0, amount: 0 }
      cur.count += 1
      cur.amount += Number(p.amount || 0)
      m.set(st, cur)
    }
    return [...m.entries()].map(([name, v]) => ({ name, value: v.amount, count: v.count }))
  }, [inWindow])

  const cumulative = useMemo(() => {
    const completed = inWindow
      .filter((p) => String(p.status).toLowerCase() === "completed")
      .map((p) => ({ t: rowEffectiveMs(p), amt: Number(p.amount || 0) }))
      .filter((x) => x.t > 0)
      .sort((a, b) => a.t - b.t)
    let sum = 0
    return completed.map((x) => {
      sum += x.amt
      return {
        date: new Date(x.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        cumulative: sum,
        sortKey: x.t,
      }
    })
  }, [inWindow])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment charts</CardTitle>
          <CardDescription className="text-xs">Preparing chart data for the selected window.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (inWindow.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment charts</CardTitle>
          <CardDescription className="text-xs">
            No Afya Solar access payments in the selected {timeRange} window.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-emerald-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Payment analytics</CardTitle>
        <CardDescription className="text-xs">Window: {timeRange}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="volume">
          <TabsList className="mb-3 grid w-full grid-cols-3">
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="status">Status mix</TabsTrigger>
            <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
          </TabsList>
          <TabsContent value="volume" className="h-[290px]">
            {byMonth.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No completed payments in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(Number(v))} width={72} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" name="Amount" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
          <TabsContent value="status" className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label={(props: { name?: string; payload?: { name?: string; count?: number } }) => {
                    const pl = props.payload ?? {}
                    return `${pl.name ?? props.name ?? ""} (${pl.count ?? 0})`
                  }}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </TabsContent>
          <TabsContent value="cumulative" className="h-[290px]">
            {cumulative.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No completed payments to plot.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulative} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(Number(v))} width={72} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
