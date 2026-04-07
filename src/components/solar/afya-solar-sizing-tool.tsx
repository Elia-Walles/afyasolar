 "use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Calculator, DollarSign, Battery, Zap, Plus, Trash2, Download, BarChart3, LayoutGrid, Table2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency } from "@/lib/utils"
import {
  DEVICE_BUNDLES,
  DEVICE_CATEGORY_LABELS,
  DEVICE_TEMPLATES,
  CRITICALITY_LABELS,
  type CriticalityId,
  type DeviceCategoryId,
  getTemplateById,
} from "@/lib/intelligence/device-library"

interface Device {
  id: string
  deviceName: string
  wattage: number
  quantity: number
  hoursPerDay: number
  category: DeviceCategoryId
  criticality: CriticalityId
  backupRequired: boolean
  room: string
}

interface FacilityData {
  averageOutageHours: number
  facilityType: "on-grid" | "off-grid" | "hybrid"
  monthlyGridBill: number
  dieselLitresPerDay: number
  dieselPricePerLitre: number
}

interface Calculations {
  totalDailyLoad: number
  adjustedLoad: number
  peakLoad: number
  solarArraySize: number
  batteryStorage: number
  annualGridCost: number
  annualDieselCost: number
  annualSavings: number
  remainingEnergyCost: number
}

interface QuoteApiResponse {
  success: boolean
  data?: {
    load_analysis: {
      total_daily_energy_kwh: number
      critical_energy_kwh: number
      total_daily_energy_adjusted_kwh: number
      critical_energy_adjusted_kwh: number
    }
    system_design: {
      pv_system_size_kw: number
      number_of_620w_panels: number
      battery_capacity_kwh: number
      battery_ah_at_system_voltage: number
      recommended_inverter_kw: number
      mppt_current_a: number
    }
    solar_production: {
      estimated_daily_solar_generation_kwh: number
    }
    current_energy_cost: {
      grid_cost_monthly_tzs: number
      diesel_cost_monthly_tzs: number
      total_baseline_cost_monthly_tzs: number
    }
    after_solar_cost: {
      grid_cost_after_monthly_tzs: number
      diesel_cost_after_monthly_tzs: number
      total_cost_after_solar_monthly_tzs: number
    }
    monthly_savings: {
      gross_monthly_savings_tzs: number
    }
    financing_comparison: {
      selected_pricing: {
        system_size_kw: number
        cash_price_tzs: number
        install_upfront_tzs: number
        install_monthly_tzs: number
        install_term_months: number
        eaas_monthly_tzs: number | null
        eaas_term_months: number | null
      } | null
      cash_payback_months: number | null
      installment_net_savings_monthly: number | null
      installment_breakeven_months: number | null
      eaas_net_savings_monthly: number | null
    }
  }
}

export interface RecommendedPackageInput {
  id: string | number
  name: string
  ratedKw?: number
  size?: string
}

export interface SizingSummary {
  totalDailyLoad: number
  solarArraySize: number
  annualGridCost: number
  annualDieselCost: number
  annualSavings: number
  remainingEnergyCost: number
  requiredKw: number
  maxPackageKw: number
  recommendedPackageName: string | null
  recommendedPackageKw: number | null
}

export interface MeuDeviceSummary {
  id: string
  name: string
  dailyKwh: number
  shareOfTotal: number
  hoursPerDay?: number
  category?: DeviceCategoryId
  criticality?: CriticalityId
}

export interface MeuSummary {
  totalDailyLoad: number
  topDevices: MeuDeviceSummary[]
  potentialInefficiencies: MeuDeviceSummary[]
  categoryBreakdown: { category: string; kwh: number; percent: number }[]
  criticalityBreakdown: { critical: number; essential: number; nonEssential: number }
  peakLoadKw: number
}

const SIZING_STORAGE_KEY = "afya-solar-sizing-state-v1"

export type FacilityContextSnapshot = {
  averageOutageHours: number
  facilityType: "on-grid" | "off-grid" | "hybrid"
  monthlyGridBill: number
  dieselLitresPerDay: number
  dieselPricePerLitre: number
}

interface AfyaSolarSizingToolProps {
  packages?: RecommendedPackageInput[]
  onSizingSummaryChange?: (summary: SizingSummary) => void
  onMeuSummaryChange?: (summary: MeuSummary) => void
  onFacilityContextChange?: (ctx: FacilityContextSnapshot) => void
  facilityId?: string
  facilityName?: string
}

