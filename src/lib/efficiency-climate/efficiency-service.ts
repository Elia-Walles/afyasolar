import { and, desc, eq, gte, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { devices, energyData, facilityEfficiencyDaily } from "@/lib/db/schema"
import { ensureEfficiencyClimateTables } from "@/lib/db/ensure-efficiency-climate-tables"
import {
  simulateEfficiencySeries,
  type SimulatedEfficiencyDay,
} from "@/lib/efficiency-climate/simulation"
import {
  billingContextForEfficiency,
  getFacilityPaymentModel,
  type NormalizedPaymentModel,
} from "@/lib/efficiency-climate/payment-model"
import { maybeNotifyEnergyUnderperformance } from "@/lib/efficiency-climate/notify-efficiency"

export type EfficiencyDayPayload = {
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
  dataSource: "meter" | "simulated" | "hybrid"
}

export type EfficiencyPerformancePayload = {
  facilityId: string
  paymentModel: NormalizedPaymentModel
  billingContext: string
  source: "db" | "simulated" | "hybrid"
  days: number
  summary: {
    avgEfficiencyPct: number
    avgPerformanceRatio: number
    underperformingDays: number
    latestUnderperforming: boolean
    avgProducedKwh: number
    avgExpectedKwh: number
  }
  daily: EfficiencyDayPayload[]
  alerts: { level: "warning" | "critical"; message: string; date?: string }[]
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function aggregateEnergyByDay(
  rows: { timestamp: Date; solarGeneration: string | null; energy: string | null }[]
): Map<string, { produced: number; consumed: number }> {
  const map = new Map<string, { produced: number; consumed: number }>()
  for (const r of rows) {
    const day = toDay(new Date(r.timestamp))
    const sg = Number(r.solarGeneration) || 0
    const e = Number(r.energy) || 0
    const cur = map.get(day) || { produced: 0, consumed: 0 }
    cur.produced += sg
    cur.consumed += e
    map.set(day, cur)
  }
  return map
}

function simToPayload(
  row: SimulatedEfficiencyDay,
  paymentModel: NormalizedPaymentModel,
  dataSource: EfficiencyDayPayload["dataSource"]
): EfficiencyDayPayload {
  const billingNote =
    row.underperforming && row.billingNote
      ? row.billingNote
      : billingContextForEfficiency(paymentModel, row.underperforming)
  return {
    snapshotDate: row.snapshotDate,
    producedKwh: row.producedKwh,
    consumedKwh: row.consumedKwh,
    expectedKwh: row.expectedKwh,
    avgIrradianceWm2: row.avgIrradianceWm2,
    performanceRatio: row.performanceRatio,
    degradationYearlyPct: row.degradationYearlyPct,
    efficiencyPct: row.efficiencyPct,
    underperforming: row.underperforming,
    billingNote,
    dataSource,
  }
}

export async function buildEfficiencyPerformancePayload(
  facilityId: string,
  options: {
    days?: number
    forceMock?: boolean
    solarCapacityKw?: number
    evaluateAlerts?: boolean
  } = {}
): Promise<EfficiencyPerformancePayload> {
  const days = Math.min(90, Math.max(7, options.days ?? 30))
  const solarCapacityKw = options.solarCapacityKw ?? 5

  await ensureEfficiencyClimateTables()

  const paymentModel = await getFacilityPaymentModel(facilityId)
  const simulated = simulateEfficiencySeries(facilityId, days, solarCapacityKw)
  const simByDate = new Map(simulated.map((s) => [s.snapshotDate, s]))

  const now = new Date()
  const start = new Date(now.getTime() - days * 86400000)

  let dbRows: (typeof facilityEfficiencyDaily.$inferSelect)[] = []
  try {
    dbRows = await db
      .select()
      .from(facilityEfficiencyDaily)
      .where(
        and(eq(facilityEfficiencyDaily.facilityId, facilityId), gte(facilityEfficiencyDaily.snapshotDate, toDay(start)))
      )
      .orderBy(desc(facilityEfficiencyDaily.snapshotDate))
  } catch {
    dbRows = []
  }

  const deviceRecords = await db.select({ id: devices.id }).from(devices).where(eq(devices.facilityId, facilityId))
  const deviceIds = deviceRecords.map((d) => d.id)

  let energyRows: { timestamp: Date; solarGeneration: string | null; energy: string | null }[] = []
  if (deviceIds.length > 0) {
    try {
      energyRows = await db
        .select({
          timestamp: energyData.timestamp,
          solarGeneration: energyData.solarGeneration,
          energy: energyData.energy,
        })
        .from(energyData)
        .where(and(inArray(energyData.deviceId, deviceIds), gte(energyData.timestamp, start)))
    } catch {
      energyRows = []
    }
  }

  const energyByDay = aggregateEnergyByDay(energyRows)
  const dbByDate = new Map(dbRows.map((r) => [r.snapshotDate, r]))

  const daily: EfficiencyDayPayload[] = []
  let hybrid = false
  let usedDb = false

  for (const sim of simulated) {
    const date = sim.snapshotDate
    const dbRow = dbByDate.get(date)
    const meter = energyByDay.get(date)

    let row: SimulatedEfficiencyDay = { ...sim }
    let dataSource: EfficiencyDayPayload["dataSource"] = "simulated"

    if (dbRow?.producedKwh != null && dbRow?.expectedKwh != null) {
      usedDb = true
      const produced = Number(dbRow.producedKwh)
      const expected = Number(dbRow.expectedKwh)
      const consumed = Number(dbRow.consumedKwh ?? 0)
      row = {
        snapshotDate: date,
        producedKwh: produced,
        consumedKwh: consumed,
        expectedKwh: expected,
        avgIrradianceWm2: Number(dbRow.avgIrradianceWm2 ?? sim.avgIrradianceWm2),
        performanceRatio: Number(dbRow.performanceRatio ?? sim.performanceRatio),
        degradationYearlyPct: Number(dbRow.degradationYearlyPct ?? sim.degradationYearlyPct),
        efficiencyPct: Number(dbRow.efficiencyPct ?? sim.efficiencyPct),
        underperforming: Boolean(dbRow.underperforming),
        billingNote: dbRow.billingNote || sim.billingNote,
      }
      dataSource = (dbRow.dataSource as EfficiencyDayPayload["dataSource"]) || "meter"
    } else if (meter && (meter.produced > 0 || meter.consumed > 0)) {
      hybrid = true
      const expected = sim.expectedKwh
      const produced = meter.produced > 0 ? meter.produced : sim.producedKwh * 0.4 + meter.consumed * 0.02
      const consumed = meter.consumed > 0 ? meter.consumed : sim.consumedKwh
      const ratio = produced / Math.max(expected, 0.01)
      row = {
        snapshotDate: date,
        producedKwh: Math.round(produced * 1000) / 1000,
        consumedKwh: Math.round(consumed * 1000) / 1000,
        expectedKwh: expected,
        avgIrradianceWm2: sim.avgIrradianceWm2,
        performanceRatio: Math.min(100, Math.round(ratio * 78 * 100) / 100),
        degradationYearlyPct: sim.degradationYearlyPct,
        efficiencyPct: Math.min(100, Math.round((produced / Math.max(consumed, 0.01)) * 10000) / 100),
        underperforming: ratio < 0.82,
        billingNote: sim.billingNote,
      }
      dataSource = "hybrid"
    }

    if (options.forceMock) {
      row = { ...sim }
      dataSource = "simulated"
    }

    daily.push(simToPayload(row, paymentModel, dataSource))
  }

  const latest = daily[daily.length - 1]
  const underperformingDays = daily.filter((d) => d.underperforming).length
  const avgEfficiencyPct = daily.reduce((s, d) => s + d.efficiencyPct, 0) / Math.max(daily.length, 1)
  const avgPerformanceRatio = daily.reduce((s, d) => s + d.performanceRatio, 0) / Math.max(daily.length, 1)
  const avgProducedKwh = daily.reduce((s, d) => s + d.producedKwh, 0) / Math.max(daily.length, 1)
  const avgExpectedKwh = daily.reduce((s, d) => s + d.expectedKwh, 0) / Math.max(daily.length, 1)

  const billingContext = billingContextForEfficiency(paymentModel, latest?.underperforming ?? false)

  const alerts: EfficiencyPerformancePayload["alerts"] = []
  if (latest?.underperforming) {
    alerts.push({
      level: "warning",
      message: `Latest period: production is below expected yield (${latest.producedKwh} vs ${latest.expectedKwh} kWh).`,
      date: latest.snapshotDate,
    })
  }
  if (underperformingDays >= Math.ceil(days * 0.25)) {
    alerts.push({
      level: "critical",
      message: `${underperformingDays} of ${days} days flagged as underperforming — schedule a technical review.`,
    })
  }

  let source: EfficiencyPerformancePayload["source"] = "simulated"
  if (usedDb && hybrid) source = "hybrid"
  else if (usedDb) source = "db"
  else if (hybrid) source = "hybrid"

  if (options.forceMock) source = "simulated"

  if (options.evaluateAlerts && latest?.underperforming) {
    await maybeNotifyEnergyUnderperformance(facilityId, {
      date: latest.snapshotDate,
      produced: latest.producedKwh,
      expected: latest.expectedKwh,
      paymentModel,
    })
  }

  return {
    facilityId,
    paymentModel,
    billingContext,
    source,
    days,
    summary: {
      avgEfficiencyPct: Math.round(avgEfficiencyPct * 10) / 10,
      avgPerformanceRatio: Math.round(avgPerformanceRatio * 10) / 10,
      underperformingDays,
      latestUnderperforming: Boolean(latest?.underperforming),
      avgProducedKwh: Math.round(avgProducedKwh * 100) / 100,
      avgExpectedKwh: Math.round(avgExpectedKwh * 100) / 100,
    },
    daily,
    alerts,
  }
}
