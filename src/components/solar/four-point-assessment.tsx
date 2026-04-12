"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, ChevronDown, ChevronUp, Zap, Flame, Wind, Users } from "lucide-react"
import type { SectionScores } from "@/lib/intelligence/recommendations"
import { cn } from "@/lib/utils"

export type FourPointPersistedState = {
  outageHours: string
  batteryBackup: string
  ledPercent: string
  devicesOff: string
  acType: string
  insulation: string
  staffTraining: string
  monitoringAssigned: string
  assessmentScore: number | null
  openCard?: string | null
  sectionScores?: SectionScores
}

interface FourPointAssessmentProps {
  onScoreChange?: (summary: { score: number | null; bmiPercent: number | null }) => void
  onSectionScoresChange?: (sections: SectionScores | null) => void
  assessmentCycleId?: string
  /** Restored from `/api/assessment-cycles/.../energy` operations_data */
  initialOperationsData?: FourPointPersistedState | null
  readOnly?: boolean
}

function scoreReliability(outageHours: string, batteryBackup: string) {
  const o =
    outageHours === "0-2" ? 5 : outageHours === "3-6" ? 3 : outageHours === "7-plus" ? 1 : 0
  const b =
    batteryBackup === "all" ? 5 : batteryBackup === "partial" ? 3 : batteryBackup === "none" ? 1 : 0
  return o + b
}

function scoreWastage(ledPercent: string, devicesOff: string) {
  const l = ledPercent === "high" ? 5 : ledPercent === "medium" ? 3 : ledPercent === "low" ? 1 : 0
  const d = devicesOff === "always" ? 5 : devicesOff === "sometimes" ? 3 : devicesOff === "rarely" ? 1 : 0
  return l + d
}

function scoreThermal(acType: string, insulation: string) {
  const a = acType === "none" ? 5 : acType === "split" ? 4 : acType === "window" ? 3 : acType === "central" ? 2 : 0
  const i = insulation === "good" ? 5 : insulation === "average" ? 3 : insulation === "poor" ? 1 : 0
  return a + i
}

function scoreBehavior(staffTraining: string, monitoringAssigned: string) {
  const s =
    staffTraining === "yes-regularly"
      ? 5
      : staffTraining === "yes-once"
        ? 3
        : staffTraining === "no"
          ? 1
          : 0
  const m =
    monitoringAssigned === "dedicated"
      ? 5
      : monitoringAssigned === "shared"
        ? 3
        : monitoringAssigned === "none"
          ? 1
          : 0
  return s + m
}

