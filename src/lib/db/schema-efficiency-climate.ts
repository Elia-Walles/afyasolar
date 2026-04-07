import {
  mysqlTable,
  varchar,
  decimal,
  boolean,
  text,
  datetime,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

/**
 * Daily energy efficiency rollups per facility (meter, simulated, or hybrid).
 * Links to payment context via paymentModelSnapshot for billing alignment.
 */
export const facilityEfficiencyDaily = mysqlTable(
  "facility_efficiency_daily",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    facilityId: varchar("facility_id", { length: 36 }).notNull(),
    snapshotDate: varchar("snapshot_date", { length: 10 }).notNull(),
    producedKwh: decimal("produced_kwh", { precision: 14, scale: 4 }),
    consumedKwh: decimal("consumed_kwh", { precision: 14, scale: 4 }),
    expectedKwh: decimal("expected_kwh", { precision: 14, scale: 4 }),
    avgIrradianceWm2: decimal("avg_irradiance_wm2", { precision: 10, scale: 2 }),
    performanceRatio: decimal("performance_ratio", { precision: 6, scale: 2 }),
    degradationYearlyPct: decimal("degradation_yearly_pct", { precision: 6, scale: 3 }),
    efficiencyPct: decimal("efficiency_pct", { precision: 6, scale: 2 }),
    underperforming: boolean("underperforming").notNull().default(false),
    paymentModelSnapshot: varchar("payment_model_snapshot", { length: 30 }),
    billingNote: text("billing_note"),
    dataSource: varchar("data_source", { length: 20 }).notNull().default("meter"),
    createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    facilityDateUq: uniqueIndex("fed_facility_date").on(table.facilityId, table.snapshotDate),
    facilityIdx: index("fed_facility_idx").on(table.facilityId),
    dateIdx: index("fed_date_idx").on(table.snapshotDate),
  })
)

/** Aggregated climate / hazard exposure for a facility */
export const facilityClimateProfile = mysqlTable(
  "facility_climate_profile",
  {
    facilityId: varchar("facility_id", { length: 36 }).primaryKey(),
    floodRiskScore: decimal("flood_risk_score", { precision: 6, scale: 2 }).notNull(),
    heatRiskScore: decimal("heat_risk_score", { precision: 6, scale: 2 }).notNull(),
    windRiskScore: decimal("wind_risk_score", { precision: 6, scale: 2 }).notNull(),
    rainRiskScore: decimal("rain_risk_score", { precision: 6, scale: 2 }).notNull(),
    overallResilienceScore: decimal("overall_resilience_score", { precision: 6, scale: 2 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 6 }),
    longitude: decimal("longitude", { precision: 10, scale: 6 }),
    dataSource: varchar("data_source", { length: 20 }).notNull().default("simulated"),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  },
  (table) => ({
    resilienceIdx: index("fcp_resilience_idx").on(table.overallResilienceScore),
  })
)

/** Adaptation recommendations and implementation tracking */
export const facilityClimateAdaptation = mysqlTable(
  "facility_climate_adaptation",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    facilityId: varchar("facility_id", { length: 36 }).notNull(),
    riskCategory: varchar("risk_category", { length: 50 }).notNull(),
    recommendation: text("recommendation").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("recommended"),
    implementedAt: datetime("implemented_at", { mode: "date" }),
    effectivenessNote: text("effectiveness_note"),
    createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  },
  (table) => ({
    facilityIdx: index("fca_facility_idx").on(table.facilityId),
    statusIdx: index("fca_status_idx").on(table.status),
  })
)

/** Monthly resilience trend (effectiveness of adaptations over time) */
export const facilityResilienceSnapshot = mysqlTable(
  "facility_resilience_snapshot",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    facilityId: varchar("facility_id", { length: 36 }).notNull(),
    periodMonth: varchar("period_month", { length: 7 }).notNull(),
    resilienceScore: decimal("resilience_score", { precision: 6, scale: 2 }).notNull(),
    adaptationCompletionPct: decimal("adaptation_completion_pct", { precision: 6, scale: 2 }),
    notes: text("notes"),
    createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    facilityMonthUq: uniqueIndex("frs_facility_month").on(table.facilityId, table.periodMonth),
    facilityIdx: index("frs_facility_idx").on(table.facilityId),
  })
)

export type FacilityEfficiencyDaily = typeof facilityEfficiencyDaily.$inferSelect
export type NewFacilityEfficiencyDaily = typeof facilityEfficiencyDaily.$inferInsert
export type FacilityClimateProfile = typeof facilityClimateProfile.$inferSelect
export type FacilityClimateAdaptation = typeof facilityClimateAdaptation.$inferSelect
export type FacilityResilienceSnapshot = typeof facilityResilienceSnapshot.$inferSelect
