"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

type EeatTab = "meu" | "baseline" | "assessment" | "improvements"

type MeuRow = {
  equipment: string
  powerW: string
  hoursPerDay: string
  kwhPerDay: number
  critical: boolean
}

export function EnergyEfficiencyAssessment() {
  const [activeTab, setActiveTab] = useState<EeatTab>("meu")

  // 4‑Point Assessment answers
  const [outageHours, setOutageHours] = useState<string>("")
  const [batteryBackup, setBatteryBackup] = useState<string>("")
  const [ledPercent, setLedPercent] = useState<string>("")
  const [devicesOff, setDevicesOff] = useState<string>("")
  const [acType, setAcType] = useState<string>("")
  const [insulation, setInsulation] = useState<string>("")
  const [staffTraining, setStaffTraining] = useState<string>("")
  const [monitoringAssigned, setMonitoringAssigned] = useState<string>("")
  const [assessmentScore, setAssessmentScore] = useState<number | null>(null)
  const [showScoreDialog, setShowScoreDialog] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)

  // Baseline numeric fields for quick sanity check / derived insight
  const [baselineBeforeSolar, setBaselineBeforeSolar] = useState<string>("")
  const [baselineCurrentConsumption, setBaselineCurrentConsumption] = useState<string>("")

  const [meuRows, setMeuRows] = useState<MeuRow[]>([
    { equipment: "Lighting", powerW: "", hoursPerDay: "", kwhPerDay: 0, critical: false },
    { equipment: "Vaccine fridge", powerW: "", hoursPerDay: "", kwhPerDay: 0, critical: true },
    { equipment: "Oxygen concentrator", powerW: "", hoursPerDay: "", kwhPerDay: 0, critical: true },
    { equipment: "Autoclave", powerW: "", hoursPerDay: "", kwhPerDay: 0, critical: false },
    { equipment: "Ultrasound", powerW: "", hoursPerDay: "", kwhPerDay: 0, critical: false },
    { equipment: "Computers/ICT", powerW: "", hoursPerDay: "", kwhPerDay: 0, critical: false },
  ])

  const [assessmentError, setAssessmentError] = useState<string | null>(null)

  const sanitizeNumberInput = (value: string) => {
    // Allow digits and at most one decimal point
    const cleaned = value.replace(/[^0-9.]/g, "")
    const parts = cleaned.split(".")
    if (parts.length <= 1) return cleaned
    return parts[0] + "." + parts.slice(1).join("")
  }

  const parseNumber = (value: string): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  const updateMeuRow = (index: number, changes: Partial<MeuRow>) => {
    setMeuRows((prev) => {
      const next = [...prev]
      const current = {
        ...next[index],
        ...("powerW" in changes && typeof changes.powerW === "string"
          ? { powerW: sanitizeNumberInput(changes.powerW) }
          : {}),
        ...("hoursPerDay" in changes && typeof changes.hoursPerDay === "string"
          ? { hoursPerDay: sanitizeNumberInput(changes.hoursPerDay) }
          : {}),
        ...changes,
      }
      const power = parseNumber(current.powerW)
      const hoursRaw = parseNumber(current.hoursPerDay)
      const hours = Math.min(hoursRaw, 24)
      if (hours !== hoursRaw) {
        current.hoursPerDay = hours.toString()
      }
      current.kwhPerDay = (power * hours) / 1000
      next[index] = current
      return next
    })
  }

  // AI improvements (Groq)
  const [improvementsNotes, setImprovementsNotes] = useState<string>("")
  const [aiRecommendations, setAiRecommendations] = useState<string>("")
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAiDialog, setShowAiDialog] = useState(false)

  const typeOutText = async (fullText: string) => {
    setAiRecommendations("")
    for (let i = 0; i < fullText.length; i++) {
      const slice = fullText.slice(0, i + 1)
      setAiRecommendations(slice)
      // Small delay for a "typing" effect; adjust as needed
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 15))
    }
  }

  const handleGenerateImprovements = async () => {
    if (!improvementsNotes.trim()) {
      setAiError("Please enter some notes about your facility and opportunities first.")
      return
    }
    setShowAiDialog(true)
    setIsGeneratingAi(true)
    setAiError(null)
    setAiRecommendations("")
    try {
      // Build structured context for the AI from current inputs
      const totalMeuLoad = meuRows.reduce((sum, r) => sum + r.kwhPerDay, 0)
      const topMeu = [...meuRows]
        .filter((r) => r.kwhPerDay > 0)
        .sort((a, b) => b.kwhPerDay - a.kwhPerDay)
        .slice(0, 5)
        .map((r) => `${r.equipment}: ${r.kwhPerDay.toFixed(2)} kWh/day${r.critical ? " (critical)" : ""}`)

      const before = parseNumber(baselineBeforeSolar)
      const current = parseNumber(baselineCurrentConsumption)
      const hasBaseline = before > 0 && current > 0
      const reduction = hasBaseline ? ((before - current) / before) * 100 : null

      const bmi =
        assessmentScore !== null ? Math.round((assessmentScore / 40) * 100) : null

      const structuredContextLines = [
        "=== Major Energy Uses (MEUs) Summary ===",
        `Total estimated MEU load: ${totalMeuLoad.toFixed(2)} kWh/day`,
        topMeu.length ? `Top MEUs: ${topMeu.join("; ")}` : "Top MEUs: not enough data entered.",
        "",
        "=== Baseline & EnPI Snapshot ===",
        `Baseline monthly consumption before solar (kWh): ${before || "not provided"}`,
        `Current monthly total consumption (kWh): ${current || "not provided"}`,
        hasBaseline && reduction !== null
          ? `Estimated reduction vs baseline: ${reduction.toFixed(1)}%`
          : "Estimated reduction vs baseline: not enough numeric data.",
        "",
        "=== 4‑Point Assessment (Behavior & Management Index) ===",
        assessmentScore !== null
          ? `Raw checklist score: ${assessmentScore}/40; Behavior & Management Index (BMI): ${bmi}%`
          : "Assessment not completed; BMI not available.",
        "",
        "=== User Summary Notes ===",
        improvementsNotes.trim(),
      ].join("\n")

      const res = await fetch("/api/energy-efficiency/improvements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context: structuredContextLines }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to generate recommendations")
      }

      const data = await res.json()
      const text = data.recommendations || ""
      await typeOutText(text)
    } catch (err: any) {
      console.error("AI improvements error", err)
      setAiError(err.message || "Something went wrong while calling the AI service.")
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const handlePrintSnapshot = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  const tabButtonClass = (id: EeatTab) =>
    `flex-1 px-3 py-2 text-xs sm:text-sm font-medium rounded-full border transition-colors ${
      activeTab === id
        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
        : "bg-white text-gray-600 border-gray-200 hover:bg-emerald-50"
    }`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy Efficiency Assessment Tool (EEAT)</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Comprehensive assessment aligned with ISO 50001:2018 and Tanzania NEES 2024–2034.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 bg-emerald-50/60 border border-emerald-100 rounded-full p-1">
          <button className={tabButtonClass("meu")} onClick={() => setActiveTab("meu")}>
            Major Energy Uses
          </button>
          <button className={tabButtonClass("baseline")} onClick={() => setActiveTab("baseline")}>
            Baseline &amp; EnPIs
          </button>
          <button className={tabButtonClass("assessment")} onClick={() => setActiveTab("assessment")}>
            4‑Point Assessment
          </button>
          <button className={tabButtonClass("improvements")} onClick={() => setActiveTab("improvements")}>
            Improvements
          </button>
        </div>

        {/* Major Energy Uses */}
        {activeTab === "meu" && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <span className="text-emerald-600 text-lg">⚡</span>
                Section 2: Major Energy Uses (MEUs)
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Identify equipment and systems consuming the highest share of electricity.
              </p>

              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Equipment/System</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Power (W)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Hours/Day</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">kWh/Day</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-700">Critical</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {meuRows.map((row, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-3 py-2">
                          <Input
                            value={row.equipment}
                            onChange={(e) =>
                              updateMeuRow(idx, { equipment: e.target.value })
                            }
                            className="h-8 text-xs sm:text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            placeholder="e.g. 150"
                            className="h-8 text-right text-xs sm:text-sm"
                            value={row.powerW}
                            onChange={(e) =>
                              updateMeuRow(idx, { powerW: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                      <Input
                            placeholder="e.g. 3"
                            className="h-8 text-right text-xs sm:text-sm"
                            value={row.hoursPerDay}
                            onChange={(e) =>
                              updateMeuRow(idx, { hoursPerDay: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 text-xs sm:text-sm">
                          {row.kwhPerDay.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Checkbox
                            checked={row.critical}
                            onCheckedChange={(checked) =>
                              updateMeuRow(idx, { critical: Boolean(checked) })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MEU quick summary */}
              {meuRows.some((r) => r.kwhPerDay > 0) && (
                <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-[11px] sm:text-xs text-emerald-700">
                  {(() => {
                    const total = meuRows.reduce((sum, r) => sum + r.kwhPerDay, 0)
                    if (!total) {
                      return <span className="font-medium">Enter power and hours to see MEU summary.</span>
                    }
                    const sorted = [...meuRows].sort((a, b) => b.kwhPerDay - a.kwhPerDay)
                    const top = sorted.slice(0, 3).filter((r) => r.kwhPerDay > 0)
                    return (
                      <>
                        <span className="font-medium">Total MEU load:</span>
                        <span>{total.toFixed(1)} kWh/day</span>
                        {top.length > 0 && (
                          <span className="text-emerald-800">
                            | Top uses:&nbsp;
                            {top
                              .map((r) => {
                                const share = (r.kwhPerDay / total) * 100
                                return `${r.equipment} (${share.toFixed(0)}%)`
                              })
                              .join(", ")}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">Analysis Questions</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs sm:text-sm">
                    Which 3–5 items account for the highest energy consumption?
                  </Label>
                  <Textarea
                    placeholder="List top consumers and their estimated contribution"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">
                    Are any loads operating inefficiently or unnecessarily long hours?
                  </Label>
                  <Textarea
                    placeholder="Describe inefficiencies observed"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">
                    Old appliances that could be replaced with energy‑efficient models
                  </Label>
                  <Textarea
                    placeholder="List equipment for upgrade consideration"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">
                    Are staff aware of which equipment uses the most power?
                  </Label>
                  <Textarea
                    placeholder="Select awareness level or describe current awareness"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Baseline & EnPIs */}
        {activeTab === "baseline" && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <span className="text-emerald-600 text-lg">📊</span>
                Section 3: Baseline Consumption Levels (EnB)
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Establish numeric baseline before and after solar installation (ISO 50006:2014 compliant).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Average monthly consumption BEFORE solar (kWh)</Label>
                  <Input
                    placeholder="e.g. 850"
                    className="text-xs sm:text-sm"
                    value={baselineBeforeSolar}
                    onChange={(e) => setBaselineBeforeSolar(sanitizeNumberInput(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Current monthly solar production (kWh)</Label>
                  <Input placeholder="e.g. 720" className="text-xs sm:text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Current monthly total consumption (kWh)</Label>
                  <Input
                    placeholder="e.g. 780"
                    className="text-xs sm:text-sm"
                    value={baselineCurrentConsumption}
                    onChange={(e) => setBaselineCurrentConsumption(sanitizeNumberInput(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Monthly diesel/grid backup usage (kWh or liters)</Label>
                  <Input placeholder="e.g. 60 kWh or 25 liters" className="text-xs sm:text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Peak energy demand hours</Label>
                  <Input placeholder="e.g. 8am–12pm, 5pm–9pm" className="text-xs sm:text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Recorded blackouts/shortages frequency</Label>
                  <Input placeholder="e.g. 2–3 times per week" className="text-xs sm:text-sm" />
                </div>
              </div>

              {/* Simple derived insight */}
              {baselineBeforeSolar && baselineCurrentConsumption && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-[11px] sm:text-xs text-emerald-700">
                  <span className="font-medium">Estimated reduction vs baseline:</span>
                  <span>
                    {(() => {
                      const before = parseNumber(baselineBeforeSolar)
                      const current = parseNumber(baselineCurrentConsumption)
                      if (!(before > 0) || !(current > 0)) return "—"
                      const reduction = ((before - current) / before) * 100
                      if (!Number.isFinite(reduction)) return "—"
                      return `${reduction.toFixed(1)}%`
                    })()}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">Seasonality in energy use (rainy vs dry season)</Label>
                <Textarea
                  placeholder="Describe seasonal variations"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">Data sources used</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox />
                    <span>Smart meter readings</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox />
                    <span>Inverter logs</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox />
                    <span>Utility bills</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox />
                    <span>Generator fuel logs</span>
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <span className="text-emerald-600 text-lg">📐</span>
                Section 4: Energy Performance Indicators (EnPIs)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Indicator</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Formula</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-700">Current Value</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-700">Target Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      {
                        label: "kWh per patient visit",
                        formula: "Total kWh ÷ patient visits",
                      },
                      {
                        label: "kWh per bed per day",
                        formula: "Total kWh ÷ occupied beds",
                      },
                      {
                        label: "Solar performance ratio (%)",
                        formula: "Actual ÷ expected × 100",
                      },
                      {
                        label: "Solar uptime (%)",
                        formula: "Solar hours ÷ total hours × 100",
                      },
                    ].map((row, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 text-gray-600">{row.formula}</td>
                        <td className="px-3 py-2 text-center">
                          <Input className="h-8 w-24 mx-auto text-xs sm:text-sm" placeholder="e.g. 2.5" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Input className="h-8 w-24 mx-auto text-xs sm:text-sm" placeholder="e.g. 2.0" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">
                    Who is responsible for data collection and review?
                  </Label>
                  <Input placeholder="e.g. Facility Manager" className="text-xs sm:text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">
                    How frequently are indicators monitored?
                  </Label>
                  <Select>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 4-Point Assessment */}
        {activeTab === "assessment" && (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Section 1: Power Reliability (Score: 0–10)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">How many hours of power outage per week?</Label>
                  <Select value={outageHours} onValueChange={setOutageHours}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-2">0–2 hours</SelectItem>
                      <SelectItem value="3-6">3–6 hours</SelectItem>
                      <SelectItem value="7-plus">&gt; 6 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Do you have battery backup for critical equipment?</Label>
                  <Select value={batteryBackup} onValueChange={setBatteryBackup}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All critical loads</SelectItem>
                      <SelectItem value="partial">Some critical loads</SelectItem>
                      <SelectItem value="none">No backup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Section 2: Energy Wastage (Score: 0–10)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Percentage of LED lighting in facility?</Label>
                  <Select value={ledPercent} onValueChange={setLedPercent}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">&lt; 50%</SelectItem>
                      <SelectItem value="medium">50–80%</SelectItem>
                      <SelectItem value="high">&gt; 80%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Are devices turned off when not in use?</Label>
                  <Select value={devicesOff} onValueChange={setDevicesOff}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">Always</SelectItem>
                      <SelectItem value="sometimes">Sometimes</SelectItem>
                      <SelectItem value="rarely">Rarely</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Section 3: Thermal Efficiency (Score: 0–10)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Type of air conditioning system?</Label>
                  <Select value={acType} onValueChange={setAcType}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No AC</SelectItem>
                      <SelectItem value="split">Split AC</SelectItem>
                      <SelectItem value="window">Window AC</SelectItem>
                      <SelectItem value="central">Central system</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Building insulation quality?</Label>
                  <Select value={insulation} onValueChange={setInsulation}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm sm:text-base font-semibold">
                Section 4: Staff Behavior (Score: 0–10)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Staff trained on energy conservation?</Label>
                  <Select value={staffTraining} onValueChange={setStaffTraining}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes-regularly">Yes, regularly</SelectItem>
                      <SelectItem value="yes-once">Yes, once</SelectItem>
                      <SelectItem value="no">No formal training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Energy monitoring responsibility assigned?</Label>
                  <Select value={monitoringAssigned} onValueChange={setMonitoringAssigned}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dedicated">Dedicated energy focal person</SelectItem>
                      <SelectItem value="shared">Shared responsibility</SelectItem>
                      <SelectItem value="none">Not assigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <div className="flex flex-col gap-1">
                {assessmentScore !== null ? (
                  <div className="text-xs sm:text-sm text-gray-700">
                    Behavior &amp; Management Index (BMI) from 4‑point checklist:{" "}
                    <span className="font-semibold text-emerald-700">
                      {assessmentScore}/40
                    </span>{" "}
                    (
                    {Math.round((assessmentScore / 40) * 100)}
                    %)
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-gray-500">
                    Answer all questions in each section, then calculate the checklist score.
                  </div>
                )}
                {assessmentError && (
                  <div className="text-[11px] text-red-600">{assessmentError}</div>
                )}
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  // Ensure all questions are answered before scoring
                  if (
                    !outageHours ||
                    !batteryBackup ||
                    !ledPercent ||
                    !devicesOff ||
                    !acType ||
                    !insulation ||
                    !staffTraining ||
                    !monitoringAssigned
                  ) {
                    setAssessmentError("Please answer all questions in the 4‑point checklist before calculating the score.")
                    return
                  }
                  setAssessmentError(null)
                  setIsCalculating(true)
                  // Simple scoring rules per answer (0–10 per section)
                  const s1 =
                    (outageHours === "0-2" ? 5 : outageHours === "3-6" ? 3 : outageHours === "7-plus" ? 1 : 0) +
                    (batteryBackup === "all" ? 5 : batteryBackup === "partial" ? 3 : batteryBackup === "none" ? 1 : 0)

                  const s2 =
                    (ledPercent === "high" ? 5 : ledPercent === "medium" ? 3 : ledPercent === "low" ? 1 : 0) +
                    (devicesOff === "always" ? 5 : devicesOff === "sometimes" ? 3 : devicesOff === "rarely" ? 1 : 0)

                  const s3 =
                    (acType === "none" ? 5 : acType === "split" ? 4 : acType === "window" ? 3 : acType === "central" ? 2 : 0) +
                    (insulation === "good" ? 5 : insulation === "average" ? 3 : insulation === "poor" ? 1 : 0)

                  const s4 =
                    (staffTraining === "yes-regularly"
                      ? 5
                      : staffTraining === "yes-once"
                      ? 3
                      : staffTraining === "no"
                      ? 1
                      : 0) +
                    (monitoringAssigned === "dedicated"
                      ? 5
                      : monitoringAssigned === "shared"
                      ? 3
                      : monitoringAssigned === "none"
                      ? 1
                      : 0)

                  const total = s1 + s2 + s3 + s4
                  setAssessmentScore(total)
                  // Small timeout so users notice the transition
                  setTimeout(() => {
                    setShowScoreDialog(true)
                    setIsCalculating(false)
                  }, 250)
                }}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Calculating...
                  </span>
                ) : (
                  "Calculate Assessment Score"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Improvements */}
        {activeTab === "improvements" && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <span className="text-amber-500 text-lg">💡</span>
                Section 5: Opportunities for Improvement
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Identify behavioral, operational, and technical improvements. You can also ask the AI assistant
                to propose tailored recommendations based on your notes.
              </p>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs sm:text-sm">Simple behavioral changes to reduce waste</Label>
                  <Textarea
                    placeholder="e.g. Turning off lights in unused rooms, unplugging chargers…"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Operational schedule optimizations</Label>
                  <Textarea
                    placeholder="e.g. Run autoclave during peak solar hours, schedule heavy loads…"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Staff training needs in energy‑saving practices</Label>
                  <Textarea
                    placeholder="e.g. Energy awareness workshops, device‑specific training…"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Equipment upgrades for better efficiency</Label>
                  <Textarea
                    placeholder="e.g. LED retrofit, inverter AC, solar‑compatible vaccine fridge…"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">System issues (leaks, shading, battery/inverter efficiency)</Label>
                  <Textarea
                    placeholder="e.g. Panel shading, loose connections, aging batteries…"
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs sm:text-sm">Summary notes for AI (optional but recommended)</Label>
                  <Textarea
                    placeholder="Summarize key issues, priorities, and context. The AI will use this to suggest improvements."
                    className="mt-1 text-xs sm:text-sm"
                    value={improvementsNotes}
                    onChange={(e) => setImprovementsNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex-1 text-[11px] sm:text-xs text-gray-500">
                    The AI will use these notes together with your MEUs, baseline, and EnPIs to suggest improvements.
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleGenerateImprovements}
                    disabled={isGeneratingAi}
                  >
                    {isGeneratingAi ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating AI recommendations…
                      </span>
                    ) : (
                      "Generate AI recommendations"
                    )}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </CardContent>

      {/* Popup for overall assessment score */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Energy Efficiency Assessment Score</DialogTitle>
            <DialogDescription className="text-sm">
              Summary of your 4‑point assessment for this facility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Overall Score
              </p>
              <p className="text-4xl font-bold text-emerald-700">
                {assessmentScore !== null ? assessmentScore : "--"}/40
              </p>
              {assessmentScore !== null && (
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round((assessmentScore / 40) * 100)}% compliance with good energy efficiency practices.
                </p>
              )}
            </div>
            <p className="text-xs text-gray-600">
              Use this score together with your baseline and EnPIs to track improvements over time.
              In future, this popup can also include AI‑generated recommendations.
            </p>
            <div className="flex justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowScoreDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup for AI-generated improvement suggestions */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>AI‑Generated Improvement Suggestions</DialogTitle>
            <DialogDescription className="text-sm">
              Recommendations based on your notes and typical energy‑efficiency best practices for health facilities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {isGeneratingAi && (
              <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span className="text-xs sm:text-sm text-emerald-800">
                  Generating tailored recommendations… This usually takes a few seconds.
                </span>
              </div>
            )}

            {aiError && !isGeneratingAi && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] sm:text-xs text-red-700">
                {aiError}
              </div>
            )}

            {!aiError && aiRecommendations && (
              <div className="rounded-md border border-emerald-100 bg-white px-3 py-3 max-h-80 overflow-y-auto">
                <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-gray-800 font-normal">
                  {aiRecommendations}
                </div>
              </div>
            )}

            {!isGeneratingAi && !aiError && !aiRecommendations && (
              <p className="text-[11px] sm:text-xs text-gray-500">
                Add some summary notes on the Improvements tab and click &ldquo;Generate AI recommendations&rdquo; to
                see suggestions here.
              </p>
            )}

            <div className="flex justify-between items-center pt-1 gap-2">
              <div className="text-[11px] sm:text-xs text-gray-400">
                You can copy and paste these suggestions into your report or action plan.
              </div>
              <div className="flex gap-2">
                {aiRecommendations && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(aiRecommendations).catch(() => {
                          // Best-effort copy; ignore failures
                        })
                      }
                    }}
                  >
                    Copy text
                  </Button>
                )}
              <Button size="sm" variant="outline" onClick={() => setShowAiDialog(false)}>
                Close
              </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

