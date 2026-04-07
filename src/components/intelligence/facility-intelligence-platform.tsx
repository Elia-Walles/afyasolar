"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AfyaSolarSizingTool,
  type SizingSummary,
  type MeuSummary,
  type FacilityContextSnapshot,
  type RecommendedPackageInput,
} from "@/components/solar/afya-solar-sizing-tool"
import { FourPointAssessment } from "@/components/solar/four-point-assessment"
import { IntelligenceChartGrid } from "@/components/intelligence/energy-charts"
import { FacilityClimateResilienceDashboard } from "@/components/efficiency/facility-climate-resilience-dashboard"
import { buildIntelligenceRecommendations, type SectionScores } from "@/lib/intelligence/recommendations"
import { formatCurrency } from "@/lib/utils"
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Sparkles,
} from "lucide-react"

type IntelTab = "overview" | "assess" | "analyze" | "action" | "reports"

const tabTriggerClass =
  "text-xs sm:text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm"

interface FacilityIntelligencePlatformProps {
  facilityId?: string
  facilityName?: string
  packages?: RecommendedPackageInput[]
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
  sizingSummary,
  meuSummary,
  bmiSummary,
  sectionScores,
  onSizingSummaryChange,
  onMeuSummaryChange,
  onBmiSummaryChange,
  onSectionScoresChange,
}: FacilityIntelligencePlatformProps) {
  const [mainTab, setMainTab] = useState<IntelTab>("overview")
  const [assessSub, setAssessSub] = useState<"devices" | "operations" | "climate">("devices")
  const [facilityCtx, setFacilityCtx] = useState<FacilityContextSnapshot | null>(null)
  const [climateResilienceScore, setClimateResilienceScore] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!facilityId) {
      setClimateResilienceScore(null)
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`/api/facility/${facilityId}/climate-resilience`)
        const json = await res.json()
        if (
          !cancelled &&
          json?.data?.profile?.overallResilienceScore !== undefined &&
          json?.data?.profile?.overallResilienceScore !== null
        ) {
          setClimateResilienceScore(Number(json.data.profile.overallResilienceScore))
        }
      } catch {
        if (!cancelled) setClimateResilienceScore(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [facilityId])

  const recommendations = useMemo(
    () => buildIntelligenceRecommendations(sizingSummary, meuSummary, bmiSummary, sectionScores),
    [sizingSummary, meuSummary, bmiSummary, sectionScores]
  )

  const assessProgress = useMemo(() => {
    let done = 0
    const total = 3
    if (meuSummary && meuSummary.totalDailyLoad > 0) done++
    if (bmiSummary != null && bmiSummary.score !== null) done++
    if (climateResilienceScore !== null) done++
    return Math.round((done / total) * 100)
  }, [meuSummary, bmiSummary, climateResilienceScore])

  const efficiencyScore = bmiSummary?.bmiPercent ?? null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              AfyaSolar Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-emerald-900/80 max-w-2xl">
              Guided assessment, analysis, and actions in one workflow. Energy, meter efficiency, and climate resilience
              scoring are integrated below.
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto gap-1 rounded-xl bg-emerald-50/80 p-1 border border-emerald-100">
          <TabsTrigger value="overview" className={tabTriggerClass}>
            <LayoutDashboard className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="assess" className={tabTriggerClass}>
            <ClipboardList className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Assess
          </TabsTrigger>
          <TabsTrigger value="analyze" className={tabTriggerClass}>
            <LineChart className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="action" className={tabTriggerClass}>
            <ListChecks className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Action plan
          </TabsTrigger>
          <TabsTrigger value="reports" className={`${tabTriggerClass} col-span-2 sm:col-span-1`}>
            <Activity className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
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
            <Card className="border-emerald-100">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Assessment progress</CardDescription>
                <CardTitle className="text-2xl text-emerald-900">{assessProgress}%</CardTitle>
                <Progress value={assessProgress} className="h-2 mt-2 bg-emerald-100" />
              </CardHeader>
            </Card>
          </div>

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
                <CardTitle className="text-sm">Energy–resilience snapshot</CardTitle>
                <CardDescription className="text-xs">
                  BMI {efficiencyScore !== null ? `${efficiencyScore}%` : "—"} · Resilience{" "}
                  {climateResilienceScore !== null ? climateResilienceScore : "—"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Use <span className="font-medium text-emerald-900">Energy Efficiency</span> for meter-based yield vs
                  expected, and <span className="font-medium text-emerald-900">Climate readiness</span> for hazards and
                  adaptation tracking.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setMainTab("assess")}>
              Continue assessment
            </Button>
            <Button size="sm" variant="outline" className="border-emerald-200" onClick={() => setMainTab("analyze")}>
              View charts
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="assess" className="space-y-4 mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-emerald-900/90">
              Step through devices, operational practice, then climate readiness.
            </p>
            <Progress value={assessProgress} className="h-2 w-full sm:w-48 bg-emerald-100" />
          </div>
          <Tabs value={assessSub} onValueChange={(v) => setAssessSub(v as typeof assessSub)}>
            <TabsList className="bg-emerald-50/80 border border-emerald-100 rounded-lg p-1 w-full sm:w-auto">
              <TabsTrigger value="devices" className={tabTriggerClass}>
                Devices &amp; loads
              </TabsTrigger>
              <TabsTrigger value="operations" className={tabTriggerClass}>
                Operational efficiency
              </TabsTrigger>
              <TabsTrigger value="climate" className={tabTriggerClass}>
                Climate readiness
              </TabsTrigger>
            </TabsList>
            <TabsContent value="devices" className="mt-4">
              <AfyaSolarSizingTool
                packages={packages}
                onSizingSummaryChange={onSizingSummaryChange}
                onMeuSummaryChange={onMeuSummaryChange}
                onFacilityContextChange={setFacilityCtx}
                facilityId={facilityId}
                facilityName={facilityName}
              />
            </TabsContent>
            <TabsContent value="operations" className="mt-4">
              <FourPointAssessment onScoreChange={onBmiSummaryChange} onSectionScoresChange={onSectionScoresChange} />
            </TabsContent>
            <TabsContent value="climate" className="mt-4">
              <FacilityClimateResilienceDashboard facilityId={facilityId} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="analyze" className="mt-4">
          <IntelligenceChartGrid meu={meuSummary} sizing={sizingSummary} facilityExtras={facilityCtx ?? undefined} />
        </TabsContent>

        <TabsContent value="action" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Ranked recommendations with explainability. Assign owners and dates in a future task workflow.
          </p>
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
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
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
          <IntelligenceChartGrid meu={meuSummary} sizing={sizingSummary} facilityExtras={facilityCtx ?? undefined} />
          <p className="text-[11px] text-muted-foreground">
            For a full engineering PDF including financing, run <span className="font-semibold">Run Design &amp; Finance Engine</span>{" "}
            under Devices &amp; loads, then download PDF from the cost summary.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
