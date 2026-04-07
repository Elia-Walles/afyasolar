import 'dotenv/config'
import { getRawConnection } from '../index'

async function runMigration() {
  let connection: any = null

  try {
    console.log('🚀 Starting migration: Create facility_branches table...')

    const pool = getRawConnection()
    connection = await pool.getConnection()

    const dbName = process.env.DB_NAME || 'afya_solar'
    console.log(`✓ Connected to database: ${dbName}\n`)

    const [tableInfo] = await connection.query(
      `
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facility_branches'
    `,
      [dbName],
    )

    if (tableInfo[0].count > 0) {
      console.log('⏭️ facility_branches table already exists, skipping creation.')
      return
    }

    console.log('➕ Creating facility_branches table...')
    await connection.query(`
      CREATE TABLE facility_branches (
        id VARCHAR(36) PRIMARY KEY,
        facility_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        manager_name VARCHAR(255) NULL,
        total_departments INT NULL,
        region VARCHAR(100) NULL,
        district VARCHAR(100) NULL,
        number_of_staff INT NULL,
        office_phone VARCHAR(30) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX facility_branches_facility_idx (facility_id),
        INDEX facility_branches_name_idx (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    console.log('   ✓ facility_branches table created successfully')
    console.log('✅ Migration completed successfully!')
  } catch (error: any) {
    console.error('❌ Migration error (facility_branches):', error.message)
    if (error.code) {
      console.error(`   Error code: ${error.code}`)
    }
    console.error('   Full error:', error)
  } finally {
    if (connection) {
      await connection.release()
    }
  }
}

export default runMigration

// Execute immediately when run via `tsx` or `node`
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🏁 facility_branches migration finished.')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ facility_branches migration failed:', error)
      process.exit(1)
    })
}

