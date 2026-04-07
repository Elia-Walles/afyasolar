import { sql } from 'drizzle-orm'
import { db } from './index'

let ensured = false

export async function ensureMaintenanceTables() {
  if (ensured) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`maintenance_request_comments\` (
      \`id\` CHAR(36) NOT NULL,
      \`maintenance_request_id\` VARCHAR(36) NOT NULL,
      \`author_id\` VARCHAR(36) NOT NULL,
      \`author_name\` VARCHAR(255) NOT NULL,
      \`author_role\` ENUM('admin','technician','facility') NOT NULL,
      \`visibility\` ENUM('internal','facility','technician','public') NOT NULL DEFAULT 'internal',
      \`message\` TEXT NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_mrc_request\` (\`maintenance_request_id\`),
      INDEX \`idx_mrc_visibility\` (\`visibility\`)
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`maintenance_audit_logs\` (
      \`id\` CHAR(36) NOT NULL,
      \`user_id\` VARCHAR(36) NULL,
      \`user_email\` VARCHAR(255) NULL,
      \`action\` VARCHAR(255) NOT NULL,
      \`resource\` VARCHAR(255) NOT NULL,
      \`resource_id\` VARCHAR(255) NULL,
      \`details\` JSON NULL,
      \`ip_address\` VARCHAR(100) NULL,
      \`user_agent\` VARCHAR(255) NULL,
      \`success\` TINYINT(1) NOT NULL DEFAULT 1,
      \`error\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )
  `)
  ensured = true
}

