import type { MeuSummary } from "@/components/solar/afya-solar-sizing-tool"
import {
  extractBmiFromOperationsData,
  extractClimateScore,
  extractMeuSummaryFromSizingData,
  extractSizingSummaryFromSizingData,
} from "@/lib/assessment-cycle-overview-metrics"

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v != null && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export type CycleEnergyApi = {
  sizingData: unknown
  operationsData: unknown
  bmiTrendJson: unknown
  updatedAt: string | null
}

function parseMeuForCharts(raw: unknown): MeuSummary | null {
  if (!raw || typeof raw !== "object") return null
  const m = raw as Partial<MeuSummary>
  if (!Array.isArray(m.topDevices) || !Array.isArray(m.categoryBreakdown)) return null
  if (typeof m.totalDailyLoad !== "number") return null
  if (!m.criticalityBreakdown || typeof m.criticalityBreakdown !== "object") return null
  return m as MeuSummary
}

export function parseBmiTrendJson(raw: unknown): { date: string; value: number }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      const o = asRecord(p)
      if (!o) return null
      const date = typeof o.date === "string" ? o.date : null
      const value = num(o.value)
      if (!date || value == null) return null
      return { date, value }
    })
    .filter((x): x is { date: string; value: number } => x != null)
}

/**
 * Merge `assessment_cycle_energy_state` with `facility_energy_assessments.payload`
 * for admin Energy tab cards (matches facility dashboard / design quote fields).
 */
export function buildEnergyTabModel(input: {
  cycleEnergy: CycleEnergyApi | null | undefined
  reportPayload: unknown
}) {
  const p = asRecord(input.reportPayload)
  const quote = asRecord(p?.quoteData)
  const load = asRecord(quote?.load_analysis)
  const cycleSizing = asRecord(input.cycleEnergy?.sizingData)

  const sizingFromCycle = extractSizingSummaryFromSizingData(input.cycleEnergy?.sizingData)
  const sizingFromReport = asRecord(p?.sizingSummary)
  const meuSummaryFlat = asRecord(p?.meuSummary)

  const dailyLoadKwh =
    num(load?.total_daily_energy_kwh) ??
    num(sizingFromReport?.totalDailyLoad) ??
    num(meuSummaryFlat?.totalDailyLoad) ??
    sizingFromCycle?.totalDailyLoad ??
    extractMeuSummaryFromSizingData(input.cycleEnergy?.sizingData)?.totalDailyLoad ??
    null

  const qc = asRecord(quote?.current_energy_cost)
  const qa = asRecord(quote?.after_solar_cost)
  const qm = asRecord(quote?.monthly_savings)

  const baselineMonthly = num(qc?.total_baseline_cost_monthly_tzs)
  const afterSolarMonthly = num(qa?.total_cost_after_solar_monthly_tzs)
  const savingsFromQuote = num(qm?.gross_monthly_savings_tzs)
  const savingsMonthly =
    savingsFromQuote ??
    (baselineMonthly != null && afterSolarMonthly != null ? Math.max(0, baselineMonthly - afterSolarMonthly) : null)

  const gridBaseline = num(qc?.grid_cost_monthly_tzs)
  const dieselBaseline = num(qc?.diesel_cost_monthly_tzs)

  const solarFromReport = num(p?.solarOffset)
  const solarFromCycle = num(cycleSizing?.solarOffset)
  const solarRaw = solarFromReport ?? solarFromCycle
  const solarOffsetPercent =
    solarRaw != null ? Math.round(solarRaw <= 1 ? solarRaw * 100 : Math.min(100, solarRaw)) : null

  const operationsMerged = input.cycleEnergy?.operationsData ?? p?.operationsData
  const bmi = extractBmiFromOperationsData(operationsMerged)

  const meuFromReport = parseMeuForCharts(p?.meuSummary)
  const meuFromCycleSizing = parseMeuForCharts(asRecord(input.cycleEnergy?.sizingData)?.meuSummary)
  const meuForCharts = meuFromReport ?? meuFromCycleSizing

  const bmiTrend = parseBmiTrendJson(input.cycleEnergy?.bmiTrendJson ?? p?.bmiTrendJson)

  const hasCycleRow =
    Boolean(input.cycleEnergy) &&
    Boolean(
      input.cycleEnergy?.sizingData != null ||
        input.cycleEnergy?.operationsData != null ||
        input.cycleEnergy?.bmiTrendJson != null
    )
  const hasReportPayload = Boolean(p && Object.keys(p).length > 0)
  const hasEnergyData = hasCycleRow || hasReportPayload
  const hasQuoteData = Boolean(quote && Object.keys(quote).length > 0)

  return {
    dailyLoadKwh,
    energyScorePercent: bmi?.bmiPercent ?? null,
    bmiRawOutOf40: bmi?.rawScore ?? null,
    bmiPercent: bmi?.bmiPercent ?? null,
    baselineMonthly,
    afterSolarMonthly,
    savingsMonthly,
    gridBaseline,
    dieselBaseline,
    solarOffsetPercent,
    meuForCharts,
    bmiTrend,
    hasEnergyData,
    hasQuoteData,
    missingCostHint: hasEnergyData && !hasQuoteData,
  }
}

export type ClimateApiShape = {
  score: Record<string, unknown> | null
  responses: Array<Record<string, unknown>>
  evidence: Array<Record<string, unknown>>
  topRisks: Array<Record<string, unknown>>
}

function countRedFlagsFromResponses(responses: Array<Record<string, unknown>>) {
  let n = 0
  for (const r of responses) {
    if (r.isRedFlag === true || r.isRedFlag === 1) n++
    const av = String(r.answerValue ?? "").toLowerCase()
    if (av === "red" || av === "yes_red" || av === "critical_yes") n++
  }
  return n
}

export function buildClimateTabModel(input: { climateApi: ClimateApiShape; reportPayload: unknown }) {
  const score = extractClimateScore(input.climateApi.score)
  const payload = asRecord(input.reportPayload)
  const payloadResponses = Array.isArray(payload?.responses)
    ? (payload.responses as Array<Record<string, unknown>>)
    : []
  const responses = input.climateApi.responses?.length ? input.climateApi.responses : payloadResponses
  const evidence = input.climateApi.evidence ?? []
  const topRisks = input.climateApi.topRisks ?? []

  const redFlags = countRedFlagsFromResponses(responses)
  const evidenceCoveragePct =
    responses.length > 0 ? Math.min(100, Math.round((evidence.length / responses.length) * 100)) : 0

  const top = topRisks[0] as Record<string, unknown> | undefined
  const topRiskTitle = top && typeof top.title === "string" ? top.title : "—"
  const topRiskSeverity = num(top?.severity)

  const avgRiskSeverity =
    topRisks.length > 0
      ? Math.round(
          topRisks.reduce((s, r) => s + (num((r as Record<string, unknown>).severity) ?? 0), 0) / topRisks.length
        )
      : null

  const hasNormalized =
    Boolean(input.climateApi.score) || responses.length > 0 || evidence.length > 0 || topRisks.length > 0
  const hasPayload = Boolean(payload && Object.keys(payload).length > 0)
  const hasClimateData = hasNormalized || hasPayload

  return {
    score,
    responsesCount: responses.length,
    evidenceCount: evidence.length,
    riskDriversCount: topRisks.length,
    redFlags,
    evidenceCoveragePct,
    topRiskTitle,
    topRiskSeverity,
    avgRiskSeverity,
    hasClimateData,
  }
}