export function FourPointAssessment({
  onScoreChange,
  onSectionScoresChange,
  assessmentCycleId,
  initialOperationsData,
  readOnly = false,
}: FourPointAssessmentProps) {
  const [outageHours, setOutageHours] = useState<string>("")
  const [batteryBackup, setBatteryBackup] = useState<string>("")
  const [ledPercent, setLedPercent] = useState<string>("")
  const [devicesOff, setDevicesOff] = useState<string>("")
  const [acType, setAcType] = useState<string>("")
  const [insulation, setInsulation] = useState<string>("")
  const [staffTraining, setStaffTraining] = useState<string>("")
  const [monitoringAssigned, setMonitoringAssigned] = useState<string>("")
  const [assessmentScore, setAssessmentScore] = useState<number | null>(null)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [showScoreDialog, setShowScoreDialog] = useState(false)

  const [openCard, setOpenCard] = useState<string | null>("reliability")

  const opsHydratedRef = useRef(false)
  useEffect(() => {
    opsHydratedRef.current = false
  }, [assessmentCycleId])

  useEffect(() => {
    if (!initialOperationsData || opsHydratedRef.current) return
    const o = initialOperationsData
    if (typeof o.outageHours === "string") setOutageHours(o.outageHours)
    if (typeof o.batteryBackup === "string") setBatteryBackup(o.batteryBackup)
    if (typeof o.ledPercent === "string") setLedPercent(o.ledPercent)
    if (typeof o.devicesOff === "string") setDevicesOff(o.devicesOff)
    if (typeof o.acType === "string") setAcType(o.acType)
    if (typeof o.insulation === "string") setInsulation(o.insulation)
    if (typeof o.staffTraining === "string") setStaffTraining(o.staffTraining)
    if (typeof o.monitoringAssigned === "string") setMonitoringAssigned(o.monitoringAssigned)
    if (typeof o.assessmentScore === "number" || o.assessmentScore === null) {
      setAssessmentScore(o.assessmentScore ?? null)
    }
    if (typeof o.openCard === "string") setOpenCard(o.openCard)
    opsHydratedRef.current = true
    if (typeof o.assessmentScore === "number") {
      onScoreChange?.({
        score: o.assessmentScore,
        bmiPercent: Math.round((o.assessmentScore / 40) * 100),
      })
    }
  }, [initialOperationsData, onScoreChange])

  const sectionScoresLive = useMemo(
    () => ({
      reliability: scoreReliability(outageHours, batteryBackup),
      wastage: scoreWastage(ledPercent, devicesOff),
      thermal: scoreThermal(acType, insulation),
      behavior: scoreBehavior(staffTraining, monitoringAssigned),
    }),
    [outageHours, batteryBackup, ledPercent, devicesOff, acType, insulation, staffTraining, monitoringAssigned]
  )

  useEffect(() => {
    onSectionScoresChange?.(sectionScoresLive)
  }, [sectionScoresLive, onSectionScoresChange])

  const handleCalculate = () => {
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
      setAssessmentError("Please answer all questions in the four domains before calculating the score.")
      return
    }

    setAssessmentError(null)
    setIsCalculating(true)

    const total =
      sectionScoresLive.reliability +
      sectionScoresLive.wastage +
      sectionScoresLive.thermal +
      sectionScoresLive.behavior

    setAssessmentScore(total)
    onScoreChange?.({
      score: total,
      bmiPercent: Math.round((total / 40) * 100),
    })

    setTimeout(() => {
      setIsCalculating(false)
      setShowScoreDialog(true)
    }, 250)
  }

  const bmiPercent = assessmentScore !== null ? Math.round((assessmentScore / 40) * 100) : null

  const maturity =
    bmiPercent === null
      ? "—"
      : bmiPercent >= 75
        ? "Strong"
        : bmiPercent >= 50
          ? "Developing"
          : "Early"

  const weakness = useMemo(() => {
    const s = sectionScoresLive
    const entries = [
      { k: "Power reliability", v: s.reliability },
      { k: "Energy wastage", v: s.wastage },
      { k: "Thermal efficiency", v: s.thermal },
      { k: "Staff behavior & management", v: s.behavior },
    ]
    return [...entries].sort((a, b) => a.v - b.v).slice(0, 3)
  }, [sectionScoresLive])

  useEffect(() => {
    if (readOnly) return
    if (!assessmentCycleId) return
    const t = window.setTimeout(async () => {
      try {
        const operationsData: FourPointPersistedState = {
          outageHours,
          batteryBackup,
          ledPercent,
          devicesOff,
          acType,
          insulation,
          staffTraining,
          monitoringAssigned,
          assessmentScore,
          openCard,
          sectionScores: sectionScoresLive,
        }
        await fetch(`/api/assessment-cycles/${assessmentCycleId}/energy`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationsData }),
        })
      } catch {
        // ignore
      }
    }, 1000)
    return () => window.clearTimeout(t)
  }, [
    assessmentCycleId,
    outageHours,
    batteryBackup,
    ledPercent,
    devicesOff,
    acType,
    insulation,
    staffTraining,
    monitoringAssigned,
    assessmentScore,
    openCard,
    sectionScoresLive,
    readOnly,
  ])

  const card = (
    id: string,
    title: string,
    subtitle: string,
    icon: ReactNode,
    score: number,
    children: ReactNode
  ) => {
    const expanded = openCard === id
    return (
      <Card className="border-emerald-100 overflow-hidden">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setOpenCard(expanded ? "" : id)}
        >
          <CardHeader className="py-3 px-4 bg-emerald-50/50 hover:bg-emerald-50/80 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="rounded-lg bg-white border border-emerald-100 p-2 text-emerald-700">{icon}</div>
                <div>
                  <CardTitle className="text-sm font-semibold text-emerald-950">{title}</CardTitle>
                  <CardDescription className="text-xs">{subtitle}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-emerald-800 tabular-nums">
                  {score}/10
                </span>
                {expanded ? <ChevronUp className="h-4 w-4 text-emerald-700" /> : <ChevronDown className="h-4 w-4 text-emerald-700" />}
              </div>
            </div>
          </CardHeader>
        </button>
        <div className={cn("grid transition-[grid-template-rows] duration-200", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <CardContent className="pt-0 pb-4 px-4 border-t border-emerald-100/80">{children}</CardContent>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <fieldset
      disabled={readOnly}
      className="min-w-0 space-y-4 border-0 p-0 m-0 disabled:opacity-[0.88]"
    >
      <Card className="border-emerald-100">
        <CardHeader>
          <CardTitle>Operational efficiency &amp; management</CardTitle>
          <CardDescription>
            {readOnly
              ? "Saved responses for this assessment record (read-only)."
              : "Four scored domains (same logic as the classic 4-point checklist). Expand each card to answer; scores update live. Calculate when all fields are complete."}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {card(
          "reliability",
          "Power reliability",
          "Outages and backup coverage",
          <Zap className="h-4 w-4" />,
          sectionScoresLive.reliability,
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Hours of power outage per week?</Label>
              <Select value={outageHours} onValueChange={setOutageHours}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-2">0–2 hours</SelectItem>
                  <SelectItem value="3-6">3–6 hours</SelectItem>
                  <SelectItem value="7-plus">&gt; 6 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Battery backup for critical equipment?</Label>
              <Select value={batteryBackup} onValueChange={setBatteryBackup}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All critical loads</SelectItem>
                  <SelectItem value="partial">Some critical loads</SelectItem>
                  <SelectItem value="none">No backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {card(
          "wastage",
          "Energy wastage",
          "Lighting and idle loads",
          <Flame className="h-4 w-4" />,
          sectionScoresLive.wastage,
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Share of LED lighting?</Label>
              <Select value={ledPercent} onValueChange={setLedPercent}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">&lt; 50%</SelectItem>
                  <SelectItem value="medium">50–80%</SelectItem>
                  <SelectItem value="high">&gt; 80%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Devices off when not in use?</Label>
              <Select value={devicesOff} onValueChange={setDevicesOff}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Always</SelectItem>
                  <SelectItem value="sometimes">Sometimes</SelectItem>
                  <SelectItem value="rarely">Rarely</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {card(
          "thermal",
          "Thermal efficiency",
          "Cooling and building shell",
          <Wind className="h-4 w-4" />,
          sectionScoresLive.thermal,
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Air conditioning type?</Label>
              <Select value={acType} onValueChange={setAcType}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
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
              <Label className="text-xs">Building insulation quality?</Label>
              <Select value={insulation} onValueChange={setInsulation}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {card(
          "behavior",
          "Staff behavior & management",
          "Training and accountability",
          <Users className="h-4 w-4" />,
          sectionScoresLive.behavior,
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Staff trained on energy conservation?</Label>
              <Select value={staffTraining} onValueChange={setStaffTraining}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes-regularly">Yes, regularly</SelectItem>
                  <SelectItem value="yes-once">Yes, once</SelectItem>
                  <SelectItem value="no">No formal training</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Energy monitoring assigned?</Label>
              <Select value={monitoringAssigned} onValueChange={setMonitoringAssigned}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dedicated">Dedicated focal person</SelectItem>
                  <SelectItem value="shared">Shared responsibility</SelectItem>
                  <SelectItem value="none">Not assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-emerald-100 bg-white p-4 space-y-2">
        <p className="text-xs font-semibold text-emerald-900">Live summary</p>
        <ul className="text-xs text-emerald-900/90 space-y-1">
          <li>
            BMI (when calculated):{" "}
            <span className="font-semibold">
              {assessmentScore !== null ? `${assessmentScore}/40` : "—"} {bmiPercent !== null && `(${bmiPercent}%)`}
            </span>
          </li>
          <li>
            Operational maturity (from last calculation): <span className="font-semibold">{maturity}</span>
          </li>
          <li className="text-muted-foreground">
            Weakest domains (by live section score):{" "}
            {weakness.map((w) => `${w.k} (${w.v}/10)`).join(" · ")}
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-emerald-100">
        <div className="text-xs text-gray-600">
          {assessmentError && <span className="text-red-600">{assessmentError}</span>}
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCalculate} disabled={isCalculating}>
          {isCalculating ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Calculating…
            </span>
          ) : (
            "Calculate BMI"
          )}
        </Button>
      </div>

      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Operational BMI</DialogTitle>
            <DialogDescription className="text-sm">Four-domain operational energy management score.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-center">
              <p className="text-4xl font-bold text-emerald-700">
                {assessmentScore !== null && bmiPercent !== null ? `${assessmentScore}/40` : "—"}
              </p>
              {bmiPercent !== null && <p className="text-xs text-gray-600 mt-1">{bmiPercent}% of best-practice checklist</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-emerald-100 p-2">Reliability: {sectionScoresLive.reliability}/10</div>
              <div className="rounded border border-emerald-100 p-2">Wastage: {sectionScoresLive.wastage}/10</div>
              <div className="rounded border border-emerald-100 p-2">Thermal: {sectionScoresLive.thermal}/10</div>
              <div className="rounded border border-emerald-100 p-2">Behavior: {sectionScoresLive.behavior}/10</div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowScoreDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </fieldset>
  )
}
