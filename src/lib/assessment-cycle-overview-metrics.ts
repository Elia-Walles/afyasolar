/**
 * Read persisted assessment JSON from `assessment_cycle_energy_state` (sizing_data JSON)
 * and normalized climate score rows. Shapes align with Afya Solar sizing tool +
 * facility intelligence overview cards.
 */

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v != null && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

/** `sizing_data` JSON: expects `sizingSummary` object (see AfyaSolarSizingTool). */
export function extractSizingSummaryFromSizingData(sizingData: unknown) {
  const root = asRecord(sizingData)
  if (!root) return null
  const s = asRecord(root.sizingSummary)
  if (!s) return null
  return {
    totalDailyLoad: num(s.totalDailyLoad),
    solarArraySize: num(s.solarArraySize),
    annualGridCost: num(s.annualGridCost),
    annualDieselCost: num(s.annualDieselCost),
    annualSavings: num(s.annualSavings),
    remainingEnergyCost: num(s.remainingEnergyCost),
    requiredKw: num(s.requiredKw),
    maxPackageKw: num(s.maxPackageKw),
    recommendedPackageName: str(s.recommendedPackageName),
    recommendedPackageKw: num(s.recommendedPackageKw),
  }
}

/** `sizing_data` JSON: optional `meuSummary` (MEU / device rollup). */
export function extractMeuSummaryFromSizingData(sizingData: unknown) {
  const root = asRecord(sizingData)
  if (!root) return null
  const m = asRecord(root.meuSummary)
  if (!m) return null
  const crit = asRecord(m.criticalityBreakdown)
  return {
    totalDailyLoad: num(m.totalDailyLoad),
    peakLoadKw: num(m.peakLoadKw),
    criticalLoads: num(crit?.critical),
    essentialLoads: num(crit?.essential),
    nonEssentialLoads: num(crit?.nonEssential),
    topDeviceCount: Array.isArray(m.topDevices) ? m.topDevices.length : 0,
  }
}

export function extractBmiFromOperationsData(operationsData: unknown) {
  const o = asRecord(operationsData)
  if (!o) return null
  const raw = num(o.assessmentScore)
  if (raw == null) return null
  return { rawScore: raw, bmiPercent: Math.round((raw / 40) * 100) }
}

/** Row from `climate_score_summaries` (camelCase from Drizzle). */
export function extractClimateScore(score: unknown) {
  const s = asRecord(score)
  if (!s) return null
  return {
    hes: num(s.hes),
    csf: num(s.csf),
    ecpq: num(s.ecpq),
    edc: num(s.edc),
    rrc: num(s.rrc),
    rcs: num(s.rcs),
    tier: num(s.tier),
    criticalAttention: Boolean(s.criticalAttention),
  }
}
