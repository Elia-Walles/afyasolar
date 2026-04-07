import { sql } from 'drizzle-orm'

// Add latitude/longitude to facilities table
export const up = async (db: any) => {
  await db.execute(sql`
    ALTER TABLE facilities
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) NULL COMMENT 'Facility latitude' AFTER category,
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) NULL COMMENT 'Facility longitude' AFTER latitude;
  `)

  console.log('Added latitude and longitude columns to facilities table')
}

// Rollback: drop latitude/longitude
export const down = async (db: any) => {
  await db.execute(sql`
    ALTER TABLE facilities
      DROP COLUMN IF EXISTS latitude,
      DROP COLUMN IF EXISTS longitude;
  `)

  console.log('Dropped latitude and longitude columns from facilities table')
}
