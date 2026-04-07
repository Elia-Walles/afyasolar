import { sql } from "drizzle-orm"
import { db } from "./index"

let ensured = false

/**
 * Creates efficiency & climate tables if missing (safe for TiDB / MySQL).
 * Called from API routes on demand; idempotent.
 */
export async function ensureEfficiencyClimateTables(): Promise<void> {
  if (ensured) return

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`facility_efficiency_daily\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`facility_id\` VARCHAR(36) NOT NULL,
      \`snapshot_date\` VARCHAR(10) NOT NULL,
      \`produced_kwh\` DECIMAL(14,4) NULL,
      \`consumed_kwh\` DECIMAL(14,4) NULL,
      \`expected_kwh\` DECIMAL(14,4) NULL,
      \`avg_irradiance_wm2\` DECIMAL(10,2) NULL,
      \`performance_ratio\` DECIMAL(6,2) NULL,
      \`degradation_yearly_pct\` DECIMAL(6,3) NULL,
      \`efficiency_pct\` DECIMAL(6,2) NULL,
      \`underperforming\` TINYINT(1) NOT NULL DEFAULT 0,
      \`payment_model_snapshot\` VARCHAR(30) NULL,
      \`billing_note\` TEXT NULL,
      \`data_source\` VARCHAR(20) NOT NULL DEFAULT 'meter',
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`fed_facility_date\` (\`facility_id\`, \`snapshot_date\`),
      KEY \`fed_facility_idx\` (\`facility_id\`),
      KEY \`fed_date_idx\` (\`snapshot_date\`)
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`facility_climate_profile\` (
      \`facility_id\` VARCHAR(36) NOT NULL,
      \`flood_risk_score\` DECIMAL(6,2) NOT NULL,
      \`heat_risk_score\` DECIMAL(6,2) NOT NULL,
      \`wind_risk_score\` DECIMAL(6,2) NOT NULL,
      \`rain_risk_score\` DECIMAL(6,2) NOT NULL,
      \`overall_resilience_score\` DECIMAL(6,2) NOT NULL,
      \`latitude\` DECIMAL(10,6) NULL,
      \`longitude\` DECIMAL(10,6) NULL,
      \`data_source\` VARCHAR(20) NOT NULL DEFAULT 'simulated',
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`facility_id\`),
      KEY \`fcp_resilience_idx\` (\`overall_resilience_score\`)
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`facility_climate_adaptation\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`facility_id\` VARCHAR(36) NOT NULL,
      \`risk_category\` VARCHAR(50) NOT NULL,
      \`recommendation\` TEXT NOT NULL,
      \`status\` VARCHAR(30) NOT NULL DEFAULT 'recommended',
      \`implemented_at\` DATETIME NULL,
      \`effectiveness_note\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`fca_facility_idx\` (\`facility_id\`),
      KEY \`fca_status_idx\` (\`status\`)
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`facility_resilience_snapshot\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`facility_id\` VARCHAR(36) NOT NULL,
      \`period_month\` VARCHAR(7) NOT NULL,
      \`resilience_score\` DECIMAL(6,2) NOT NULL,
      \`adaptation_completion_pct\` DECIMAL(6,2) NULL,
      \`notes\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`frs_facility_month\` (\`facility_id\`, \`period_month\`),
      KEY \`frs_facility_idx\` (\`facility_id\`)
    )
  `)

  ensured = true
}
