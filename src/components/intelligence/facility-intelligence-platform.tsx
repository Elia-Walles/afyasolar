"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  AfyaSolarSizingTool,
  type SizingSummary,
  type MeuSummary,
  type FacilityContextSnapshot,
  type RecommendedPackageInput,
} from "@/components/solar/afya-solar-sizing-tool"
import { FourPointAssessment } from "@/components/solar/four-point-assessment"
import { IntelligenceChartGrid } from "@/components/intelligence/energy-charts"
import { FacilityMeterEfficiencyDashboard } from "@/components/efficiency/facility-meter-efficiency-dashboard"
import { FacilityClimateResilienceDashboard } from "@/components/efficiency/facility-climate-resilience-dashboard"
import { ClimateResilienceAssessment } from "@/components/climate/climate-resilience-assessment"
import { buildIntelligenceRecommendations, type SectionScores } from "@/lib/intelligence/recommendations"
import { getErrorMessage } from "@/lib/get-error-message"
import { notifyError, notifySuccess } from "@/lib/toast-feedback"
import { formatCurrency } from "@/lib/utils"
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "lucide-react"

type IntelTab = "overview" | "assess" | "analyze" | "action" | "reports"

type AssessmentCycleRow = {
  id: string
  status: string
  startedAt?: string | Date | null
}

const tabTriggerClass =
  "text-xs sm:text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm"

type StepStatus = "complete" | "in_progress" | "blocked"

export type IntelligencePlatformScope = "full" | "energy" | "climate"

interface FacilityIntelligencePlatformProps {
  facilityId?: string
  facilityName?: string
  packages?: RecommendedPackageInput[]
  /** full = legacy combined workflow; energy = devices, operations, charts (no climate assess UI); climate = resilience assessment + dashboards */
  platformScope?: IntelligencePlatformScope
  sizingSummary: SizingSummary | null
  meuSummary: MeuSummary | null
  bmiSummary: { score: number | null; bmiPercent: number | null } | null
  sectionScores: SectionScores | null
  onSizingSummaryChange: (s: SizingSummary) => void
  onMeuSummaryChange: (s: MeuSummary) => void
  onBmiSummaryChange: (s: { score: number | null; bmiPercent: number | null }) => void
  onSectionScoresChange: (s: SectionScores | null) => void
}

