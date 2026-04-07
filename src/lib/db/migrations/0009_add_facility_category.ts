import { sql } from 'drizzle-orm'

export const up = async (db: any) => {
  // Add the category column to facilities table
  await db.execute(sql`
    ALTER TABLE facilities 
    ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'Dispensary' COMMENT 'Facility category: Pharmacy, DMDL, Dispensary, Laboratory, Polyclinic, Specialized Polyclinic, Health Center, Hospital, District Hospital, Regional Hospital';
  `)

  console.log('Added category column to facilities table')
}

export const down = async (db: any) => {
  await db.execute(sql`
    ALTER TABLE facilities 
    DROP COLUMN IF EXISTS category;
  `)
  
  console.log('Dropped category column from facilities table')
}
