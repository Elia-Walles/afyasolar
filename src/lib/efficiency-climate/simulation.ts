/**
 * Deterministic mock data from facilityId (+ optional capacity) for demos without live customers.
 */

export function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function pseudoRandom(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export type SimulatedEfficiencyDay = {
  snapshotDate: string
  producedKwh: number
  consumedKwh: number
  expectedKwh: number
  avgIrradianceWm2: number
  performanceRatio: number
  degradationYearlyPct: number
  efficiencyPct: number
  underperforming: boolean
  billingNote: string
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Typical daily expected AC energy (kWh) from DC kWp and PR (simplified site model). */
export function expectedDailyKwh(capacityKw: number, dayOfYear: number, seed: number): number {
  const seasonal = 0.85 + 0.15 * Math.sin(((dayOfYear - 80) / 365) * Math.PI * 2)
  const pr = 0.74 + pseudoRandom(seed, dayOfYear) * 0.08
  const peakSunHours = 4.2 * seasonal
  return Math.round(capacityKw * peakSunHours * pr * 1000) / 1000
}

export function simulateEfficiencySeries(
  facilityId: string,
  days: number,
  solarCapacityKw = 5
): SimulatedEfficiencyDay[] {
  const seed = hashSeed(facilityId)
  const out: SimulatedEfficiencyDay[] = []
  const now = new Date()
  const degradationYearlyPct = 0.35 + (seed % 7) / 10

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const ymd = formatYmd(d)
    const doy = Math.floor((d.getTime() - new Date(d.getUTCFullYear(), 0, 0).getTime()) / 86400000)

    const expected = expectedDailyKwh(solarCapacityKw, doy, seed + i)
    const weatherNoise = 0.88 + pseudoRandom(seed, i * 31) * 0.22
    const faultSpike = pseudoRandom(seed, i * 17) < 0.08 ? 0.65 + pseudoRandom(seed, i) * 0.15 : 1
    const produced = Math.round(expected * weatherNoise * faultSpike * 1000) / 1000
    const consumed = Math.round(produced * (0.72 + pseudoRandom(seed, i * 99) * 0.35) * 1000) / 1000
    const irr = Math.round((650 + pseudoRandom(seed, i * 5) * 280) * weatherNoise)
    const pr = Math.min(100, Math.round((produced / Math.max(expected, 0.01)) * 78 * 100) / 100)
    const eff = Math.min(100, Math.round((produced / Math.max(consumed, 0.01)) * 100 * 100) / 100)
    const ratio = produced / Math.max(expected, 0.01)
    const underperforming = ratio < 0.82

    out.push({
      snapshotDate: ymd,
      producedKwh: produced,
      consumedKwh: consumed,
      expectedKwh: expected,
      avgIrradianceWm2: irr,
      performanceRatio: pr,
      degradationYearlyPct,
      efficiencyPct: eff,
      underperforming,
      billingNote: underperforming
        ? "Output below expected yield; review inverter logs and shading. Billing may be adjusted per your plan if SLA applies."
        : "System within expected performance band.",
    })
  }
  return out
}

export type SimulatedClimateProfile = {
  floodRiskScore: number
  heatRiskScore: number
  windRiskScore: number
  rainRiskScore: number
  overallResilienceScore: number
  latitude: number
  longitude: number
}

export function simulateClimateProfile(facilityId: string, regionHint?: string | null): SimulatedClimateProfile {
  const seed = hashSeed(facilityId + (regionHint || ""))
  const flood = Math.round(15 + pseudoRandom(seed, 1) * 70)
  const heat = Math.round(20 + pseudoRandom(seed, 2) * 65)
  const wind = Math.round(10 + pseudoRandom(seed, 3) * 55)
  const rain = Math.round(18 + pseudoRandom(seed, 4) * 62)
  const hazardAvg = (flood + heat + wind + rain) / 4
  const overall = Math.max(0, Math.min(100, Math.round(100 - hazardAvg * 0.65 + (seed % 12))))
  const lat = -6.8 - pseudoRandom(seed, 10) * 4
  const lng = 35.5 + pseudoRandom(seed, 11) * 6
  return {
    floodRiskScore: flood,
    heatRiskScore: heat,
    windRiskScore: wind,
    rainRiskScore: rain,
    overallResilienceScore: overall,
    latitude: Math.round(lat * 1000000) / 1000000,
    longitude: Math.round(lng * 1000000) / 1000000,
  }
}

export type AdaptationTemplate = {
  riskCategory: string
  recommendation: string
}

export function defaultAdaptationsForProfile(p: SimulatedClimateProfile): AdaptationTemplate[] {
  const list: AdaptationTemplate[] = []
  if (p.floodRiskScore >= 40) {
    list.push({
      riskCategory: "flood",
      recommendation:
        "Elevate inverter and battery bank above historical flood line; use sealed cable glands and inspect drainage annually.",
    })
  }
  if (p.heatRiskScore >= 40) {
    list.push({
      riskCategory: "heat",
      recommendation:
        "Improve inverter/charge-controller ventilation; add reflective roof coating or shading where safe; monitor derating.",
    })
  }
  if (p.windRiskScore >= 35) {
    list.push({
      riskCategory: "wind",
      recommendation:
        "Reinforce panel mounting rails and torque checks; inspect roof anchors after storm season.",
    })
  }
  if (p.rainRiskScore >= 42) {
    list.push({
      riskCategory: "heavy_rain",
      recommendation:
        "Verify waterproofing on DC combiner boxes; clear gutters to prevent water ingress to electrical rooms.",
    })
  }
  if (list.length === 0) {
    list.push({
      riskCategory: "general",
      recommendation: "Maintain quarterly thermography and torque checks; keep vegetation clear of arrays.",
    })
  }
  return list
}

export function simulateResilienceTrend(
  facilityId: string,
  months: number,
  completionPct: number
): { periodMonth: string; resilienceScore: number; adaptationCompletionPct: number }[] {
  const seed = hashSeed(facilityId)
  const out: { periodMonth: string; resilienceScore: number; adaptationCompletionPct: number }[] = []
  const now = new Date()
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1))
    const periodMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    const progress = Math.min(100, completionPct * (1 - m / Math.max(months, 1)))
    const base = 52 + (seed % 25)
    const uplift = (progress / 100) * 22
    const noise = pseudoRandom(seed, m + 50) * 6
    out.push({
      periodMonth,
      resilienceScore: Math.round(Math.min(98, base + uplift + noise)),
      adaptationCompletionPct: Math.round(progress),
    })
  }
  return out
}
