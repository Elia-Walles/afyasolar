import { getRawConnection } from './index'

async function runMigrations() {
  let connection: any = null

  try {
    console.log('🚀 Starting commission system migrations...\n')

    // Get connection from existing db setup
    const pool = getRawConnection()
    connection = await pool.getConnection()
    
    const dbName = process.env.DB_NAME || 'afya_solar'
    console.log(`✓ Connected to database: ${dbName}\n`)

    // Import all migration files
    const migrationFiles = [
      './add-commission-percentage.js',
      './create-technician-commissions.js',
      './create-technician-withdrawals.js',
      './add-user-subrole-department.ts', // Add new migration
      // ... other existing migration files
    ]

    // Migration 1: Add commission_percentage column
    console.log('1. Adding commission_percentage column to maintenance_requests...')
    try {
      // Check if column exists
      const [columns]: any = await connection.query(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'maintenance_requests'
          AND COLUMN_NAME = 'commission_percentage'
      `, [process.env.DB_NAME || 'afya_solar'])

      if (columns[0].count === 0) {
        await connection.query(`
          ALTER TABLE \`maintenance_requests\`
          ADD COLUMN \`commission_percentage\` DECIMAL(5, 2) NULL COMMENT 'Commission percentage (0-100)' AFTER \`assigned_technician_id\`
        `)
        console.log('   ✓ Column added successfully\n')
      } else {
        console.log('   ⚠ Column already exists, skipping...\n')
      }
    } catch (error: any) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⚠ Column already exists, skipping...\n')
      } else {
        throw error
      }
    }

    // Migration 2: Create technician_commissions table
    console.log('2. Creating technician_commissions table...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`technician_commissions\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`technician_id\` VARCHAR(36) NOT NULL,
        \`maintenance_request_id\` VARCHAR(36) NOT NULL,
        \`commission_percentage\` DECIMAL(5, 2) NOT NULL,
        \`total_payment_amount\` DECIMAL(12, 2) NOT NULL COMMENT 'Total amount facility paid',
        \`commission_amount\` DECIMAL(12, 2) NOT NULL COMMENT 'Calculated commission',
        \`currency\` VARCHAR(10) DEFAULT 'TZS',
        \`commission_status\` ENUM('pending', 'earned', 'withdrawn') NOT NULL DEFAULT 'earned',
        \`earned_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`withdrawn_at\` DATETIME NULL,
        \`withdrawal_id\` VARCHAR(36) NULL COMMENT 'Link to withdrawal if withdrawn',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`technician_commission_technician_idx\` (\`technician_id\`),
        INDEX \`technician_commission_request_idx\` (\`maintenance_request_id\`),
        INDEX \`technician_commission_status_idx\` (\`commission_status\`),
        INDEX \`technician_commission_earned_idx\` (\`earned_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('   ✓ Table created successfully\n')

    // Migration 3: Create technician_withdrawals table
    console.log('3. Creating technician_withdrawals table...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`technician_withdrawals\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`technician_id\` VARCHAR(36) NOT NULL,
        \`amount\` DECIMAL(12, 2) NOT NULL,
        \`currency\` VARCHAR(10) DEFAULT 'TZS',
        \`withdrawal_method\` VARCHAR(50) NULL COMMENT 'mpesa, bank_transfer, etc.',
        \`account_details\` TEXT NULL COMMENT 'JSON string with account info',
        \`withdrawal_status\` ENUM('pending', 'processing', 'completed', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        \`admin_notes\` TEXT NULL,
        \`processed_at\` DATETIME NULL,
        \`processed_by\` VARCHAR(36) NULL COMMENT 'Admin user ID',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`technician_withdrawal_technician_idx\` (\`technician_id\`),
        INDEX \`technician_withdrawal_status_idx\` (\`withdrawal_status\`),
        INDEX \`technician_withdrawal_created_idx\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('   ✓ Table created successfully\n')

    // Verify migrations
    console.log('Verifying migrations...')
    const [tables]: any = await connection.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('technician_commissions', 'technician_withdrawals')
    `, [process.env.DB_NAME || 'afya_solar'])

    const [columns]: any = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'maintenance_requests'
        AND COLUMN_NAME = 'commission_percentage'
    `, [process.env.DB_NAME || 'afya_solar'])

    console.log(`\n✓ Found ${tables.length} commission tables`)
    console.log(`✓ Commission percentage column ${columns.length > 0 ? 'exists' : 'missing'}`)
    console.log('\n✅ All migrations completed successfully!')
    
    if (connection) {
      await connection.release()
    }
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Migration error:', error.message)
    if (error.code) {
      console.error(`   Error code: ${error.code}`)
    }
    if (error.sql) {
      console.error(`   SQL: ${error.sql}`)
    }
    console.error('   Full error:', error)
    if (connection) {
      await connection.release()
    }
    process.exit(1)
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