export function AfyaSolarSizingTool({
  packages,
  onSizingSummaryChange,
  onMeuSummaryChange,
  onFacilityContextChange,
  facilityId,
  facilityName,
}: AfyaSolarSizingToolProps) {
  const [activeTab, setActiveTab] = useState<"inventory" | "energy" | "cost">("inventory")
  const emptyDevice = (id: string): Device => ({
    id,
    deviceName: "",
    wattage: 0,
    quantity: 0,
    hoursPerDay: 0,
    category: "other",
    criticality: "non-essential",
    backupRequired: false,
    room: "",
  })

  const [devices, setDevices] = useState<Device[]>([emptyDevice("1"), emptyDevice("2")])
  const [deviceView, setDeviceView] = useState<"table" | "cards">("table")

  const [facilityData, setFacilityData] = useState<FacilityData>({
    averageOutageHours: 0,
    facilityType: "on-grid",
    monthlyGridBill: 0,
    dieselLitresPerDay: 0,
    dieselPricePerLitre: 0,
  })

  const [solarOffset, setSolarOffset] = useState(0.7)
  const [systemCost, setSystemCost] = useState(15000000)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteData, setQuoteData] = useState<QuoteApiResponse["data"] | null>(null)

  // Hydrate state from sessionStorage (per-tab, temporary) on first mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.sessionStorage.getItem(SIZING_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        devices?: Device[]
        facilityData?: FacilityData
        solarOffset?: number
        systemCost?: number
        activeTab?: typeof activeTab
      }
      if (parsed.devices && Array.isArray(parsed.devices) && parsed.devices.length > 0) {
        setDevices(
          parsed.devices.map((d: Device) => ({
            ...emptyDevice(d.id || String(Math.random())),
            ...d,
            category: d.category ?? "other",
            criticality: d.criticality ?? "non-essential",
            backupRequired: Boolean(d.backupRequired),
            room: d.room ?? "",
          }))
        )
      }
      if (parsed.facilityData) {
        setFacilityData((prev) => ({ ...prev, ...parsed.facilityData }))
      }
      if (typeof parsed.solarOffset === "number") {
        setSolarOffset(parsed.solarOffset)
      }
      if (typeof parsed.systemCost === "number") {
        setSystemCost(parsed.systemCost)
      }
      if (parsed.activeTab) {
        setActiveTab(parsed.activeTab)
      }
    } catch {
      // Ignore storage errors / invalid JSON
    }
  }, [])

  const calculateEnergy = (): Calculations => {
    const totalDailyLoad = devices.reduce((sum, device) => {
      return sum + (device.wattage * device.quantity * device.hoursPerDay) / 1000
    }, 0)

    const adjustedLoad = totalDailyLoad * 1.2
    const peakLoad = adjustedLoad / (24 * 0.4)
    const solarArraySize = (adjustedLoad / 6) * 1.15
    const batteryStorage = adjustedLoad / 0.9

    const annualGridCost = facilityData.monthlyGridBill * 12
    const annualDieselCost = facilityData.dieselLitresPerDay * facilityData.dieselPricePerLitre * 365
    const totalCurrentCost = facilityData.facilityType === "off-grid" ? annualDieselCost : annualGridCost

    const annualSavings = totalCurrentCost * solarOffset
    const remainingEnergyCost = totalCurrentCost - annualSavings

    return {
      totalDailyLoad,
      adjustedLoad,
      peakLoad,
      solarArraySize,
      batteryStorage,
      annualGridCost,
      annualDieselCost,
      annualSavings,
      remainingEnergyCost,
    }
  }

  const calculations = calculateEnergy()
  const sizingSuggestion = useMemo(() => {
    if (!packages || packages.length === 0) {
      return { recommended: null as null | { pkg: RecommendedPackageInput; kw: number }, requiredKw: 0, maxKw: 0 }
    }
    if (calculations.totalDailyLoad <= 0 || calculations.solarArraySize <= 0) {
      return { recommended: null, requiredKw: calculations.solarArraySize, maxKw: 0 }
    }

    const parseKwFromSize = (size?: string): number | null => {
      if (!size) return null
      const match = size.match(/([\d.]+)/)
      if (!match) return null
      const value = Number(match[1])
      return Number.isFinite(value) ? value : null
    }

    const withKw = packages
      .map((pkg) => {
        const rawKw = (pkg as any).ratedKw ?? parseKwFromSize(pkg.size)
        const kwNum =
          typeof rawKw === "string"
            ? Number(rawKw)
            : typeof rawKw === "number"
              ? rawKw
              : null
        return kwNum && Number.isFinite(kwNum) && kwNum > 0 ? { pkg, kw: kwNum } : null
      })
      .filter((x): x is { pkg: RecommendedPackageInput; kw: number } => x !== null)

    if (withKw.length === 0) {
      return { recommended: null, requiredKw: calculations.solarArraySize, maxKw: 0 }
    }

    const requiredKw = calculations.solarArraySize
    const sorted = withKw.sort((a, b) => a.kw - b.kw)
    const firstEnough = sorted.find((entry) => entry.kw >= requiredKw) || null
    const maxKw = sorted[sorted.length - 1]?.kw ?? 0

    // If none of the existing packages can meet the required kW, do not
    // pretend the largest package is enough – be honest and return no match.
    if (!firstEnough && requiredKw > maxKw) {
      return { recommended: null, requiredKw, maxKw }
    }

    return { recommended: firstEnough, requiredKw, maxKw }
  }, [packages, calculations.totalDailyLoad, calculations.solarArraySize])

  // Compute MEU (Major Energy Uses) summary for reporting and UI
  const meuSummary: MeuSummary = useMemo(() => {
    const enriched = devices.map((d) => {
      const dailyKwh = (d.wattage * d.quantity * d.hoursPerDay) / 1000
      return {
        ...d,
        dailyKwh,
      }
    })
    const total = enriched.reduce((sum, d) => sum + d.dailyKwh, 0)

    const peakLoadKw = enriched.reduce((sum, d) => sum + (d.wattage * d.quantity) / 1000, 0)

    const catMap = new Map<string, number>()
    let criticalK = 0
    let essentialK = 0
    let nonK = 0
    for (const d of enriched) {
      if (d.dailyKwh <= 0) continue
      const label = DEVICE_CATEGORY_LABELS[d.category] || "Other"
      catMap.set(label, (catMap.get(label) || 0) + d.dailyKwh)
      if (d.criticality === "critical") criticalK += d.dailyKwh
      else if (d.criticality === "essential") essentialK += d.dailyKwh
      else nonK += d.dailyKwh
    }

    const categoryBreakdown =
      total > 0
        ? [...catMap.entries()]
            .map(([category, kwh]) => ({
              category,
              kwh,
              percent: (kwh / total) * 100,
            }))
            .sort((a, b) => b.kwh - a.kwh)
        : []

    if (!total) {
      return {
        totalDailyLoad: 0,
        topDevices: [],
        potentialInefficiencies: [],
        categoryBreakdown: [],
        criticalityBreakdown: { critical: 0, essential: 0, nonEssential: 0 },
        peakLoadKw,
      }
    }

    const sorted = [...enriched].sort((a, b) => b.dailyKwh - a.dailyKwh)
    const top = sorted.slice(0, 5).filter((d) => d.dailyKwh > 0)

    const potentialInefficienciesRaw = sorted.filter((d) => {
      const longHours = d.hoursPerDay >= 16
      const highPowerLong = d.hoursPerDay >= 10 && d.wattage * d.quantity >= 1000
      return d.dailyKwh > 0 && (longHours || highPowerLong)
    })

    const toDeviceSummary = (d: (typeof enriched)[number]): MeuDeviceSummary => ({
      id: d.id,
      name: d.deviceName || "Unnamed device",
      dailyKwh: d.dailyKwh,
      shareOfTotal: (d.dailyKwh / total) * 100,
      hoursPerDay: d.hoursPerDay,
      category: d.category,
      criticality: d.criticality,
    })

    return {
      totalDailyLoad: total,
      topDevices: top.map(toDeviceSummary),
      potentialInefficiencies: potentialInefficienciesRaw.map(toDeviceSummary),
      categoryBreakdown,
      criticalityBreakdown: {
        critical: criticalK,
        essential: essentialK,
        nonEssential: nonK,
      },
      peakLoadKw,
    }
  }, [devices])

  // Push sizing summary up to parent when calculations or suggestion change
  const lastSizingRef = useRef<SizingSummary | null>(null)
  useEffect(() => {
    if (!onSizingSummaryChange) return

    const recommended = sizingSuggestion.recommended

    const nextSummary: SizingSummary = {
      totalDailyLoad: calculations.totalDailyLoad,
      solarArraySize: calculations.solarArraySize,
      annualGridCost: calculations.annualGridCost,
      annualDieselCost: calculations.annualDieselCost,
      annualSavings: calculations.annualSavings,
      remainingEnergyCost: calculations.remainingEnergyCost,
      requiredKw: sizingSuggestion.requiredKw,
      maxPackageKw: sizingSuggestion.maxKw,
      recommendedPackageName: recommended?.pkg.name ?? null,
      recommendedPackageKw: recommended?.kw ?? null,
    }

    const prev = lastSizingRef.current
    if (
      prev &&
      prev.totalDailyLoad === nextSummary.totalDailyLoad &&
      prev.solarArraySize === nextSummary.solarArraySize &&
      prev.annualGridCost === nextSummary.annualGridCost &&
      prev.annualDieselCost === nextSummary.annualDieselCost &&
      prev.annualSavings === nextSummary.annualSavings &&
      prev.remainingEnergyCost === nextSummary.remainingEnergyCost &&
      prev.requiredKw === nextSummary.requiredKw &&
      prev.maxPackageKw === nextSummary.maxPackageKw &&
      prev.recommendedPackageName === nextSummary.recommendedPackageName &&
      prev.recommendedPackageKw === nextSummary.recommendedPackageKw
    ) {
      return
    }

    lastSizingRef.current = nextSummary
    onSizingSummaryChange(nextSummary)
  }, [calculations, sizingSuggestion, onSizingSummaryChange])

  // Push MEU summary up to parent
  const lastMeuRef = useRef<MeuSummary | null>(null)
  useEffect(() => {
    if (!onMeuSummaryChange) return

    const prev = lastMeuRef.current
    if (
      prev &&
      prev.totalDailyLoad === meuSummary.totalDailyLoad &&
      prev.topDevices.length === meuSummary.topDevices.length &&
      prev.potentialInefficiencies.length === meuSummary.potentialInefficiencies.length &&
      prev.categoryBreakdown.length === meuSummary.categoryBreakdown.length &&
      prev.peakLoadKw === meuSummary.peakLoadKw
    ) {
      return
    }

    lastMeuRef.current = meuSummary
    onMeuSummaryChange(meuSummary)
  }, [meuSummary, onMeuSummaryChange])

  // Persist current sizing state to sessionStorage so it survives reloads in this tab
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const payload = JSON.stringify({
        devices,
        facilityData,
        solarOffset,
        systemCost,
        activeTab,
      })
      window.sessionStorage.setItem(SIZING_STORAGE_KEY, payload)
    } catch {
      // Best-effort only; ignore storage failures
    }
  }, [devices, facilityData, solarOffset, systemCost, activeTab])

  useEffect(() => {
    onFacilityContextChange?.({
      averageOutageHours: facilityData.averageOutageHours,
      facilityType: facilityData.facilityType,
      monthlyGridBill: facilityData.monthlyGridBill,
      dieselLitresPerDay: facilityData.dieselLitresPerDay,
      dieselPricePerLitre: facilityData.dieselPricePerLitre,
    })
  }, [facilityData, onFacilityContextChange])

  const addDevice = () => {
    setDevices([...devices, emptyDevice(Date.now().toString())])
  }

  const addFromTemplate = (templateId: string) => {
    const t = getTemplateById(templateId)
    if (!t) return
    setDevices([
      ...devices,
      {
        id: `${Date.now()}-${templateId}`,
        deviceName: t.name,
        wattage: t.defaultWattage,
        quantity: t.defaultQuantity,
        hoursPerDay: t.defaultHoursPerDay,
        category: t.category,
        criticality: t.suggestedCriticality,
        backupRequired: t.backupRecommended,
        room: "",
      },
    ])
  }

  const addBundle = (bundleId: string) => {
    const b = DEVICE_BUNDLES.find((x) => x.id === bundleId)
    if (!b) return
    const newRows: Device[] = b.templateIds
      .map((tid) => getTemplateById(tid))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t, i) => ({
        id: `${Date.now()}-b-${bundleId}-${i}`,
        deviceName: t.name,
        wattage: t.defaultWattage,
        quantity: t.defaultQuantity,
        hoursPerDay: t.defaultHoursPerDay,
        category: t.category,
        criticality: t.suggestedCriticality,
        backupRequired: t.backupRecommended,
        room: "",
      }))
    setDevices([...devices, ...newRows])
  }

  const updateDevice = (id: string, field: keyof Device, value: string | number | boolean) => {
    setDevices(
      devices.map((device) => (device.id === id ? { ...device, [field]: value } : device))
    )
  }

  const removeDevice = (id: string) => {
    setDevices(devices.filter(device => device.id !== id))
  }

  const updateFacilityData = (field: keyof FacilityData, value: string | number) => {
    setFacilityData({ ...facilityData, [field]: value })
  }

  const runDesignQuote = async () => {
    if (typeof window === "undefined") return
    if (!devices.some(d => d.wattage > 0 && d.quantity > 0 && d.hoursPerDay > 0)) {
      setQuoteError("Please enter at least one device with wattage, quantity and hours per day.")
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const payload = {
        DEVICE_LOAD_TABLE: devices.map((d) => ({
          device_name: d.deviceName || "Device",
          wattage_w: d.wattage,
          quantity: d.quantity,
          hours_per_day: d.hoursPerDay,
          is_critical: d.criticality === "critical" || d.criticality === "essential",
        })),
        FACILITY_DATA: {
          facility_type:
            facilityData.facilityType === "on-grid"
              ? "on_grid"
              : facilityData.facilityType === "off-grid"
              ? "off_grid"
              : "hybrid",
          avg_outage_hours_per_day: facilityData.averageOutageHours,
          tanesco_monthly_bill_tzs: facilityData.monthlyGridBill || 0,
          diesel_litres_per_day: facilityData.dieselLitresPerDay || 0,
          diesel_price_tzs_per_litre: facilityData.dieselPricePerLitre || undefined,
        },
        SOLAR_SITE_DATA: {
          peak_sun_hours_worst_month: 4.5,
          system_dc_voltage: 48,
          battery_chemistry: "lifepo4" as const,
        },
        SYSTEM_PARAMETERS: {
          panel_watt_rating: 620,
          growth_margin: 0.15,
        },
        facilityId: facilityId || undefined,
        facilityName: facilityName || undefined,
        CLIENT_CONTEXT: {
          solarOffset,
          meuSummary,
        },
      }

      const res = await fetch("/api/afya-solar/design/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json: QuoteApiResponse = await res.json()
      if (!res.ok || !json.success || !json.data) {
        setQuoteError((json as any).error || "Failed to compute design quote")
        setQuoteData(null)
        return
      }
      setQuoteData(json.data)
      // After a successful run, automatically switch to the Cost tab
      setActiveTab("cost")
    } catch (err: any) {
      setQuoteError(err?.message || "Unexpected error while computing design quote")
      setQuoteData(null)
    } finally {
      setQuoteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Major Energy Uses</span>
            <span className="sm:hidden">MEUs</span>
          </TabsTrigger>
          <TabsTrigger value="energy" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Energy Calculation</span>
            <span className="sm:hidden">Energy</span>
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Cost Comparison</span>
            <span className="sm:hidden">Costs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Devices &amp; loads</CardTitle>
                  <CardDescription>
                    Add equipment from templates or bundles, tag criticality for backup sizing, and switch table or card
                    view.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-md border border-emerald-200 bg-white p-0.5">
                    <Button
                      type="button"
                      variant={deviceView === "table" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setDeviceView("table")}
                    >
                      <Table2 className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Table</span>
                    </Button>
                    <Button
                      type="button"
                      variant={deviceView === "cards" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setDeviceView("cards")}
                    >
                      <LayoutGrid className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Cards</span>
                    </Button>
                  </div>
                  <Button size="sm" onClick={addDevice}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add row
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-emerald-100/80 mt-2">
                <p className="text-xs font-medium text-emerald-900">Quick add bundles</p>
                <div className="flex flex-wrap gap-2">
                  {DEVICE_BUNDLES.map((b) => (
                    <Button key={b.id} type="button" variant="outline" size="sm" className="text-xs h-8 border-emerald-200" onClick={() => addBundle(b.id)}>
                      {b.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-emerald-800">Single template:</span>
                  <Select onValueChange={(v) => addFromTemplate(v)}>
                    <SelectTrigger className="h-8 w-[min(100%,220px)] text-xs">
                      <SelectValue placeholder="Pick device template…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {DEVICE_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name} (~{t.defaultWattage} W)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {deviceView === "table" ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Device</TableHead>
                      <TableHead className="min-w-[100px]">Category</TableHead>
                      <TableHead className="min-w-[120px]">Criticality</TableHead>
                      <TableHead className="w-20">W (W)</TableHead>
                      <TableHead className="w-16">Qty</TableHead>
                      <TableHead className="w-20">h/day</TableHead>
                      <TableHead className="min-w-[90px]">kWh/d</TableHead>
                      <TableHead className="min-w-[80px]">Backup</TableHead>
                      <TableHead className="min-w-[100px]">Zone</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => {
                      const dailyKwh = (device.wattage * device.quantity * device.hoursPerDay) / 1000
                      const abnormalW = device.wattage > 20000 || (device.wattage > 0 && device.wattage < 3)
                      const abnormalH = device.hoursPerDay > 24
                      return (
                        <TableRow key={device.id} className={abnormalW || abnormalH ? "bg-amber-50/50" : undefined}>
                          <TableCell>
                            <Input
                              value={device.deviceName}
                              onChange={(e) => updateDevice(device.id, "deviceName", e.target.value)}
                              placeholder="Name"
                              className="min-w-[120px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={device.category}
                              onValueChange={(v) => updateDevice(device.id, "category", v as DeviceCategoryId)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(DEVICE_CATEGORY_LABELS) as DeviceCategoryId[]).map((c) => (
                                  <SelectItem key={c} value={c} className="text-xs">
                                    {DEVICE_CATEGORY_LABELS[c]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={device.criticality}
                              onValueChange={(v) => updateDevice(device.id, "criticality", v as CriticalityId)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(CRITICALITY_LABELS) as CriticalityId[]).map((c) => (
                                  <SelectItem key={c} value={c} className="text-xs">
                                    {CRITICALITY_LABELS[c]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={device.wattage === 0 ? "" : device.wattage}
                              onChange={(e) => updateDevice(device.id, "wattage", Number(e.target.value))}
                              placeholder="W"
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={device.quantity === 0 ? "" : device.quantity}
                              onChange={(e) => updateDevice(device.id, "quantity", Number(e.target.value))}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={device.hoursPerDay === 0 ? "" : device.hoursPerDay}
                              onChange={(e) => updateDevice(device.id, "hoursPerDay", Number(e.target.value))}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {dailyKwh.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={device.backupRequired}
                              onCheckedChange={(c) => updateDevice(device.id, "backupRequired", c === true)}
                              aria-label="Backup required"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={device.room}
                              onChange={(e) => updateDevice(device.id, "room", e.target.value)}
                              placeholder="Room"
                              className="h-9 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeDevice(device.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {devices.map((device) => {
                    const dailyKwh = (device.wattage * device.quantity * device.hoursPerDay) / 1000
                    return (
                      <Card key={device.id} className="border-emerald-100 bg-white shadow-sm">
                        <CardHeader className="py-3 px-4 space-y-0">
                          <div className="flex justify-between gap-2">
                            <Input
                              value={device.deviceName}
                              onChange={(e) => updateDevice(device.id, "deviceName", e.target.value)}
                              placeholder="Device name"
                              className="font-semibold text-sm"
                            />
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => removeDevice(device.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground pt-1">
                            {DEVICE_CATEGORY_LABELS[device.category]} · {CRITICALITY_LABELS[device.criticality]}
                          </p>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">W</Label>
                              <Input
                                type="number"
                                className="h-8 mt-0.5"
                                value={device.wattage === 0 ? "" : device.wattage}
                                onChange={(e) => updateDevice(device.id, "wattage", Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Qty</Label>
                              <Input
                                type="number"
                                className="h-8 mt-0.5"
                                value={device.quantity === 0 ? "" : device.quantity}
                                onChange={(e) => updateDevice(device.id, "quantity", Number(e.target.value))}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">h/d</Label>
                              <Input
                                type="number"
                                className="h-8 mt-0.5"
                                value={device.hoursPerDay === 0 ? "" : device.hoursPerDay}
                                onChange={(e) => updateDevice(device.id, "hoursPerDay", Number(e.target.value))}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-md bg-emerald-50/80 px-2 py-1.5">
                            <span className="text-emerald-900">Daily kWh</span>
                            <span className="font-mono font-semibold text-emerald-800">{dailyKwh.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <Checkbox
                              id={`bk-${device.id}`}
                              checked={device.backupRequired}
                              onCheckedChange={(c) => updateDevice(device.id, "backupRequired", c === true)}
                            />
                            <Label htmlFor={`bk-${device.id}`} className="text-xs font-normal">
                              Backup
                            </Label>
                          </div>
                          <Input
                            placeholder="Room / zone"
                            value={device.room}
                            onChange={(e) => updateDevice(device.id, "room", e.target.value)}
                            className="h-8 text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={device.category} onValueChange={(v) => updateDevice(device.id, "category", v as DeviceCategoryId)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(DEVICE_CATEGORY_LABELS) as DeviceCategoryId[]).map((c) => (
                                  <SelectItem key={c} value={c} className="text-xs">
                                    {DEVICE_CATEGORY_LABELS[c]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={device.criticality} onValueChange={(v) => updateDevice(device.id, "criticality", v as CriticalityId)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Criticality" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.keys(CRITICALITY_LABELS) as CriticalityId[]).map((c) => (
                                  <SelectItem key={c} value={c} className="text-xs">
                                    {CRITICALITY_LABELS[c]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 text-[11px] sm:text-xs text-emerald-800">
                {meuSummary.totalDailyLoad <= 0 ? (
                  <p className="font-medium text-emerald-800">
                    Enter wattage, quantity and hours to see insights about your major energy uses.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <h4 className="text-xs sm:text-sm font-semibold text-emerald-900">
                        Major energy use insights
                      </h4>
                      <p className="text-[11px] sm:text-xs text-emerald-900">
                        Total estimated daily load:{" "}
                        <span className="font-semibold">
                          {meuSummary.totalDailyLoad.toFixed(1)} kWh/day
                        </span>
                        {" · "}
                        Naïve peak (all on):{" "}
                        <span className="font-semibold">{meuSummary.peakLoadKw.toFixed(2)} kW</span>
                        {" · "}
                        Critical+essential:{" "}
                        <span className="font-semibold">
                          {(
                            meuSummary.criticalityBreakdown.critical + meuSummary.criticalityBreakdown.essential
                          ).toFixed(1)}{" "}
                          kWh/day
                        </span>
                      </p>
                    </div>

                    {meuSummary.topDevices.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-900 mb-1">
                          Top energy uses
                        </p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {meuSummary.topDevices.map((d) => (
                            <li key={d.id} className="text-[11px] sm:text-xs">
                              <span className="font-medium">
                                {d.name}
                              </span>{" "}
                              – {d.dailyKwh.toFixed(1)} kWh/day (
                              {d.shareOfTotal.toFixed(0)}% of total)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {meuSummary.potentialInefficiencies.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-900 mb-1">
                          Possible long-running / high-load devices
                        </p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {meuSummary.potentialInefficiencies.slice(0, 5).map((d) => (
                            <li key={d.id} className="text-[11px] sm:text-xs">
                              <span className="font-medium">
                                {d.name}
                              </span>{" "}
                              – {d.dailyKwh.toFixed(1)} kWh/day
                              {d.hoursPerDay != null ? ` @ ${d.hoursPerDay}h` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Average Outage Hours per Day</Label>
                  <Input
                    type="number"
                    value={facilityData.averageOutageHours === 0 ? "" : facilityData.averageOutageHours}
                    onChange={(e) => updateFacilityData("averageOutageHours", Number(e.target.value))}
                    placeholder="e.g. 4"
                  />
                </div>
                <div>
                  <Label>Facility Type</Label>
                  <Select
                    value={facilityData.facilityType}
                    onValueChange={(value: "on-grid" | "off-grid" | "hybrid") =>
                      updateFacilityData("facilityType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on-grid">On-grid</SelectItem>
                      <SelectItem value="off-grid">Off-grid</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Monthly Grid Bill (TZS)</Label>
                  <Input
                    type="number"
                    value={facilityData.monthlyGridBill === 0 ? "" : facilityData.monthlyGridBill}
                    onChange={(e) => updateFacilityData("monthlyGridBill", Number(e.target.value))}
                    disabled={facilityData.facilityType === "off-grid"}
                    placeholder="e.g. 300000"
                  />
                </div>
                <div>
                  <Label>Diesel Litres per Day</Label>
                  <Input
                    type="number"
                    value={facilityData.dieselLitresPerDay === 0 ? "" : facilityData.dieselLitresPerDay}
                    onChange={(e) => updateFacilityData("dieselLitresPerDay", Number(e.target.value))}
                    disabled={facilityData.facilityType === "on-grid"}
                    placeholder="e.g. 10"
                  />
                </div>
                <div>
                  <Label>Diesel Price per Litre (TZS)</Label>
                  <Input
                    type="number"
                    value={facilityData.dieselPricePerLitre === 0 ? "" : facilityData.dieselPricePerLitre}
                    onChange={(e) => updateFacilityData("dieselPricePerLitre", Number(e.target.value))}
                    disabled={facilityData.facilityType === "on-grid"}
                    placeholder="e.g. 2500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 border-t pt-3">
            <div className="text-xs sm:text-sm text-emerald-800 bg-emerald-50/80 border border-emerald-100 rounded-md px-3 py-2 w-full sm:w-auto">
              Run the Afya Solar design engine to generate a full engineering design and finance comparison, then view
              the detailed results in the Cost tab.
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {quoteError && (
                <span className="text-[11px] text-red-600 max-w-xs truncate">
                  {quoteError}
                </span>
              )}
              <Button
                size="sm"
                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-semibold shadow-sm hover:shadow-md px-4 py-2 text-xs sm:text-sm"
                onClick={runDesignQuote}
                disabled={quoteLoading}
              >
                {quoteLoading ? "Running design..." : "Run Design & Finance Engine"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="energy" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Energy Calculation</CardTitle>
                <CardDescription>Automatic calculation based on your device inventory.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex justify-between">
                    <span>Total Daily Load:</span>
                    <span className="font-bold">{calculations.totalDailyLoad.toFixed(2)} kWh/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span>System Loss Buffer (20%):</span>
                    <span className="font-bold">
                      {(calculations.adjustedLoad - calculations.totalDailyLoad).toFixed(2)} kWh/day
                    </span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span>Adjusted Load:</span>
                    <span className="font-bold">{calculations.adjustedLoad.toFixed(2)} kWh/day</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Sizing</CardTitle>
                <CardDescription>Recommended solar system specifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex justify-between">
                    <span>Peak Load Estimation:</span>
                    <span className="font-bold">{calculations.peakLoad.toFixed(2)} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Solar Array Size:</span>
                    <span className="font-bold">{calculations.solarArraySize.toFixed(2)} kW</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Battery Storage:</span>
                    <span className="font-bold">{calculations.batteryStorage.toFixed(2)} kWh</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
              <CardDescription>Detailed energy consumption by device.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Watts</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Hours/Day</TableHead>
                      <TableHead>Daily kWh</TableHead>
                      <TableHead>% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => {
                      const dailyKwh = (device.wattage * device.quantity * device.hoursPerDay) / 1000
                      const percentage = calculations.totalDailyLoad > 0
                        ? (dailyKwh / calculations.totalDailyLoad) * 100
                        : 0
                      return (
                        <TableRow key={device.id}>
                          <TableCell>{device.deviceName}</TableCell>
                          <TableCell>{device.wattage}</TableCell>
                          <TableCell>{device.quantity}</TableCell>
                          <TableCell>{device.hoursPerDay}</TableCell>
                          <TableCell className="font-mono">{dailyKwh.toFixed(2)}</TableCell>
                          <TableCell>{percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="font-bold">
                      <TableCell colSpan={4}>Total daily load</TableCell>
                      <TableCell className="font-mono">{calculations.totalDailyLoad.toFixed(2)}</TableCell>
                      <TableCell>100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Suggested package or honest custom sizing message */}
          {sizingSuggestion.recommended && (
            <Card>
              <CardHeader>
                <CardTitle>Suggested Afya Solar Package</CardTitle>
                <CardDescription>
                  Based on your total daily load and system sizing, this package is the closest match.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Recommended package</p>
                    <p className="text-lg font-semibold">
                      {sizingSuggestion.recommended.pkg.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Approx. required array size:{" "}
                      <span className="font-semibold">
                        {calculations.solarArraySize.toFixed(1)} kW
                      </span>
                      {" • "}
                      Package size:{" "}
                      <span className="font-semibold">
                        {sizingSuggestion.recommended.pkg.size ?? `${sizingSuggestion.recommended.kw} kW`}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      This is a guidance suggestion only. You can still review all packages
                      below and choose the option that best fits your budget and priorities.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!sizingSuggestion.recommended &&
            sizingSuggestion.requiredKw > 0 &&
            sizingSuggestion.maxKw > 0 &&
            sizingSuggestion.requiredKw > sizingSuggestion.maxKw && (
              <Card>
                <CardHeader>
                  <CardTitle>System Size Needed vs Available Packages</CardTitle>
                  <CardDescription>
                    Your estimated energy needs are higher than our largest standard Afya Solar package.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Approx. required array size based on your inputs:{" "}
                      <span className="font-semibold">
                        {sizingSuggestion.requiredKw.toFixed(1)} kW
                      </span>
                      .
                    </p>
                    <p>
                      Largest standard package in the catalogue:{" "}
                      <span className="font-semibold">
                        {Number(sizingSuggestion.maxKw).toFixed(1)} kW
                      </span>
                      .
                    </p>
                    <p className="mt-1">
                      None of the current packages are large enough for this load. You likely need a{" "}
                      <span className="font-semibold">
                        custom Afya Solar system of around {sizingSuggestion.requiredKw.toFixed(1)} kW
                      </span>
                      . Please discuss this sizing result with the Afya Solar team before subscribing.
                    </p>
                  </div>
                </CardContent>
              </Card>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              className="mt-2"
              onClick={() => setActiveTab("cost")}
            >
              Go to Cost Comparison
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="cost" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Annual Energy Cost</CardTitle>
                <CardDescription>Based on your current energy sources.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {facilityData.facilityType === "on-grid" ? (
                  <div className="grid gap-4">
                    <div className="flex justify-between">
                      <span>Monthly Grid Bill:</span>
                      <span className="font-bold">{formatCurrency(facilityData.monthlyGridBill)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>Annual Grid Cost:</span>
                      <span className="font-bold">{formatCurrency(calculations.annualGridCost)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <div className="flex justify-between">
                      <span>Daily Diesel Consumption:</span>
                      <span className="font-bold">{facilityData.dieselLitresPerDay} litres</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diesel Cost per Litre:</span>
                      <span className="font-bold">{formatCurrency(facilityData.dieselPricePerLitre)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>Annual Diesel Cost:</span>
                      <span className="font-bold">{formatCurrency(calculations.annualDieselCost)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Solar Offset Analysis</CardTitle>
                <CardDescription>Projected savings with solar installation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Expected Solar Offset: {(solarOffset * 100).toFixed(0)}%</Label>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={solarOffset}
                    onChange={(e) => setSolarOffset(Number(e.target.value))}
                    className="mt-2"
                  />
                </div>
                <div className="grid gap-4">
                  <div className="flex justify-between">
                    <span>Annual Savings:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(calculations.annualSavings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Energy Cost:</span>
                    <span className="font-bold">
                      {formatCurrency(calculations.remainingEnergyCost)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost Comparison Summary</CardTitle>
              <CardDescription>Before and after solar installation.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(
                      facilityData.facilityType === "on-grid"
                        ? calculations.annualGridCost
                        : calculations.annualDieselCost
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Annual Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(calculations.annualSavings)}
                  </div>
                  <div className="text-sm text-muted-foreground">Annual Savings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(calculations.remainingEnergyCost)}
                  </div>
                  <div className="text-sm text-muted-foreground">New Annual Cost</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {quoteData && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Afya Solar Design & Financing Summary
                    </CardTitle>
                    <CardDescription>
                      Engineering-sized system, baseline vs after-solar costs, and cash / installment / EaaS comparison.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { jsPDF } = await import("jspdf")
                        const doc = new jsPDF("p", "mm", "a4")
                        const marginX = 15
                        let cursorY = 20
                        const lineHeight = 6
                        const pageWidth = doc.internal.pageSize.getWidth()
                        const contentWidth = pageWidth - marginX * 2

                        const sanitize = (text: string) =>
                          text
                            .replace(/[\u2010-\u2015]/g, "-")
                            .replace(/[\u2018\u2019]/g, "'")
                            .replace(/[\u201C\u201D]/g, '"')
                            .replace(/[^\x00-\x7F]/g, " ")

                        const addSection = (title: string, body: string[]) => {
                          if (cursorY > 270) {
                            doc.addPage()
                            cursorY = 20
                          }
                          doc.setFontSize(12)
                          doc.setFont("times", "bold")
                          doc.setTextColor(15, 118, 110)
                          doc.text(sanitize(title), marginX, cursorY)
                          cursorY += lineHeight

                          doc.setFontSize(10)
                          doc.setFont("times", "normal")
                          doc.setTextColor(0, 0, 0)
                          body.forEach((paragraph) => {
                            const lines = doc.splitTextToSize(sanitize(paragraph), contentWidth)
                            lines.forEach((line: string) => {
                              if (cursorY > 280) {
                                doc.addPage()
                                cursorY = 20
                              }
                              doc.text(line, marginX, cursorY)
                              cursorY += lineHeight
                            })
                            cursorY += 2
                          })
                          cursorY += 2
                        }

                        const today = new Date().toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        } as any)

                        doc.setFont("times", "bold")
                        doc.setFontSize(18)
                        doc.text("Ubuntu Afya Link", pageWidth / 2, cursorY, { align: "center" })
                        cursorY += lineHeight

                        doc.setFontSize(14)
                        doc.text("Afya Solar Design & Finance Report", pageWidth / 2, cursorY, { align: "center" })
                        cursorY += lineHeight + 1

                        doc.setFont("times", "normal")
                        doc.setFontSize(9)
                        doc.text(`Generated on: ${today}`, marginX, cursorY)
                        cursorY += lineHeight
                        if (facilityName) {
                          doc.text(`Facility: ${sanitize(facilityName)}`, marginX, cursorY)
                          cursorY += lineHeight
                        }
                        doc.text(
                          "Service: Afya Solar – clean, reliable power and financing for healthcare facilities.",
                          marginX,
                          cursorY
                        )
                        cursorY += lineHeight + 2

                        doc.setDrawColor(200)
                        doc.setLineWidth(0.3)
                        doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
                        cursorY += lineHeight

                        // Major energy uses & inventory
                        if (meuSummary && meuSummary.totalDailyLoad > 0) {
                          const topDevicesText =
                            meuSummary.topDevices.length > 0
                              ? "Top energy uses: " +
                                meuSummary.topDevices
                                  .map(
                                    (d) =>
                                      `${d.name} – ${d.dailyKwh.toFixed(1)} kWh/day (${d.shareOfTotal.toFixed(
                                        0
                                      )}% of total)`
                                  )
                                  .join("; ")
                              : "No major devices identified yet."

                          const ineffText =
                            meuSummary.potentialInefficiencies.length > 0
                              ? "Possible long-running or high-load devices: " +
                                meuSummary.potentialInefficiencies
                                  .slice(0, 3)
                                  .map(
                                    (d) =>
                                      `${d.name} – ${d.dailyKwh.toFixed(1)} kWh/day (${d.shareOfTotal.toFixed(
                                        0
                                      )}% of total)`
                                  )
                                  .join("; ")
                              : "No obvious long‑running or high‑load devices were flagged based on your inputs."

                          addSection("1. MAJOR ENERGY USES (MEUs)", [
                            `Estimated total daily load from listed devices: ${meuSummary.totalDailyLoad.toFixed(
                              1
                            )} kWh/day.`,
                            topDevicesText,
                            ineffText,
                          ])
                        }

                        // Device inventory breakdown
                        if (devices.length > 0) {
                          const deviceLines =
                            devices.length > 0
                              ? devices
                                  .filter((d) => d.wattage > 0 && d.quantity > 0 && d.hoursPerDay > 0)
                                  .map((d) => {
                                    const dailyKwh = (d.wattage * d.quantity * d.hoursPerDay) / 1000
                                    return `${d.deviceName || "Device"} – ${d.wattage} W × ${
                                      d.quantity
                                    } @ ${d.hoursPerDay} h/day ≈ ${dailyKwh.toFixed(2)} kWh/day`
                                  })
                              : []

                          if (deviceLines.length > 0) {
                            addSection("2. DEVICE INVENTORY DETAILS", deviceLines)
                          }
                        }

                        // Facility context
                        const facilityLines: string[] = []
                        if (facilityData.facilityType === "on-grid") {
                          facilityLines.push(
                            `Facility type: On‑grid. Reported monthly grid bill: ${formatCurrency(
                              facilityData.monthlyGridBill
                            )}.`
                          )
                        } else if (facilityData.facilityType === "off-grid") {
                          facilityLines.push(
                            `Facility type: Off‑grid. Reported diesel use: ${
                              facilityData.dieselLitresPerDay || 0
                            } litres/day @ approx. ${formatCurrency(
                              facilityData.dieselPricePerLitre
                            )} per litre.`
                          )
                        } else {
                          facilityLines.push(
                            `Facility type: Hybrid. Approximate monthly grid bill: ${formatCurrency(
                              facilityData.monthlyGridBill
                            )}, diesel use: ${facilityData.dieselLitresPerDay || 0} litres/day.`
                          )
                        }
                        if (facilityData.averageOutageHours > 0) {
                          facilityLines.push(
                            `Average reported outage: about ${facilityData.averageOutageHours.toFixed(
                              1
                            )} hours per day.`
                          )
                        }
                        facilityLines.push(
                          `For this report, the expected solar offset slider was set to approximately ${(
                            solarOffset * 100
                          ).toFixed(0)}% for the annual cost comparison.`
                        )
                        addSection("3. FACILITY ENERGY CONTEXT", facilityLines)

                        addSection("4. LOAD ANALYSIS (ENGINE BASIS)", [
                          `Total daily energy: ${quoteData.load_analysis.total_daily_energy_kwh.toFixed(
                            1
                          )} kWh/day (critical: ${quoteData.load_analysis.critical_energy_kwh.toFixed(1)} kWh/day).`,
                          `After growth margin, adjusted total daily energy is ${quoteData.load_analysis.total_daily_energy_adjusted_kwh.toFixed(
                            1
                          )} kWh/day.`,
                        ])

                        addSection("5. SYSTEM DESIGN (PV, BATTERY, INVERTER)", [
                          `PV system sized at approximately ${quoteData.system_design.pv_system_size_kw.toFixed(
                            2
                          )} kW using ${quoteData.system_design.number_of_620w_panels} × 620 W panels.`,
                          `Battery bank nameplate capacity is about ${quoteData.system_design.battery_capacity_kwh.toFixed(
                            1
                          )} kWh (~${Math.round(
                            quoteData.system_design.battery_ah_at_system_voltage
                          )} Ah at system DC voltage).`,
                          `Recommended inverter continuous rating is around ${quoteData.system_design.recommended_inverter_kw.toFixed(
                            1
                          )} kW with MPPT current requirement ≈ ${quoteData.system_design.mppt_current_a.toFixed(
                            0
                          )} A.`,
                          `Estimated daily solar generation is about ${quoteData.solar_production.estimated_daily_solar_generation_kwh.toFixed(
                            1
                          )} kWh/day in the worst month.`,
                        ])

                        addSection("6. CURRENT VS AFTER-SOLAR COSTS", [
                          `Baseline monthly cost (grid + diesel) is approximately ${formatCurrency(
                            quoteData.current_energy_cost.total_baseline_cost_monthly_tzs
                          )} per month.`,
                          `After installing Afya Solar, estimated monthly energy cost drops to about ${formatCurrency(
                            quoteData.after_solar_cost.total_cost_after_solar_monthly_tzs
                          )}.`,
                          `This implies gross monthly savings of roughly ${formatCurrency(
                            quoteData.monthly_savings.gross_monthly_savings_tzs
                          )}.`,
                        ])

                        const fin = quoteData.financing_comparison
                        if (fin?.selected_pricing) {
                          const lines: string[] = []
                          lines.push(
                            `Cash option: system price about ${formatCurrency(
                              fin.selected_pricing.cash_price_tzs
                            )} with an indicative simple payback of ${
                              fin.cash_payback_months
                                ? `${fin.cash_payback_months.toFixed(1)} months`
                                : "N/A"
                            }.`
                          )
                          lines.push(
                            `Installment option: upfront payment ~${formatCurrency(
                              fin.selected_pricing.install_upfront_tzs
                            )} plus ${fin.selected_pricing.install_term_months} installments of around ${formatCurrency(
                              fin.selected_pricing.install_monthly_tzs
                            )}/month.`
                          )
                          if (fin.installment_net_savings_monthly != null) {
                            lines.push(
                              `Net savings vs baseline under installment plan are about ${formatCurrency(
                                fin.installment_net_savings_monthly
                              )} per month.`
                            )
                          }
                          if (fin.selected_pricing.eaas_monthly_tzs != null) {
                            lines.push(
                              `Energy‑as‑a‑Service (EaaS): fixed fee of about ${formatCurrency(
                                fin.selected_pricing.eaas_monthly_tzs
                              )}/month with a typical minimum term of ${
                                fin.selected_pricing.eaas_term_months ?? 72
                              } months.`
                            )
                            if (fin.eaas_net_savings_monthly != null) {
                              lines.push(
                                `Under EaaS, estimated net savings vs baseline are about ${formatCurrency(
                                  fin.eaas_net_savings_monthly
                                )} per month.`
                              )
                            }
                          } else {
                            lines.push(
                              "No EaaS tariff is currently configured for the closest system size in the catalogue."
                            )
                          }
                          addSection("7. FINANCING MODALITIES (CASH / INSTALLMENT / EAAS)", lines)
                        }

                        doc.save("afya-solar-design-and-finance.pdf")
                      } catch (error) {
                        console.error("Error generating design & finance PDF:", error)
                      }
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">PV System Size</p>
                    <p className="text-lg font-semibold">
                      {quoteData.system_design.pv_system_size_kw.toFixed(2)} kW
                    </p>
                    <p className="text-xs text-gray-500">
                      {quoteData.system_design.number_of_620w_panels} × 620 W panels
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Battery Bank</p>
                    <p className="text-lg font-semibold">
                      {quoteData.system_design.battery_capacity_kwh.toFixed(1)} kWh
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.round(quoteData.system_design.battery_ah_at_system_voltage)} Ah @ system voltage
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Inverter & MPPT</p>
                    <p className="text-lg font-semibold">
                      {quoteData.system_design.recommended_inverter_kw.toFixed(1)} kW inverter
                    </p>
                    <p className="text-xs text-gray-500">
                      MPPT current ≈ {quoteData.system_design.mppt_current_a.toFixed(0)} A
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Baseline Monthly Cost</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(quoteData.current_energy_cost.total_baseline_cost_monthly_tzs)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">After-Solar Monthly Cost</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(quoteData.after_solar_cost.total_cost_after_solar_monthly_tzs)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Gross Monthly Savings</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(quoteData.monthly_savings.gross_monthly_savings_tzs)}
                    </p>
                  </div>
                </div>

                {quoteData.financing_comparison.selected_pricing && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cash Option</p>
                      <p className="text-sm text-gray-700">
                        System price:{" "}
                        <span className="font-semibold">
                          {formatCurrency(
                            quoteData.financing_comparison.selected_pricing.cash_price_tzs,
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Payback:{" "}
                        {quoteData.financing_comparison.cash_payback_months
                          ? `${quoteData.financing_comparison.cash_payback_months.toFixed(1)} months`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Installment Option</p>
                      <p className="text-sm text-gray-700">
                        Upfront:{" "}
                        <span className="font-semibold">
                          {formatCurrency(
                            quoteData.financing_comparison.selected_pricing.install_upfront_tzs,
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {quoteData.financing_comparison.selected_pricing.install_term_months} ×{" "}
                        {formatCurrency(
                          quoteData.financing_comparison.selected_pricing.install_monthly_tzs,
                        )}
                        /month
                      </p>
                      <p className="text-xs text-gray-500">
                        Net savings vs baseline:{" "}
                        {quoteData.financing_comparison.installment_net_savings_monthly != null
                          ? formatCurrency(
                              quoteData.financing_comparison.installment_net_savings_monthly,
                            )
                          : "N/A"}
                        /month
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Energy-as-a-Service (EaaS)</p>
                      {quoteData.financing_comparison.selected_pricing.eaas_monthly_tzs != null ? (
                        <>
                          <p className="text-sm text-gray-700">
                            Fee:{" "}
                            <span className="font-semibold">
                              {formatCurrency(
                                quoteData.financing_comparison.selected_pricing.eaas_monthly_tzs,
                              )}
                              /month
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Minimum term:{" "}
                            {quoteData.financing_comparison.selected_pricing.eaas_term_months ??
                              72}{" "}
                            months
                          </p>
                          <p className="text-xs text-gray-500">
                            Net savings vs baseline:{" "}
                            {quoteData.financing_comparison.eaas_net_savings_monthly != null
                              ? formatCurrency(
                                  quoteData.financing_comparison.eaas_net_savings_monthly,
                                )
                              : "N/A"}
                            /month
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">
                          No EaaS tariff configured for the closest system size.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

