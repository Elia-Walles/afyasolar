import { getRawConnection } from '../index'

async function runMigration() {
  let connection: any = null

  try {
    console.log('🚀 Starting migration: Add subRole and department fields to users table...')
    
    // Get connection from existing db setup
    const pool = getRawConnection()
    connection = await pool.getConnection()
    
    const dbName = process.env.DB_NAME || 'afya_solar'
    console.log(`✓ Connected to database: ${dbName}\n`)

    // Check if columns already exist
    const [subRoleColumn] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'sub_role'
    `, [dbName])

    const [departmentColumn] = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'department'
    `, [dbName])

    console.log(`📊 Current column status:`)
    console.log(`  - sub_role column: ${subRoleColumn[0].count > 0 ? 'EXISTS' : 'MISSING'}`)
    console.log(`  - department column: ${departmentColumn[0].count > 0 ? 'EXISTS' : 'MISSING'}`)

    // Add sub_role column if it doesn't exist
    if (subRoleColumn[0].count === 0) {
      console.log('➕ Adding sub_role column...')
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN sub_role VARCHAR(50) NULL COMMENT 'Store facility sub-roles: store-manager, pharmacy-manager, etc.'
      `)
      console.log('   ✓ sub_role column added successfully')
    } else {
      console.log('⏭️ sub_role column already exists, skipping...')
    }

    // Add department column if it doesn't exist
    if (departmentColumn[0].count === 0) {
      console.log('➕ Adding department column...')
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN department VARCHAR(100) NULL COMMENT 'Store department information'
      `)
      console.log('   ✓ department column added successfully')
    } else {
      console.log('⏭️ department column already exists, skipping...')
    }

    console.log('✅ Migration completed successfully!')

  } catch (error: any) {
    console.error('❌ Migration error:', error.message)
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