export function FacilityIntelligencePlatform({
  facilityId,
  facilityName,
  packages,
  platformScope = "full",
  sizingSummary,
  meuSummary,
  bmiSummary,
  sectionScores,
  onSizingSummaryChange,
  onMeuSummaryChange,
  onBmiSummaryChange,
  onSectionScoresChange,
}: FacilityIntelligencePlatformProps) {
  const isEnergyOnly = platformScope === "energy"
  const isClimateOnly = platformScope === "climate"

  const [mainTab, setMainTab] = useState<IntelTab>("overview")
  const [assessSub, setAssessSub] = useState<"devices" | "operations" | "climate">("devices")
  const [facilityCtx, setFacilityCtx] = useState<FacilityContextSnapshot | null>(null)
  const [climateResilienceScore, setClimateResilienceScore] = useState<number | null>(null)
  const [assessmentCycleId, setAssessmentCycleId] = useState<string | null>(null)
  const [actionMeta, setActionMeta] = useState<Record<string, { owner?: string; dueDate?: string }>>({})
  const [bmiTrend, setBmiTrend] = useState<{ date: string; value: number }[]>([])
  const [actionPlanStatus, setActionPlanStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [persistedClimateScore, setPersistedClimateScore] = useState<{
    rcs: number
    tier: number
    criticalAttention: boolean
  } | null>(null)
  const [persistedTopRisks, setPersistedTopRisks] = useState<
    { id: string; title: string; severity: number; riskType: string; rank: number }[]
  >([])
  const [persistedTasks, setPersistedTasks] = useState<
    { id: string; recommendationId: string; ownerName: string | null; dueDate: string | null; status: string }[]
  >([])
  const [energySnapshot, setEnergySnapshot] = useState<{
    sizingData: unknown | null
    operationsData: unknown | null
    bmiTrendJson: unknown | null
  } | null>(null)
  const [assessmentCyclesList, setAssessmentCyclesList] = useState<AssessmentCycleRow[]>([])
  const [reassessBusy, setReassessBusy] = useState(false)
  const [reassessDialogOpen, setReassessDialogOpen] = useState(false)

  const selectedCycle = useMemo(
    () => assessmentCyclesList.find((c) => c.id === assessmentCycleId) ?? null,
    [assessmentCyclesList, assessmentCycleId]
  )
  const assessmentReadOnly = Boolean(selectedCycle && selectedCycle.status !== "draft")

  const formatCycleLabel = useCallback((c: AssessmentCycleRow) => {
    const raw = c.startedAt
    let d: Date
    if (raw instanceof Date) d = raw
    else if (typeof raw === "string") d = new Date(raw)
    else d = new Date()
    const label = Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"
    const tag =
      c.status === "draft" ? "Current (editing)" : c.status === "completed" ? "Previous (saved)" : c.status
    return `${label} · ${tag}`
  }, [])

  const handleReassessConfirm = useCallback(async () => {
    if (!facilityId || !assessmentCycleId) return
    setReassessBusy(true)
    setReassessDialogOpen(false)
    try {
      const patchRes = await fetch(`/api/facility/${facilityId}/assessment-cycles/${assessmentCycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
      const patchJson = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) {
        throw new Error((patchJson as { error?: string }).error || "Could not close the current assessment")
      }

      const createRes = await fetch(`/api/facility/${facilityId}/assessment-cycles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "2.0" }),
      })
      const createJson = await createRes.json()
      if (!createRes.ok || !createJson?.cycle?.id) {
        throw new Error((createJson as { error?: string }).error || "Could not start a new assessment")
      }

      const newId = createJson.cycle.id as string
      const listRes = await fetch(`/api/facility/${facilityId}/assessment-cycles`, { cache: "no-store" })
      const listJson = await listRes.json()
      const nextList: AssessmentCycleRow[] = Array.isArray(listJson?.cycles) ? listJson.cycles : []
      setAssessmentCyclesList(nextList)
      setAssessmentCycleId(newId)
      notifySuccess(
        "New assessment started",
        "Previous answers remain on file under the saved date. Enter updates in this new cycle."
      )
      setMainTab("assess")
    } catch (e) {
      notifyError("Could not re-assess", getErrorMessage(e))
    } finally {
      setReassessBusy(false)
    }
  }, [facilityId, assessmentCycleId])

  // Load cycles; ensure a draft exists for new entries.
  useEffect(() => {
    let cancelled = false
    if (!facilityId) {
      setAssessmentCyclesList([])
      setAssessmentCycleId(null)
      setClimateResilienceScore(null)
      setPersistedClimateScore(null)
      setPersistedTopRisks([])
      setPersistedTasks([])
      return
    }
    ;(async () => {
      try {
        const cyclesRes = await fetch(`/api/facility/${facilityId}/assessment-cycles`, { cache: "no-store" })
        const cyclesJson = await cyclesRes.json()
        let cycles: AssessmentCycleRow[] = Array.isArray(cyclesJson?.cycles) ? cyclesJson.cycles : []

        let draft = cycles.find((c) => c?.status === "draft")
        if (!draft) {
          const createRes = await fetch(`/api/facility/${facilityId}/assessment-cycles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: "2.0" }),
          })
          const createJson = await createRes.json()
          if (createJson?.cycle) {
            draft = createJson.cycle
            cycles = [createJson.cycle, ...cycles]
          }
        }

        if (cancelled) return
        setAssessmentCyclesList(cycles)

        setAssessmentCycleId((prev) => {
          if (prev && cycles.some((c) => c.id === prev)) return prev
          return draft?.id ?? cycles[0]?.id ?? null
        })
      } catch {
        if (!cancelled) {
          setAssessmentCyclesList([])
          setAssessmentCycleId(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [facilityId])

  // Climate scores for the selected assessment cycle
  useEffect(() => {
    let cancelled = false
    if (!facilityId || !assessmentCycleId) {
      setClimateResilienceScore(null)
      setPersistedClimateScore(null)
      setPersistedTopRisks([])
      return
    }

    const isDraftSelected = selectedCycle?.status === "draft"

    ;(async () => {
      try {
        const climateRes = await fetch(`/api/assessment-cycles/${assessmentCycleId}/climate`, { cache: "no-store" })
        const climateJson = await climateRes.json()
        const score = climateJson?.score?.rcs
        if (cancelled) return

        if (score !== undefined && score !== null) {
          setPersistedClimateScore({
            rcs: Number(climateJson.score.rcs),
            tier: Number(climateJson.score.tier ?? 0),
            criticalAttention: Boolean(climateJson.score.criticalAttention),
          })
          setPersistedTopRisks(Array.isArray(climateJson?.topRisks) ? climateJson.topRisks : [])
          setClimateResilienceScore(Number(score))
          return
        }

        setPersistedClimateScore(null)
        setPersistedTopRisks([])
        if (!isDraftSelected) {
          setClimateResilienceScore(null)
          return
        }

        const res = await fetch(`/api/facility/${facilityId}/climate-resilience`, { cache: "no-store" })
        const json = await res.json()
        if (
          !cancelled &&
          json?.data?.profile?.overallResilienceScore !== undefined &&
          json?.data?.profile?.overallResilienceScore !== null
        ) {
          setClimateResilienceScore(Number(json.data.profile.overallResilienceScore))
        } else if (!cancelled) {
          setClimateResilienceScore(null)
        }
      } catch {
        if (!cancelled) setClimateResilienceScore(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [facilityId, assessmentCycleId, selectedCycle?.status])

  // Load persisted energy-efficiency state (devices/loads + four-point BMI) for this assessment cycle
  useEffect(() => {
    let cancelled = false
    if (!assessmentCycleId) {
      setEnergySnapshot(null)
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`/api/assessment-cycles/${assessmentCycleId}/energy`, { cache: "no-store" })
        const j = await res.json()
        if (cancelled || !res.ok) return
        setEnergySnapshot({
          sizingData: j.sizingData ?? null,
          operationsData: j.operationsData ?? null,
          bmiTrendJson: j.bmiTrendJson ?? null,
        })
        if (Array.isArray(j.bmiTrendJson) && j.bmiTrendJson.length > 0) {
          setBmiTrend(j.bmiTrendJson as { date: string; value: number }[])
        } else if (!assessmentReadOnly && facilityId && typeof window !== "undefined") {
          try {
            const key = `afyasolar:bmiTrend:${facilityId}`
            const prevRaw = window.localStorage.getItem(key)
            const prev: { date: string; value: number }[] = prevRaw ? JSON.parse(prevRaw) : []
            if (Array.isArray(prev) && prev.length > 0) setBmiTrend(prev.slice(-12))
          } catch {
            // ignore
          }
        }
      } catch {
        if (!cancelled) setEnergySnapshot(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assessmentCycleId, facilityId, assessmentReadOnly])

  useEffect(() => {
    if (assessmentReadOnly) return
    if (!assessmentCycleId || bmiTrend.length === 0) return
    const t = window.setTimeout(async () => {
      try {
        await fetch(`/api/assessment-cycles/${assessmentCycleId}/energy`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bmiTrendJson: bmiTrend }),
        })
      } catch {
        // ignore
      }
    }, 1200)
    return () => window.clearTimeout(t)
  }, [bmiTrend, assessmentCycleId, assessmentReadOnly])

  useEffect(() => {
    if (isEnergyOnly && assessSub === "climate") setAssessSub("devices")
  }, [isEnergyOnly, assessSub])

  useEffect(() => {
    if (isClimateOnly) setAssessSub("climate")
  }, [isClimateOnly])

  useEffect(() => {
    let cancelled = false
    if (!assessmentCycleId) {
      setPersistedTasks([])
      return
    }

    ;(async () => {
      try {
        const res = await fetch(`/api/assessment-cycles/${assessmentCycleId}/action-plan`, { cache: "no-store" })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) return
        const tasks = Array.isArray(json?.tasks) ? json.tasks : []
        setPersistedTasks(tasks)
      } catch {
        if (!cancelled) setPersistedTasks([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assessmentCycleId])

  const recommendations = useMemo(
    () => buildIntelligenceRecommendations(sizingSummary, meuSummary, bmiSummary, sectionScores),
    [sizingSummary, meuSummary, bmiSummary, sectionScores]
  )

  const completion = useMemo(() => {
    const devicesDone = Boolean(meuSummary && meuSummary.totalDailyLoad > 0)
    const operationsDone = Boolean(bmiSummary != null && bmiSummary.score !== null)
    const climateDone = climateResilienceScore !== null

    if (isClimateOnly) {
      const assessDone = climateDone
      const analyzeReady = climateDone
      return {
        devicesDone,
        operationsDone,
        climateDone,
        assessDone,
        analyzeReady,
        actionReady: analyzeReady,
        reportsReady: analyzeReady,
      }
    }

    if (isEnergyOnly) {
      const assessDone = devicesDone && operationsDone
      const analyzeReady = devicesDone || operationsDone
      return {
        devicesDone,
        operationsDone,
        climateDone,
        assessDone,
        analyzeReady,
        actionReady: analyzeReady,
        reportsReady: analyzeReady,
      }
    }

    const assessDone = devicesDone && operationsDone && climateDone
    const analyzeReady = devicesDone || operationsDone || climateDone
    return {
      devicesDone,
      operationsDone,
      climateDone,
      assessDone,
      analyzeReady,
      actionReady: analyzeReady,
      reportsReady: analyzeReady,
    }
  }, [meuSummary, bmiSummary, climateResilienceScore, isClimateOnly, isEnergyOnly])

  const assessProgress = useMemo(() => {
    if (isClimateOnly) {
      return climateResilienceScore !== null ? 100 : 0
    }
    if (isEnergyOnly) {
      let done = 0
      const total = 2
      if (meuSummary && meuSummary.totalDailyLoad > 0) done++
      if (bmiSummary != null && bmiSummary.score !== null) done++
      return Math.round((done / total) * 100)
    }
    let done = 0
    const total = 3
    if (meuSummary && meuSummary.totalDailyLoad > 0) done++
    if (bmiSummary != null && bmiSummary.score !== null) done++
    if (climateResilienceScore !== null) done++
    return Math.round((done / total) * 100)
  }, [meuSummary, bmiSummary, climateResilienceScore, isClimateOnly, isEnergyOnly])

  const efficiencyScore = bmiSummary?.bmiPercent ?? null

  useEffect(() => {
    if (!facilityId || efficiencyScore == null) return
    const key = `afyasolar:bmiTrend:${facilityId}`
    try {
      const prevRaw = localStorage.getItem(key)
      const prev: { date: string; value: number }[] = prevRaw ? JSON.parse(prevRaw) : []
      const today = new Date().toISOString().slice(0, 10)
      const next = [...prev]
      // Replace existing point for today, else append
      const existingIdx = next.findIndex((p) => p.date === today)
      if (existingIdx >= 0) next[existingIdx] = { date: today, value: Number(efficiencyScore) }
      else next.push({ date: today, value: Number(efficiencyScore) })
      const trimmed = next.slice(-12)
      localStorage.setItem(key, JSON.stringify(trimmed))
      setBmiTrend(trimmed)
    } catch {
      // ignore
    }
  }, [facilityId, efficiencyScore])

  useEffect(() => {
    if (!facilityId) return
    const key = `afyasolar:bmiTrend:${facilityId}`
    try {
      const prevRaw = localStorage.getItem(key)
      const prev: { date: string; value: number }[] = prevRaw ? JSON.parse(prevRaw) : []
      if (Array.isArray(prev)) setBmiTrend(prev.slice(-12))
    } catch {
      // ignore
    }
  }, [facilityId])

  const nextRecommendedStep = useMemo((): IntelTab => {
    if (isClimateOnly) {
      if (climateResilienceScore === null) return "assess"
      return "analyze"
    }
    if (isEnergyOnly) {
      if (!completion.devicesDone || !completion.operationsDone) return "assess"
      return "analyze"
    }
    if (!completion.devicesDone || !completion.operationsDone || !completion.climateDone) return "assess"
    if (completion.analyzeReady) return "analyze"
    return "overview"
  }, [completion, climateResilienceScore, isClimateOnly, isEnergyOnly])

  const stepStatus = useMemo(() => {
    const map: Record<IntelTab, StepStatus> = {
      overview: "in_progress",
      assess: completion.assessDone ? "complete" : "in_progress",
      analyze: completion.analyzeReady ? "in_progress" : "blocked",
      action: completion.actionReady ? "in_progress" : "blocked",
      reports: completion.reportsReady ? "in_progress" : "blocked",
    }
    return map
  }, [completion])

  const onNavigate = (tab: IntelTab) => {
    // Guided workflow gating
    if (tab === "analyze" || tab === "action" || tab === "reports") {
      if (!completion.analyzeReady) {
        setMainTab("assess")
        setAssessSub(isClimateOnly ? "climate" : "devices")
        return
      }
    }
    setMainTab(tab)
  }

  const StepPill = ({
    id,
    label,
    status,
  }: {
    id: IntelTab
    label: string
    status: StepStatus
  }) => {
    const active = mainTab === id
    const base =
      "w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm transition-colors"
    const styles = active
      ? "border-emerald-300 bg-white shadow-sm text-emerald-950"
      : status === "blocked"
        ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
        : "border-emerald-100 bg-emerald-50/40 text-emerald-900 hover:bg-emerald-50"
    return (
      <button
        type="button"
        onClick={() => status !== "blocked" && onNavigate(id)}
        className={`${base} ${styles}`}
        aria-current={active ? "step" : undefined}
      >
        <span className="font-medium">{label}</span>
        {status === "complete" ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 text-[10px]">
            Done
          </Badge>
        ) : status === "blocked" ? (
          <Badge variant="outline" className="text-[10px] border-slate-200">
            Locked
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-800">
            In progress
          </Badge>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              {isClimateOnly
                ? "Climate resilience & adaptation"
                : isEnergyOnly
                  ? "Energy efficiency & planning"
                  : "AfyaSolar Intelligence"}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-900/80 max-w-2xl">
              {isClimateOnly
                ? "Guided climate readiness (CRiPHC-aligned), hazard context, adaptation tracking, and saved risk drivers for your facility."
                : isEnergyOnly
                  ? "Guided devices & loads sizing, operational efficiency (BMI), and analysis charts—without mixing in the climate questionnaire here."
                  : "Guided assessment, analysis, and actions in one workflow. Energy, meter efficiency, and climate resilience scoring are integrated below."}
            </p>
          </div>
          {facilityName && (
            <Badge variant="outline" className="border-emerald-200 text-emerald-800 w-fit">
              {facilityName}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as IntelTab)} className="space-y-4">
        {/* Guided workflow stepper (v2.0 IA) */}
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-5">
            <StepPill id="overview" label="Overview" status="in_progress" />
            <StepPill id="assess" label="Assess" status={stepStatus.assess} />
            <StepPill id="analyze" label="Analyze" status={stepStatus.analyze} />
            <StepPill id="action" label="Action plan" status={stepStatus.action} />
            <StepPill id="reports" label="Reports & portfolio" status={stepStatus.reports} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs text-emerald-900/80">
                Next recommended:{" "}
                <span className="font-semibold text-emerald-950">
                  {nextRecommendedStep === "assess"
                    ? "Assess"
                    : nextRecommendedStep === "analyze"
                      ? "Analyze"
                      : "Overview"}
                </span>
                {nextRecommendedStep === "assess" && (
                  <span className="text-emerald-900/70">
                    {" "}
                    {isClimateOnly
                      ? "— complete the climate readiness questionnaire."
                      : isEnergyOnly
                        ? "— complete Devices & loads and Operational efficiency."
                        : "— complete Devices & loads, Operational efficiency, and Climate readiness."}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onNavigate(nextRecommendedStep)}
              >
                Continue
              </Button>
              <Button size="sm" variant="outline" className="border-emerald-200" onClick={() => onNavigate("reports")}>
                View report
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {isClimateOnly ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Resilience capacity score (RCS)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {persistedClimateScore?.rcs ?? (climateResilienceScore !== null ? climateResilienceScore : "—")}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Tier &amp; attention</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {persistedClimateScore ? `Tier ${persistedClimateScore.tier}` : "—"}
                  </CardTitle>
                  {persistedClimateScore?.criticalAttention && (
                    <p className="text-[11px] text-amber-800 font-medium">Critical attention</p>
                  )}
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Top risk drivers (saved)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">{persistedTopRisks.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Follow-up tasks (saved)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">{persistedTasks.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Assessment progress</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">{assessProgress}%</CardTitle>
                  <Progress value={assessProgress} className="h-2 mt-2 bg-emerald-100" />
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Facility</CardDescription>
                  <CardTitle className="text-lg text-emerald-900 line-clamp-2">{facilityName ?? facilityId ?? "—"}</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Cycle auto-saved to your assessment record.</p>
                </CardHeader>
              </Card>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Daily demand (est.)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? `${sizingSummary.totalDailyLoad.toFixed(1)} kWh/d` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Indicative solar size</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? `${sizingSummary.solarArraySize.toFixed(1)} kW` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Annual savings (slider model)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? formatCurrency(sizingSummary.annualSavings) : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Operational score (BMI)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {efficiencyScore !== null ? `${efficiencyScore}%` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              {!isEnergyOnly && (
                <Card className="border-emerald-100">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Climate resilience score</CardDescription>
                    <CardTitle className="text-2xl text-emerald-900">
                      {climateResilienceScore !== null ? climateResilienceScore : "—"}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      {facilityId
                        ? "From hazard exposure + adaptation progress (demo-seeded when DB empty)."
                        : "Sign in as a facility to load climate data."}
                    </p>
                  </CardHeader>
                </Card>
              )}
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Assessment progress</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">{assessProgress}%</CardTitle>
                  <Progress value={assessProgress} className="h-2 mt-2 bg-emerald-100" />
                </CardHeader>
              </Card>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="text-sm">Top recommended actions</CardTitle>
                <CardDescription className="text-xs">From your latest inputs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendations.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-lg border border-emerald-50 bg-white px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-950">{r.title}</span>
                      <Badge
                        variant="outline"
                        className={
                          r.priority === "high"
                            ? "border-red-200 text-red-800"
                            : r.priority === "medium"
                              ? "border-amber-200 text-amber-900"
                              : "border-slate-200 text-slate-700"
                        }
                      >
                        {r.priority}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 line-clamp-2">{r.action}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-emerald-100">
              <CardHeader>
                <CardTitle className="text-sm">
                  {isClimateOnly
                    ? "Climate readiness snapshot"
                    : isEnergyOnly
                      ? "Energy snapshot"
                      : "Energy–resilience snapshot"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isClimateOnly ? (
                    <>
                      RCS{" "}
                      {persistedClimateScore?.rcs ?? (climateResilienceScore !== null ? climateResilienceScore : "—")} ·
                      Tier {persistedClimateScore ? persistedClimateScore.tier : "—"}
                    </>
                  ) : isEnergyOnly ? (
                    <>BMI {efficiencyScore !== null ? `${efficiencyScore}%` : "—"} (operational efficiency)</>
                  ) : (
                    <>
                      BMI {efficiencyScore !== null ? `${efficiencyScore}%` : "—"} · Resilience{" "}
                      {climateResilienceScore !== null ? climateResilienceScore : "—"}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {isClimateOnly ? (
                    <>
                      Charts in <span className="font-medium text-emerald-900">Analyze</span>; saved drivers and tasks in{" "}
                      <span className="font-medium text-emerald-900">Reports &amp; portfolio</span>.
                    </>
                  ) : isEnergyOnly ? (
                    <>
                      Use the <span className="font-medium text-emerald-900">Climate resilience</span> sidebar entry for
                      hazards, adaptation tracking, and saved climate risk drivers.
                    </>
                  ) : (
                    <>
                      Use <span className="font-medium text-emerald-900">Energy Efficiency</span> for meter-based yield vs
                      expected, and <span className="font-medium text-emerald-900">Climate resilience</span> for hazards
                      and adaptation tracking.
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onNavigate("assess")}>
              Continue assessment
            </Button>
            <Button size="sm" variant="outline" className="border-emerald-200" onClick={() => onNavigate("analyze")}>
              View charts
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="assess" className="space-y-4 mt-4">
          {facilityId && assessmentCyclesList.length > 0 && (
            <Card className="border-emerald-100 bg-white/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assessment record</CardTitle>
                <CardDescription className="text-xs">
                  View previous saved data or the current cycle. Re-assess starts a new cycle after you have finished the
                  checklist.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="space-y-1.5 min-w-[min(100%,280px)] flex-1 max-w-md">
                  <Label className="text-xs">View data for</Label>
                  <Select
                    value={assessmentCycleId ?? ""}
                    onValueChange={(id) => setAssessmentCycleId(id)}
                    disabled={reassessBusy}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select assessment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assessmentCyclesList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {formatCycleLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {assessmentReadOnly && (
                    <Badge variant="secondary" className="text-[10px]">
                      Read-only (previous submission)
                    </Badge>
                  )}
                  {!assessmentReadOnly && completion.assessDone && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-emerald-200"
                      loading={reassessBusy}
                      onClick={() => setReassessDialogOpen(true)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" aria-hidden />
                      Re-assess
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-emerald-900/90">
              {isClimateOnly
                ? "Complete the guided climate readiness questionnaire; scores and risk drivers save to your assessment cycle."
                : isEnergyOnly
                  ? "Start with devices & loads, then operational efficiency (BMI). Use Climate resilience in the sidebar for hazards and adaptation."
                  : "Step through devices, operational practice, then climate readiness."}
            </p>
            <Progress value={assessProgress} className="h-2 w-full sm:w-48 bg-emerald-100" />
          </div>
          {isClimateOnly ? (
            <div className="mt-4 space-y-4">
              {facilityId ? (
                <div className="space-y-4">
                  <ClimateResilienceAssessment
                    facilityId={facilityId}
                    assessmentCycleId={assessmentCycleId ?? undefined}
                    onCapacityScoreChange={(score) => setClimateResilienceScore(score)}
                    readOnly={assessmentReadOnly}
                  />
                  <Card className="border-emerald-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Climate dashboard (facility profile)</CardTitle>
                      <CardDescription className="text-xs">
                        Hazard radar and adaptation tracker; complements the guided assessment above.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FacilityClimateResilienceDashboard facilityId={facilityId} />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <FacilityClimateResilienceDashboard facilityId={facilityId} />
              )}
            </div>
          ) : (
            <Tabs value={assessSub} onValueChange={(v) => setAssessSub(v as typeof assessSub)}>
              <TabsList className="bg-emerald-50/80 border border-emerald-100 rounded-lg p-1 w-full sm:w-auto">
                <TabsTrigger value="devices" className={tabTriggerClass}>
                  Devices &amp; loads
                </TabsTrigger>
                <TabsTrigger value="operations" className={tabTriggerClass}>
                  Operational efficiency
                </TabsTrigger>
                {!isEnergyOnly && (
                  <TabsTrigger value="climate" className={tabTriggerClass}>
                    Climate readiness
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="devices" className="mt-4">
                <AfyaSolarSizingTool
                  key={assessmentCycleId ?? "no-cycle"}
                  packages={packages}
                  onSizingSummaryChange={onSizingSummaryChange}
                  onMeuSummaryChange={onMeuSummaryChange}
                  onFacilityContextChange={setFacilityCtx}
                  facilityId={facilityId}
                  facilityName={facilityName}
                  assessmentCycleId={assessmentCycleId ?? undefined}
                  persistedSizingData={energySnapshot?.sizingData}
                  readOnly={assessmentReadOnly}
                />
              </TabsContent>
              <TabsContent value="operations" className="mt-4">
                <FourPointAssessment
                  key={assessmentCycleId ?? "no-cycle"}
                  onScoreChange={onBmiSummaryChange}
                  onSectionScoresChange={onSectionScoresChange}
                  assessmentCycleId={assessmentCycleId ?? undefined}
                  initialOperationsData={
                    energySnapshot?.operationsData && typeof energySnapshot.operationsData === "object"
                      ? (energySnapshot.operationsData as any)
                      : null
                  }
                  readOnly={assessmentReadOnly}
                />
              </TabsContent>
              <TabsContent value="climate" className="mt-4">
                {facilityId ? (
                  <div className="space-y-4">
                    <ClimateResilienceAssessment
                      facilityId={facilityId}
                      assessmentCycleId={assessmentCycleId ?? undefined}
                      onCapacityScoreChange={(score) => setClimateResilienceScore(score)}
                      readOnly={assessmentReadOnly}
                    />
                    <Card className="border-emerald-100">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Existing climate dashboard (seeded)</CardTitle>
                        <CardDescription className="text-xs">
                          Hazard radar + adaptation tracker based on seeded profile. The guided assessment above will
                          become the primary input source as we connect persistence.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <FacilityClimateResilienceDashboard facilityId={facilityId} />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <FacilityClimateResilienceDashboard facilityId={facilityId} />
                )}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="analyze" className="mt-4">
          <div className="space-y-4">
            <IntelligenceChartGrid
              meu={meuSummary}
              sizing={sizingSummary}
              facilityExtras={facilityCtx ?? undefined}
              resilienceScore={climateResilienceScore}
              recommendations={recommendations}
              bmiTrend={bmiTrend}
            />
            {!isClimateOnly && (
              <FacilityMeterEfficiencyDashboard facilityId={facilityId} preferMock={false} />
            )}
            {!isEnergyOnly && (
              <Card className="border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-sm">Climate resilience &amp; adaptation</CardTitle>
                  <CardDescription className="text-xs">
                    Hazard exposure, resilience trend, and adaptation plan tracking — integrated in the same workflow.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FacilityClimateResilienceDashboard facilityId={facilityId} />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="action" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Ranked recommendations with explainability. Owners and due dates are saved to your assessment cycle.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              loading={actionPlanStatus === "saving"}
              disabled={!assessmentCycleId || assessmentReadOnly}
              onClick={async () => {
                if (!assessmentCycleId || assessmentReadOnly) return
                setActionPlanStatus("saving")
                try {
                  const putRes = await fetch(`/api/assessment-cycles/${assessmentCycleId}/action-plan`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      recommendations: recommendations.map((r) => ({
                        id: r.id,
                        moduleSource: r.moduleSource,
                        title: r.title,
                        description: r.action,
                        priority: r.priority,
                        horizon: r.horizon,
                        ownerType: "facility",
                        evidenceRequired: false,
                        explanation: `${r.issue} — ${r.whyItMatters}`,
                      })),
                    }),
                  })
                  if (!putRes.ok) {
                    const errBody = await putRes.json().catch(() => ({}))
                    throw new Error((errBody as { error?: string }).error || "Failed to save recommendations")
                  }

                  const tasks = recommendations
                    .map((r) => ({
                      recommendationId: r.id,
                      ownerName: actionMeta[r.id]?.owner,
                      dueDate: actionMeta[r.id]?.dueDate,
                      status: actionMeta[r.id]?.owner || actionMeta[r.id]?.dueDate ? "open" : undefined,
                    }))
                    .filter((t) => Boolean(t.ownerName || t.dueDate))

                  if (tasks.length > 0) {
                    const postRes = await fetch(`/api/assessment-cycles/${assessmentCycleId}/action-plan`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tasks }),
                    })
                    if (!postRes.ok) {
                      const errBody = await postRes.json().catch(() => ({}))
                      throw new Error((errBody as { error?: string }).error || "Failed to save tasks")
                    }
                  }

                  setActionPlanStatus("saved")
                  notifySuccess("Action plan saved", "Recommendations and tasks are stored for this assessment cycle.")
                  setTimeout(() => setActionPlanStatus("idle"), 1500)
                } catch (e) {
                  setActionPlanStatus("error")
                  notifyError("Could not save action plan", getErrorMessage(e))
                  setTimeout(() => setActionPlanStatus("idle"), 2500)
                }
              }}
            >
              {actionPlanStatus === "saving"
                ? "Saving…"
                : actionPlanStatus === "saved"
                  ? "Saved"
                  : actionPlanStatus === "error"
                    ? "Error"
                    : "Save action plan"}
            </Button>
            {!assessmentCycleId && (
              <span className="text-xs text-muted-foreground">Sign in as a facility to save.</span>
            )}
          </div>
          {recommendations.map((r) => (
            <Card key={r.id} className="border-emerald-100">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {r.horizon}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-900">
                      {r.moduleSource}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium text-emerald-900">Issue: </span>
                  {r.issue}
                </p>
                <p>
                  <span className="font-medium text-emerald-900">Why it matters: </span>
                  {r.whyItMatters}
                </p>
                <p>
                  <span className="font-medium text-emerald-900">Recommended action: </span>
                  {r.action}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-emerald-800">Expected impact: </span>
                  {r.expectedImpact}
                </p>
                <div className="grid gap-3 pt-2 border-t border-emerald-50 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Owner</Label>
                    <Input
                      value={actionMeta[r.id]?.owner ?? ""}
                      placeholder="e.g. Facility manager"
                      disabled={assessmentReadOnly}
                      onChange={(e) =>
                        setActionMeta((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], owner: e.target.value },
                        }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due date</Label>
                    <Input
                      type="date"
                      value={actionMeta[r.id]?.dueDate ?? ""}
                      disabled={assessmentReadOnly}
                      onChange={(e) =>
                        setActionMeta((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], dueDate: e.target.value },
                        }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          {/* Executive summary strip (v2.0) */}
          {isClimateOnly ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Resilience capacity (RCS)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {persistedClimateScore?.rcs ?? (climateResilienceScore !== null ? climateResilienceScore : "—")}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Tier &amp; attention</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {persistedClimateScore ? `Tier ${persistedClimateScore.tier}` : "—"}
                  </CardTitle>
                  {persistedClimateScore?.criticalAttention && (
                    <p className="text-[11px] text-amber-800 font-medium">Critical attention</p>
                  )}
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Risk drivers (saved)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">{persistedTopRisks.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Operational BMI (if captured)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {efficiencyScore !== null ? `${efficiencyScore}%` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          ) : isEnergyOnly ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-emerald-100 lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Total daily energy</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? `${sizingSummary.totalDailyLoad.toFixed(1)} kWh/d` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Indicative solar</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? `${sizingSummary.solarArraySize.toFixed(1)} kW` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Annual savings</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? formatCurrency(sizingSummary.annualSavings) : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Efficiency score (BMI)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {efficiencyScore !== null ? `${efficiencyScore}%` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Card className="border-emerald-100 lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Total daily energy</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? `${sizingSummary.totalDailyLoad.toFixed(1)} kWh/d` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Indicative solar</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? `${sizingSummary.solarArraySize.toFixed(1)} kW` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Annual savings</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {sizingSummary ? formatCurrency(sizingSummary.annualSavings) : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Resilience status</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {persistedClimateScore?.rcs ?? (climateResilienceScore !== null ? climateResilienceScore : "—")}
                  </CardTitle>
                  {persistedClimateScore && (
                    <p className="text-[11px] text-muted-foreground">
                      Tier {persistedClimateScore.tier}
                      {persistedClimateScore.criticalAttention ? " · Critical attention" : ""}
                    </p>
                  )}
                </CardHeader>
              </Card>
              <Card className="border-emerald-100">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Efficiency score (BMI)</CardDescription>
                  <CardTitle className="text-2xl text-emerald-900">
                    {efficiencyScore !== null ? `${efficiencyScore}%` : "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          <Card className="border-emerald-100">
            <CardHeader>
              <CardTitle className="text-base">Executive summary</CardTitle>
              <CardDescription className="text-xs">Text snapshot — pair with charts in Analyze and PDF from design engine</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              {sizingSummary && (
                <p>
                  Estimated demand <span className="font-semibold">{sizingSummary.totalDailyLoad.toFixed(1)} kWh/day</span>
                  , indicative PV <span className="font-semibold">{sizingSummary.solarArraySize.toFixed(1)} kW</span>,
                  annual savings (model){" "}
                  <span className="font-semibold">{formatCurrency(sizingSummary.annualSavings)}</span>.
                </p>
              )}
              {meuSummary && meuSummary.totalDailyLoad > 0 && (
                <p>
                  Peak (all-on) ≈ <span className="font-semibold">{meuSummary.peakLoadKw.toFixed(2)} kW</span>. Critical +
                  essential loads ≈{" "}
                  <span className="font-semibold">
                    {(meuSummary.criticalityBreakdown.critical + meuSummary.criticalityBreakdown.essential).toFixed(1)}{" "}
                    kWh/day
                  </span>
                  .
                </p>
              )}
              {bmiSummary != null && bmiSummary.score !== null && (
                <p>
                  Operational BMI <span className="font-semibold">{bmiSummary.score}/40</span>
                  {bmiSummary.bmiPercent !== null && ` (${bmiSummary.bmiPercent}%)`}.
                </p>
              )}
              {!sizingSummary && !meuSummary?.totalDailyLoad && (
                <p className="text-muted-foreground">Complete the Assess tab to populate this report.</p>
              )}
            </CardContent>
          </Card>

          {!isEnergyOnly &&
            (isClimateOnly || persistedTopRisks.length > 0 || persistedTasks.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-base">Top climate risk drivers (saved)</CardTitle>
                  <CardDescription className="text-xs">From your persisted climate assessment scoring.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {persistedTopRisks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No saved climate risk drivers yet.</p>
                  ) : (
                    persistedTopRisks.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-50 bg-white px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-emerald-950 truncate">
                            {r.rank ? `${r.rank}. ` : ""}{r.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{r.riskType}</p>
                        </div>
                        <Badge variant="outline" className="border-amber-200 text-amber-900">
                          {Number(r.severity ?? 0)}%
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-emerald-100">
                <CardHeader>
                  <CardTitle className="text-base">Assigned tasks (saved)</CardTitle>
                  <CardDescription className="text-xs">Owners and due dates saved from your Action plan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {persistedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No saved tasks yet. Assign owners in Action plan and save.</p>
                  ) : (
                    persistedTasks.slice(0, 8).map((t) => (
                      <div key={t.id} className="rounded-lg border border-emerald-50 bg-white px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-emerald-950">
                            {t.ownerName ? t.ownerName : "Unassigned"}
                          </span>
                          <Badge variant="outline" className="border-slate-200 text-slate-700 text-[10px]">
                            {t.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Due: {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"} · Rec: {t.recommendationId}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <IntelligenceChartGrid
            meu={meuSummary}
            sizing={sizingSummary}
            facilityExtras={facilityCtx ?? undefined}
            resilienceScore={persistedClimateScore?.rcs ?? climateResilienceScore}
            recommendations={recommendations}
            bmiTrend={bmiTrend}
          />
          <Card className="border-emerald-100">
            <CardHeader>
              <CardTitle className="text-base">What to do next</CardTitle>
              <CardDescription className="text-xs">Turn insights into assigned, trackable actions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onNavigate("action")}>
                Assign owners &amp; due dates
              </Button>
              <Button size="sm" variant="outline" className="border-emerald-200" onClick={() => onNavigate("assess")}>
                Update assessment inputs
              </Button>
              <Button size="sm" variant="outline" className="border-emerald-200" onClick={() => window.print()}>
                Export / Print
              </Button>
            </CardContent>
          </Card>
          {!isClimateOnly && (
            <p className="text-[11px] text-muted-foreground">
              For a full engineering PDF including financing, run <span className="font-semibold">Run Design &amp; Finance Engine</span>{" "}
              under Devices &amp; loads, then download PDF from the cost summary.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={reassessDialogOpen} onOpenChange={setReassessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the current cycle as saved, then opens a new one for updated entries. You can always switch back
              to older data using &quot;View data for&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => void handleReassessConfirm()}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
