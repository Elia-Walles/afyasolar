"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Battery,
  CheckCircle,
  Home,
  Lightbulb,
  Shield,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react"
import {
  type FacilityConfig,
  generateDailyData,
  generateHourlyData,
  generateLoadOptimization,
} from "@/lib/facility-data"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  Cell,
  XAxis,
  YAxis,
} from "recharts"

const CHART_COLORS = {
  solar: "#eab308",
  consumption: "#3b82f6",
  battery: "#22c55e",
  grid: "#ef4444",
  export: "#8b5cf6",
  savings: "#10b981",
}

export function DemoFacilityDashboard({ facility }: { facility: FacilityConfig }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [liveData, setLiveData] = useState({
    currentPower: facility.basePower,
    solarGeneration: facility.baseSolarGen,
    batteryLevel: facility.baseBatteryLevel,
    dailyConsumption: facility.dailyConsumption,
    creditBalance: facility.creditBalance,
  })

  const hourlyData = useMemo(() => generateHourlyData(facility), [facility])
  const dailyData = useMemo(() => generateDailyData(facility), [facility])
  const loadOpt = useMemo(() => generateLoadOptimization(facility), [facility])

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveData((prev) => {
        const hour = new Date().getHours()
        const isDaytime = hour >= 6 && hour <= 18
        return {
          currentPower: +(
            prev.currentPower +
            (Math.random() - 0.5) * (facility.systemSizeKw * 0.08)
          ).toFixed(2),
          solarGeneration: isDaytime
            ? +(
                prev.solarGeneration +
                (Math.random() - 0.5) * (facility.systemSizeKw * 0.06)
              ).toFixed(2)
            : +(Math.random() * 0.1).toFixed(2),
          batteryLevel: Math.min(
            100,
            Math.max(15, +(prev.batteryLevel + (Math.random() - 0.45) * 2).toFixed(0)),
          ),
          dailyConsumption: +(prev.dailyConsumption + Math.random() * 0.3).toFixed(2),
          creditBalance: prev.creditBalance,
        }
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [facility])

  const solarCoverage =
    facility.monthlySolarProductionKwh > 0
      ? Math.min(
          100,
          Math.round((facility.monthlySolarProductionKwh / facility.monthlyConsumptionKwh) * 100),
        )
      : 0

  const equipmentByCategory = useMemo(() => {
    return facility.equipment.reduce((acc, eq) => {
      if (!acc[eq.category]) acc[eq.category] = []
      acc[eq.category].push(eq)
      return acc
    }, {} as Record<string, FacilityConfig["equipment"]>)
  }, [facility.equipment])

  const pieData = useMemo(() => {
    return Object.entries(equipmentByCategory).map(([cat, items]) => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: +items.reduce((s, eq) => s + (eq.powerW * eq.hoursPerDay) / 1000, 0).toFixed(1),
    }))
  }, [equipmentByCategory])

  const PIE_COLORS = ["#eab308", "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#f59e0b"]

  const efficiencyGaugeData = useMemo(
    () => [
      {
        name: "Score",
        value: facility.eeatScore,
        fill: facility.eeatScore >= 70 ? "#22c55e" : facility.eeatScore >= 55 ? "#eab308" : "#ef4444",
      },
    ],
    [facility.eeatScore],
  )

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { level: "Gold", color: "text-primary" }
    if (score >= 60) return { level: "Green", color: "text-emerald-600" }
    if (score >= 40) return { level: "Yellow", color: "text-amber-600" }
    return { level: "Red", color: "text-destructive" }
  }

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "energy-live", label: "Live Energy", icon: Activity },
    { id: "efficiency", label: "Energy Efficiency", icon: Target },
    { id: "load-optimization", label: "Load Optimization", icon: Zap },
    { id: "consumption", label: "Consumption History", icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-full p-2">
              <Sun className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{facility.name}</h1>
              <p className="text-xs text-muted-foreground">
                {facility.location} | {facility.systemSizeKw}kW System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden md:flex gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              System Active
            </Badge>
            <Badge>{facility.facilityType}</Badge>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 border-r bg-card h-[calc(100vh-57px)] overflow-y-auto hidden md:block">
          <nav className="p-3 space-y-1">
            {sidebarItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "secondary" : "ghost"}
                className="w-full justify-start text-sm"
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </Button>
            ))}
          </nav>
        </aside>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 flex overflow-x-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center py-2 px-1 text-xs ${
                activeTab === item.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 mb-1" />
              {item.label.split(" ")[0]}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto h-[calc(100vh-57px)] pb-20 md:pb-6">
          <div className="space-y-6 max-w-7xl mx-auto">
            {activeTab === "overview" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold">Dashboard Overview</h2>
                  <p className="text-muted-foreground">Real-time monitoring for {facility.shortName}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Current Load</CardDescription>
                      <CardTitle className="text-2xl">
                        {Math.abs(liveData.currentPower).toFixed(1)} kW
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress
                        value={Math.min(
                          (Math.abs(liveData.currentPower) / facility.systemSizeKw) * 100,
                          100,
                        )}
                        className="h-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        of {facility.systemSizeKw}kW capacity
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Solar Generation</CardDescription>
                      <CardTitle className="text-2xl" style={{ color: CHART_COLORS.solar }}>
                        {Math.abs(liveData.solarGeneration).toFixed(1)} kW
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-xs text-emerald-600">
                        <Sun className="w-3 h-3 mr-1" />
                        {solarCoverage}% coverage
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Battery</CardDescription>
                      <CardTitle className="text-2xl">{liveData.batteryLevel}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={liveData.batteryLevel} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {facility.batteryCapacityKwh} kWh total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Today's Usage</CardDescription>
                      <CardTitle className="text-2xl">{liveData.dailyConsumption} kWh</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-xs">
                        <TrendingUp className="w-3 h-3 text-emerald-600 mr-1" />
                        <span className="text-emerald-600">Normal range</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Credit Balance</CardDescription>
                      <CardTitle className="text-2xl">TSh {liveData.creditBalance.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        ~
                        {Math.ceil(
                          liveData.creditBalance / (facility.dailyConsumption * facility.solarCostPerKwh),
                        )}{" "}
                        days remaining
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-accent">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Energy Efficiency Score</CardTitle>
                        <CardDescription>ISO 50001:2018 Compliant Assessment</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setActiveTab("efficiency")}>
                        View Details <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      <div className={`text-6xl font-bold ${getScoreLevel(facility.eeatScore).color}`}>
                        {facility.eeatScore}
                      </div>
                      <div className="flex-1">
                        <Badge
                          className={
                            facility.eeatScore >= 70
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-amber-500/10 text-amber-700"
                          }
                        >
                          {getScoreLevel(facility.eeatScore).level} Standard
                        </Badge>
                        <Progress value={facility.eeatScore} className="h-3 mt-2 mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {facility.eeatScore >= 70
                            ? "Good performance. Focus on load optimization for Gold certification."
                            : "Room for improvement. Review equipment scheduling and efficiency upgrades."}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>24-Hour Energy Profile</CardTitle>
                    <CardDescription>Solar generation vs consumption over the last 24 hours</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="solarGeneration"
                          name="Solar (kW)"
                          fill={CHART_COLORS.solar}
                          stroke={CHART_COLORS.solar}
                          fillOpacity={0.3}
                        />
                        <Area
                          type="monotone"
                          dataKey="consumption"
                          name="Consumption (kW)"
                          fill={CHART_COLORS.consumption}
                          stroke={CHART_COLORS.consumption}
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-tr from-emerald-500/5 to-accent/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-emerald-600" />
                      Monthly Savings vs Grid
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Grid Cost (Avoided)</p>
                        <p className="text-xl font-bold">TSh {facility.monthlyGridCost.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">@ TSh {facility.gridCostPerKwh}/kWh</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Solar Cost</p>
                        <p className="text-xl font-bold">
                          TSh {(facility.monthlyConsumptionKwh * facility.solarCostPerKwh).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">@ TSh {facility.solarCostPerKwh}/kWh</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Savings</p>
                        <p className="text-xl font-bold text-emerald-600">
                          TSh {facility.monthlySolarSavings.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round((facility.monthlySolarSavings / facility.monthlyGridCost) * 100)}% cost reduction
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Annual Projection</p>
                        <p className="text-xl font-bold text-emerald-600">
                          TSh {(facility.monthlySolarSavings * 12).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Based on current usage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "energy-live" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold">Live Energy Flow</h2>
                  <p className="text-muted-foreground">Real-time power generation, consumption, and storage</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Energy Flow Diagram</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 items-center text-center py-8">
                      <div className="space-y-2">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-amber-500/10">
                          <Sun className="w-10 h-10" style={{ color: CHART_COLORS.solar }} />
                        </div>
                        <p className="font-bold text-2xl" style={{ color: CHART_COLORS.solar }}>
                          {Math.abs(liveData.solarGeneration).toFixed(1)} kW
                        </p>
                        <p className="text-sm text-muted-foreground">Solar Generation</p>
                      </div>

                      <div className="space-y-2">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                          <Battery className="w-10 h-10 text-emerald-600" />
                        </div>
                        <p className="font-bold text-2xl">{liveData.batteryLevel}%</p>
                        <p className="text-sm text-muted-foreground">{facility.batteryCapacityKwh} kWh Battery</p>
                        <Badge variant={liveData.solarGeneration > liveData.currentPower ? "default" : "secondary"}>
                          {liveData.solarGeneration > liveData.currentPower ? "Charging" : "Discharging"}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                          <Zap className="w-10 h-10 text-accent" />
                        </div>
                        <p className="font-bold text-2xl">{Math.abs(liveData.currentPower).toFixed(1)} kW</p>
                        <p className="text-sm text-muted-foreground">Facility Load</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 rounded-full">
                        <ArrowRight className="w-4 h-4" style={{ color: CHART_COLORS.solar }} />
                        <span className="text-sm">
                          Solar to Load:{" "}
                          {Math.min(
                            Math.abs(liveData.solarGeneration),
                            Math.abs(liveData.currentPower),
                          ).toFixed(1)}{" "}
                          kW
                        </span>
                      </div>
                      {liveData.solarGeneration > liveData.currentPower && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full">
                          <ArrowDown className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm">
                            To Battery:{" "}
                            {(Math.abs(liveData.solarGeneration) - Math.abs(liveData.currentPower)).toFixed(1)}{" "}
                            kW
                          </span>
                        </div>
                      )}
                      {liveData.currentPower > liveData.solarGeneration && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 rounded-full">
                          <ArrowUp className="w-4 h-4 text-amber-700" />
                          <span className="text-sm">
                            From Battery:{" "}
                            {(Math.abs(liveData.currentPower) - Math.abs(liveData.solarGeneration)).toFixed(1)}{" "}
                            kW
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Hourly Generation vs Consumption</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="solarGeneration" name="Solar (kW)" fill={CHART_COLORS.solar} opacity={0.8} />
                        <Bar yAxisId="left" dataKey="consumption" name="Load (kW)" fill={CHART_COLORS.consumption} opacity={0.8} />
                        <Line yAxisId="right" type="monotone" dataKey="batteryLevel" name="Battery (%)" stroke={CHART_COLORS.battery} strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Grid Interaction (24h)</CardTitle>
                    <CardDescription>Energy imported from and exported to the grid</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="gridImport" name="Grid Import (kW)" fill={CHART_COLORS.grid} opacity={0.7} />
                        <Bar dataKey="gridExport" name="Grid Export (kW)" fill={CHART_COLORS.export} opacity={0.7} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "efficiency" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold">Energy Efficiency Assessment</h2>
                  <p className="text-muted-foreground">
                    ISO 50001:2018 compliant energy efficiency evaluation for {facility.shortName}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-accent">
                    <CardHeader>
                      <CardTitle>EEAT Score</CardTitle>
                      <CardDescription>Energy Efficiency Assessment Tool</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6">
                        <ResponsiveContainer width={160} height={160}>
                          <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="90%"
                            data={efficiencyGaugeData}
                            startAngle={180}
                            endAngle={0}
                          >
                            <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <div>
                          <p className={`text-5xl font-bold ${getScoreLevel(facility.eeatScore).color}`}>
                            {facility.eeatScore}
                          </p>
                          <Badge
                            className={
                              facility.eeatScore >= 70
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-amber-500/10 text-amber-700"
                            }
                          >
                            {getScoreLevel(facility.eeatScore).level} Standard
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-2">Solar Coverage: {solarCoverage}%</p>
                          <p className="text-sm text-muted-foreground">Load Optimization: {100 - facility.loadOptimizationPotential}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Energy Consumption by Category</CardTitle>
                      <CardDescription>Daily kWh breakdown by equipment type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value">
                            {pieData.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Energy Efficiency Assessment Form</CardTitle>
                    <CardDescription>Demo-only assessment fields</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="section1">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="section1">Power Reliability</TabsTrigger>
                        <TabsTrigger value="section2">Major Energy Uses</TabsTrigger>
                        <TabsTrigger value="section3">Baseline</TabsTrigger>
                        <TabsTrigger value="section4">Improvements</TabsTrigger>
                      </TabsList>

                      <TabsContent value="section1" className="space-y-4 pt-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Average daily power outage duration</Label>
                            <Select defaultValue="1-3">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No outages</SelectItem>
                                <SelectItem value="0-1">Less than 1 hour</SelectItem>
                                <SelectItem value="1-3">1-3 hours</SelectItem>
                                <SelectItem value="3-6">3-6 hours</SelectItem>
                                <SelectItem value="6+">More than 6 hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Backup power source</Label>
                            <Select defaultValue="solar-battery">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="diesel">Diesel generator</SelectItem>
                                <SelectItem value="solar-battery">Solar + battery</SelectItem>
                                <SelectItem value="hybrid">Hybrid (solar + diesel)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Critical equipment uptime (last 30 days)</Label>
                            <Input type="number" defaultValue="97" placeholder="%" />
                          </div>
                          <div className="space-y-2">
                            <Label>Voltage stability rating</Label>
                            <Select defaultValue="good">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="excellent">Excellent (within 5%)</SelectItem>
                                <SelectItem value="good">Good (within 10%)</SelectItem>
                                <SelectItem value="fair">Fair (within 15%)</SelectItem>
                                <SelectItem value="poor">Poor (beyond 15%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="section2" className="space-y-4 pt-4">
                        <div className="overflow-x-auto">
                          <table className="w-full border text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="p-2 text-left border">Equipment</th>
                                <th className="p-2 text-left border">Power (W)</th>
                                <th className="p-2 text-left border">Hrs/Day</th>
                                <th className="p-2 text-left border">kWh/Day</th>
                                <th className="p-2 text-left border">Rating</th>
                                <th className="p-2 text-left border">Critical</th>
                              </tr>
                            </thead>
                            <tbody>
                              {facility.equipment.map((eq, idx) => (
                                <tr key={idx} className="border-b">
                                  <td className="p-2 border font-medium">{eq.name}</td>
                                  <td className="p-2 border">{eq.powerW}</td>
                                  <td className="p-2 border">{eq.hoursPerDay}</td>
                                  <td className="p-2 border font-bold">
                                    {((eq.powerW * eq.hoursPerDay) / 1000).toFixed(2)}
                                  </td>
                                  <td className="p-2 border">
                                    <Badge
                                      variant={
                                        eq.efficiencyRating === "A"
                                          ? "default"
                                          : eq.efficiencyRating === "B"
                                            ? "secondary"
                                            : "destructive"
                                      }
                                    >
                                      {eq.efficiencyRating}
                                    </Badge>
                                  </td>
                                  <td className="p-2 border">
                                    {eq.critical ? <Badge variant="destructive">Yes</Badge> : <Badge variant="secondary">No</Badge>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="space-y-3 p-4 bg-muted rounded-lg">
                          <div className="space-y-2">
                            <Label>Top energy consumers identified</Label>
                            <Textarea
                              defaultValue={facility.equipment
                                .slice()
                                .sort((a, b) => b.powerW * b.hoursPerDay - a.powerW * a.hoursPerDay)
                                .slice(0, 3)
                                .map((e) => e.name)
                                .join(", ")}
                            />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="section3" className="space-y-4 pt-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Monthly consumption (kWh)</Label>
                            <Input type="number" defaultValue={facility.monthlyConsumptionKwh} />
                          </div>
                          <div className="space-y-2">
                            <Label>Monthly solar production (kWh)</Label>
                            <Input type="number" defaultValue={facility.monthlySolarProductionKwh} />
                          </div>
                          <div className="space-y-2">
                            <Label>Peak demand hours</Label>
                            <Input defaultValue={facility.peakHours} />
                          </div>
                          <div className="space-y-2">
                            <Label>Off-peak hours</Label>
                            <Input defaultValue={facility.offPeakHours} />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="section4" className="space-y-4 pt-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Behavioral changes recommended</Label>
                            <Textarea defaultValue="Switch off non-critical loads during peak solar hours. Schedule heavy equipment during off-peak times." />
                          </div>
                        </div>
                        <Button className="w-full mt-4">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Submit Assessment for Review
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "load-optimization" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold">Intelligent Load Optimization</h2>
                  <p className="text-muted-foreground">
                    Demo-only scheduling to maximize solar utilization and reduce costs
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-emerald-500/30">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Optimization Score</CardDescription>
                      <CardTitle className="text-3xl text-emerald-600">{loadOpt.optimizationScore}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={loadOpt.optimizationScore} className="h-1.5" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Shiftable Loads</CardDescription>
                      <CardTitle className="text-3xl">{loadOpt.shiftableLoadCount}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">of {facility.equipment.length} total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Daily Savings Potential</CardDescription>
                      <CardTitle className="text-2xl text-emerald-600">TSh {loadOpt.totalPotentialDailySavings.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">from load shifting</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Monthly Savings</CardDescription>
                      <CardTitle className="text-2xl text-emerald-600">TSh {loadOpt.totalPotentialMonthlySavings.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">projected from optimization</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Load Classification</CardTitle>
                    <CardDescription>Critical loads vs loads that can be shifted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-5 h-5 text-destructive" />
                          <h4 className="font-semibold">Critical Loads ({facility.criticalLoadKw} kW)</h4>
                        </div>
                        <div className="space-y-2">
                          {loadOpt.schedule
                            .filter((s) => s.critical)
                            .map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 border rounded-lg bg-destructive/5">
                                <div>
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.powerW}W x {item.hoursPerDay}h = {item.dailyKwh} kWh/day
                                  </p>
                                </div>
                                <Badge variant="destructive">Critical</Badge>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="w-5 h-5 text-amber-600" />
                          <h4 className="font-semibold">Shiftable Loads ({facility.nonCriticalLoadKw} kW)</h4>
                        </div>
                        <div className="space-y-2">
                          {loadOpt.schedule
                            .filter((s) => s.canShiftToOffPeak)
                            .map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 border rounded-lg bg-amber-500/5">
                                <div>
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.powerW}W x {item.hoursPerDay}h = {item.dailyKwh} kWh/day
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="secondary">Shift</Badge>
                                  {item.potentialSavings > 0 && (
                                    <p className="text-xs text-emerald-600 mt-1">Save TSh {item.potentialSavings}/day</p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "consumption" && (
              <>
                <div>
                  <h2 className="text-2xl font-bold">Consumption History</h2>
                  <p className="text-muted-foreground">30-day energy consumption and solar production trends</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Consumption vs Solar Production</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="solarProduction" name="Solar (kWh)" fill={CHART_COLORS.solar} opacity={0.8} />
                        <Bar dataKey="consumption" name="Consumption (kWh)" fill={CHART_COLORS.consumption} opacity={0.8} />
                        <Bar dataKey="gridUsage" name="Grid Import (kWh)" fill={CHART_COLORS.grid} opacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Savings (TSh)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="savings" name="Daily Savings (TSh)" fill={CHART_COLORS.savings} stroke={CHART_COLORS.savings} fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

