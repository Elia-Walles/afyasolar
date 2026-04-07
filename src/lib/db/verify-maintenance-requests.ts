/**
 * Verification script for maintenance_requests table
 * Ensures the schema is correct and fixes any inconsistencies
 */

import mysql from 'mysql2/promise'
import { drizzle } from 'drizzle-orm/mysql2'
import * as schema from './schema'
import * as fs from 'fs'
import * as path from 'path'

function getSSLConfig() {
  if (process.env.DB_SSL !== 'true') {
    return undefined
  }

  const caPath = process.env.DB_CA_PATH || path.join(process.cwd(), 'certs', 'isgrootx1.pem')

  // Check if CA certificate file exists
  if (fs.existsSync(caPath)) {
    return {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true,
    }
  }

  // Fallback to rejectUnauthorized: false if CA file not found
  console.warn(`CA certificate not found at ${caPath}. Using insecure connection.`)
  return {
    rejectUnauthorized: false,
  }
}

async function verifyAndFixMaintenanceRequests() {
  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = parseInt(process.env.DB_PORT || '4000')
  const dbUser = process.env.DB_USER || 'root'
  const dbPassword = process.env.DB_PASSWORD || ''
  const dbName = process.env.DB_NAME || 'afya_solar'

  let connection
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      ssl: getSSLConfig(),
    })

    console.log('🔍 Verifying maintenance_requests table schema...')

    // Check if table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'maintenance_requests'
    `, [dbName])

    if ((tables as any[]).length === 0) {
      console.log('❌ maintenance_requests table does not exist!')
      console.log('   Run: npm run db:migrate')
      return
    }

    console.log('✅ maintenance_requests table exists')

    // Check if assigned_technician_id column exists and has correct type
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'maintenance_requests'
      AND COLUMN_NAME = 'assigned_technician_id'
    `, [dbName])

    if ((columns as any[]).length === 0) {
      console.log('❌ assigned_technician_id column does not exist!')
      console.log('   Adding column...')
      await connection.query(`
        ALTER TABLE \`maintenance_requests\`
        ADD COLUMN \`assigned_technician_id\` varchar(36) NULL AFTER \`equipment_id\`
      `)
      console.log('✅ Added assigned_technician_id column')
    } else {
      const col = (columns as any[])[0]
      console.log(`✅ assigned_technician_id column exists (${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE})`)
    }

    // Check if index exists
    const [indexes] = await connection.query(`
      SELECT INDEX_NAME, COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'maintenance_requests'
      AND COLUMN_NAME = 'assigned_technician_id'
    `, [dbName])

    if ((indexes as any[]).length === 0) {
      console.log('❌ Index on assigned_technician_id does not exist!')
      console.log('   Adding index...')
      await connection.query(`
        ALTER TABLE \`maintenance_requests\`
        ADD INDEX \`maintenance_request_technician_idx\` (\`assigned_technician_id\`)
      `)
      console.log('✅ Added index on assigned_technician_id')
    } else {
      console.log('✅ Index on assigned_technician_id exists')
    }

    // Check status enum values
    const [statusEnum] = await connection.query(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'maintenance_requests'
      AND COLUMN_NAME = 'status'
    `, [dbName])

    if ((statusEnum as any[]).length > 0) {
      const enumType = (statusEnum as any[])[0].COLUMN_TYPE
      console.log(`✅ Status column type: ${enumType}`)
      
      // Check if all required statuses are present
      const requiredStatuses = [
        'pending', 'engineer_assigned', 'engineer_confirmed', 'under_inspection',
        'quote_submitted', 'quote_approved', 'quote_accepted', 'advance_due',
        'advance_paid', 'in_progress', 'report_submitted', 'report_approved', 'final_payment_due',
        'completed', 'reviewed', 'cancelled'
      ]
      
      const hasAllStatuses = requiredStatuses.every(status => 
        enumType.includes(`'${status}'`)
      )
      
      if (!hasAllStatuses) {
        console.log('⚠️  Status enum may be missing some values')
        console.log('   Required statuses:', requiredStatuses.join(', '))
      } else {
        console.log('✅ All required status values are present')
      }
    }

    // Check for data inconsistencies
    console.log('\n🔍 Checking for data inconsistencies...')

    // Check for requests with assigned_technician_id but status is still 'pending'
    const [pendingWithTech] = await connection.query(`
      SELECT COUNT(*) as count
      FROM \`maintenance_requests\`
      WHERE \`status\` = 'pending'
      AND \`assigned_technician_id\` IS NOT NULL
    `)

    const pendingCount = (pendingWithTech as any[])[0]?.count || 0
    if (pendingCount > 0) {
      console.log(`⚠️  Found ${pendingCount} requests with assigned_technician_id but status is 'pending'`)
      console.log('   These should have status "engineer_assigned" or later')
      console.log('   Fixing...')
      
      await connection.query(`
        UPDATE \`maintenance_requests\`
        SET \`status\` = 'engineer_assigned',
            \`assigned_at\` = COALESCE(\`assigned_at\`, CURRENT_TIMESTAMP)
        WHERE \`status\` = 'pending'
        AND \`assigned_technician_id\` IS NOT NULL
      `)
      
      console.log(`✅ Fixed ${pendingCount} requests`)
    } else {
      console.log('✅ No data inconsistencies found')
    }

    // Check for requests with status 'engineer_assigned' but no assigned_technician_id
    const [assignedWithoutTech] = await connection.query(`
      SELECT COUNT(*) as count
      FROM \`maintenance_requests\`
      WHERE \`status\` IN ('engineer_assigned', 'engineer_confirmed', 'under_inspection', 
                           'quote_submitted', 'quote_approved', 'quote_accepted', 
                           'advance_due', 'advance_paid', 'in_progress', 'report_submitted', 'report_approved',
                           'final_payment_due', 'completed', 'reviewed')
      AND \`assigned_technician_id\` IS NULL
    `)

    const assignedCount = (assignedWithoutTech as any[])[0]?.count || 0
    if (assignedCount > 0) {
      console.log(`⚠️  Found ${assignedCount} requests with assigned status but no assigned_technician_id`)
      console.log('   These should have a technician assigned or status should be "pending"')
    } else {
      console.log('✅ All assigned requests have assigned_technician_id')
    }

    // Show summary statistics
    console.log('\n📊 Summary Statistics:')
    
    const [totalRequests] = await connection.query(`
      SELECT COUNT(*) as count FROM \`maintenance_requests\`
    `)
    console.log(`   Total requests: ${(totalRequests as any[])[0]?.count || 0}`)

    const [assignedRequests] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM \`maintenance_requests\`
      WHERE \`assigned_technician_id\` IS NOT NULL
    `)
    console.log(`   Assigned requests: ${(assignedRequests as any[])[0]?.count || 0}`)

    const [pendingRequests] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM \`maintenance_requests\`
      WHERE \`status\` = 'pending'
      AND \`assigned_technician_id\` IS NULL
    `)
    console.log(`   Pending (unassigned) requests: ${(pendingRequests as any[])[0]?.count || 0}`)

    const [byStatus] = await connection.query(`
      SELECT \`status\`, COUNT(*) as count
      FROM \`maintenance_requests\`
      GROUP BY \`status\`
      ORDER BY count DESC
    `)
    console.log('\n   Requests by status:')
    ;(byStatus as any[]).forEach((row: any) => {
      console.log(`     ${row.status}: ${row.count}`)
    })

    console.log('\n✅ Verification complete!')
    
  } catch (error) {
    console.error('❌ Error verifying database:', error)
    throw error
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// Run if called directly
if (require.main === module) {
  verifyAndFixMaintenanceRequests()
    .then(() => {
      console.log('✅ Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Failed:', error)
      process.exit(1)
    })
}

export { verifyAndFixMaintenanceRequests }

