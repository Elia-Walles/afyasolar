import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env file
// This is needed for standalone scripts (not running through Next.js)
try {
  // Try to use dotenv if available
  require('dotenv').config()
} catch (error) {
  // If dotenv is not installed, manually load .env file
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach((line) => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '')
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = cleanValue
          }
        }
      }
    })
  }
}

/**
 * Get SSL configuration for TiDB Cloud
 */
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

/**
 * Create tables directly using SQL (fallback method)
 * Uses IF NOT EXISTS to safely handle existing tables
 */
async function createTablesDirectly(connection: any, dbName: string) {
  console.log('Creating/verifying tables using direct SQL...')
  
  // Create users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` varchar(36) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`password\` varchar(255) NOT NULL,
      \`role\` varchar(20) NOT NULL,
      \`facility_id\` varchar(36),
      \`email_verified\` boolean NOT NULL DEFAULT false,
      \`email_verification_token\` varchar(255),
      \`email_verification_expires\` datetime,
      \`failed_login_attempts\` int NOT NULL DEFAULT 0,
      \`account_locked_until\` datetime,
      \`last_login_at\` datetime,
      \`invitation_sent_at\` datetime,
      \`invitation_count\` int NOT NULL DEFAULT 0,
      \`token_used\` boolean NOT NULL DEFAULT false,
      \`password_reset_token\` varchar(255),
      \`password_reset_expires\` datetime,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`email\` (\`email\`),
      KEY \`email_idx\` (\`email\`),
      KEY \`facility_idx\` (\`facility_id\`),
      KEY \`verification_token_idx\` (\`email_verification_token\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created users table')
  
  // Add email verification columns to existing users table if they don't exist
  // MySQL doesn't support IF NOT EXISTS for ALTER TABLE, so we check if column exists first
  try {
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('email_verified', 'email_verification_token', 'email_verification_expires')
    `, [dbName])
    
    const existingColumns = (columns as any[]).map((c: any) => c.COLUMN_NAME)
    
    // Add new security and invitation tracking columns
    const newColumns = [
      { name: 'failed_login_attempts', sql: '`failed_login_attempts` int NOT NULL DEFAULT 0' },
      { name: 'account_locked_until', sql: '`account_locked_until` datetime' },
      { name: 'last_login_at', sql: '`last_login_at` datetime' },
      { name: 'invitation_sent_at', sql: '`invitation_sent_at` datetime' },
      { name: 'invitation_count', sql: '`invitation_count` int NOT NULL DEFAULT 0' },
      { name: 'token_used', sql: '`token_used` boolean NOT NULL DEFAULT false' },
      { name: 'password_reset_token', sql: '`password_reset_token` varchar(255)' },
      { name: 'password_reset_expires', sql: '`password_reset_expires` datetime' },
    ]
    
    for (const col of newColumns) {
      if (!existingColumns.includes(col.name)) {
        await connection.query(`ALTER TABLE \`users\` ADD COLUMN ${col.sql}`)
        console.log(`✅ Added column: ${col.name}`)
      }
    }
    
    if (!existingColumns.includes('email_verified')) {
      await connection.query(`ALTER TABLE \`users\` ADD COLUMN \`email_verified\` boolean NOT NULL DEFAULT false`)
      console.log('✅ Added email_verified column')
    }
    if (!existingColumns.includes('email_verification_token')) {
      await connection.query(`ALTER TABLE \`users\` ADD COLUMN \`email_verification_token\` varchar(255)`)
      console.log('✅ Added email_verification_token column')
    }
    if (!existingColumns.includes('email_verification_expires')) {
      await connection.query(`ALTER TABLE \`users\` ADD COLUMN \`email_verification_expires\` datetime`)
      console.log('✅ Added email_verification_expires column')
    }
    
    // Add index for verification token if it doesn't exist
    try {
      const [indexes] = await connection.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'users' 
        AND INDEX_NAME = 'verification_token_idx'
      `, [dbName])
      
      if ((indexes as any[]).length === 0) {
        await connection.query(`CREATE INDEX \`verification_token_idx\` ON \`users\` (\`email_verification_token\`)`)
        console.log('✅ Added verification_token_idx index')
      }
      
      // Add index for password reset token if it doesn't exist
      const [resetTokenIndexes] = await connection.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'users' 
        AND INDEX_NAME = 'password_reset_token_idx'
      `, [dbName])
      
      if ((resetTokenIndexes as any[]).length === 0) {
        await connection.query(`CREATE INDEX \`password_reset_token_idx\` ON \`users\` (\`password_reset_token\`)`)
        console.log('✅ Added password_reset_token_idx index')
      }
    } catch (idxError: any) {
      // Index might already exist or other error, ignore
      if (!idxError.message.includes('Duplicate key name')) {
        console.warn('⚠️  Could not create token indexes:', idxError.message)
      }
    }
  } catch (checkError: any) {
    console.warn('⚠️  Could not verify/add email verification columns:', checkError.message)
  }

  // Create admins table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`admins\` (
      \`id\` varchar(36) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`password\` varchar(255) NOT NULL,
      \`email_verified\` boolean NOT NULL DEFAULT false,
      \`email_verification_token\` varchar(255),
      \`email_verification_expires\` datetime,
      \`failed_login_attempts\` int NOT NULL DEFAULT 0,
      \`account_locked_until\` datetime,
      \`last_login_at\` datetime,
      \`invitation_sent_at\` datetime,
      \`invitation_count\` int NOT NULL DEFAULT 0,
      \`token_used\` boolean NOT NULL DEFAULT false,
      \`password_reset_token\` varchar(255),
      \`password_reset_expires\` datetime,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`email\` (\`email\`),
      KEY \`admin_email_idx\` (\`email\`),
      KEY \`admin_verification_token_idx\` (\`email_verification_token\`),
      KEY \`admin_password_reset_token_idx\` (\`password_reset_token\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created admins table')

  // Create facilities table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`facilities\` (
      \`id\` varchar(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`address\` text NOT NULL,
      \`city\` varchar(100) NOT NULL,
      \`region\` varchar(100) NOT NULL,
      \`region_id\` bigint NULL,
      \`district_id\` bigint NULL,
      \`phone\` varchar(20) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`password\` varchar(255) NOT NULL,
      \`email_verified\` boolean NOT NULL DEFAULT true,
      \`status\` varchar(20) NOT NULL DEFAULT 'active',
      \`payment_model\` varchar(20) NOT NULL DEFAULT 'payg',
      \`credit_balance\` decimal(12,2) NOT NULL DEFAULT '0.00',
      \`monthly_consumption\` decimal(10,2) NOT NULL DEFAULT '0.00',
      \`system_size\` varchar(50),
      \`failed_login_attempts\` int NOT NULL DEFAULT 0,
      \`account_locked_until\` datetime,
      \`last_login_at\` datetime,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`email\` (\`email\`),
      KEY \`facility_email_idx\` (\`email\`),
      KEY \`status_idx\` (\`status\`),
      KEY \`region_idx\` (\`region\`),
      KEY \`facility_region_id_idx\` (\`region_id\`),
      KEY \`facility_district_id_idx\` (\`district_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created facilities table')

  // Update existing facilities table to add auth fields if they don't exist
  try {
    const [facilityColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'facilities'
    `, [dbName])
    
    const existingFacilityColumns = (facilityColumns as any[]).map((c: any) => c.COLUMN_NAME)
    
    // Add password if it doesn't exist
    if (!existingFacilityColumns.includes('password')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`password\` varchar(255)`)
      console.log('✅ Added password column to facilities table')
    }
    
    // Add email_verified if it doesn't exist
    if (!existingFacilityColumns.includes('email_verified')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`email_verified\` boolean NOT NULL DEFAULT true`)
      console.log('✅ Added email_verified column to facilities table')
    }
    
    // Add auth fields if they don't exist
    const authColumns = [
      { name: 'failed_login_attempts', sql: '`failed_login_attempts` int NOT NULL DEFAULT 0' },
      { name: 'account_locked_until', sql: '`account_locked_until` datetime' },
      { name: 'last_login_at', sql: '`last_login_at` datetime' },
    ]
    
    for (const col of authColumns) {
      if (!existingFacilityColumns.includes(col.name)) {
        await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN ${col.sql}`)
        console.log(`✅ Added ${col.name} column to facilities table`)
      }
    }

    // Add regionId and districtId columns if they don't exist
    if (!existingFacilityColumns.includes('region_id')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`region_id\` bigint NULL`)
      await connection.query(`ALTER TABLE \`facilities\` ADD INDEX \`facility_region_id_idx\` (\`region_id\`)`)
      console.log('✅ Added region_id column to facilities table')
    }
    
    if (!existingFacilityColumns.includes('district_id')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`district_id\` bigint NULL`)
      await connection.query(`ALTER TABLE \`facilities\` ADD INDEX \`facility_district_id_idx\` (\`district_id\`)`)
      console.log('✅ Added district_id column to facilities table')
    }

    // Add password reset token columns if they don't exist
    if (!existingFacilityColumns.includes('password_reset_token')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`password_reset_token\` varchar(255) NULL`)
      await connection.query(`ALTER TABLE \`facilities\` ADD INDEX \`facility_password_reset_token_idx\` (\`password_reset_token\`)`)
      console.log('✅ Added password_reset_token column to facilities table')
    }

    // Add invitation token columns if they don't exist
    if (!existingFacilityColumns.includes('invitation_token')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`invitation_token\` varchar(255) NULL`)
      console.log('✅ Added invitation_token column to facilities table')
    }
    
    if (!existingFacilityColumns.includes('invitation_expires')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`invitation_expires\` datetime NULL`)
      console.log('✅ Added invitation_expires column to facilities table')
    }
    
    if (!existingFacilityColumns.includes('password_reset_expires')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`password_reset_expires\` datetime NULL`)
      console.log('✅ Added password_reset_expires column to facilities table')
    }

    // Add booking system columns if they don't exist
    const bookingColumns = [
      { name: 'is_booking_enabled', sql: '`is_booking_enabled` boolean NOT NULL DEFAULT false' },
      { name: 'booking_whatsapp_number', sql: '`booking_whatsapp_number` varchar(50) NULL' },
      { name: 'booking_timezone', sql: '`booking_timezone` varchar(50) NULL DEFAULT \'Africa/Dar_es_Salaam\'' },
      { name: 'booking_slug', sql: '`booking_slug` varchar(255) NULL' },
      { name: 'booking_settings', sql: '`booking_settings` text NULL' },
    ]
    
    for (const col of bookingColumns) {
      if (!existingFacilityColumns.includes(col.name)) {
        await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN ${col.sql}`)
        console.log(`✅ Added ${col.name} column to facilities table`)
      }
    }

    // Add logo_url column if it doesn't exist
    if (!existingFacilityColumns.includes('logo_url')) {
      await connection.query(`ALTER TABLE \`facilities\` ADD COLUMN \`logo_url\` varchar(500) NULL AFTER \`booking_settings\``)
      console.log('✅ Added logo_url column to facilities table')
    }

    // Add booking slug index if it doesn't exist
    if (!existingFacilityColumns.includes('booking_slug')) {
      // Index will be added when column is created above
    } else {
      // Check if index exists
      const [bookingSlugIndexes] = await connection.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'facilities' 
        AND INDEX_NAME = 'facility_booking_slug_idx'
      `, [dbName])
      
      if ((bookingSlugIndexes as any[]).length === 0) {
        await connection.query(`CREATE INDEX \`facility_booking_slug_idx\` ON \`facilities\` (\`booking_slug\`)`)
        console.log('✅ Added facility_booking_slug_idx index')
      }
    }
    
    // Make email NOT NULL and UNIQUE if it's not already
    if (existingFacilityColumns.includes('email')) {
      // Check if email is already unique
      const [emailIndexes] = await connection.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'facilities' 
        AND COLUMN_NAME = 'email'
        AND NON_UNIQUE = 0
      `, [dbName])
      
      if ((emailIndexes as any[]).length === 0) {
        // First, make sure there are no duplicate emails
        await connection.query(`
          UPDATE \`facilities\` 
          SET \`email\` = CONCAT(\`id\`, '@temp.facility') 
          WHERE \`email\` IS NULL OR \`email\` = ''
        `)
        
        // Then add unique constraint
        await connection.query(`ALTER TABLE \`facilities\` MODIFY COLUMN \`email\` varchar(255) NOT NULL`)
        await connection.query(`ALTER TABLE \`facilities\` ADD UNIQUE KEY \`email\` (\`email\`)`)
        console.log('✅ Made email NOT NULL and UNIQUE in facilities table')
      }
      
      // Add email index if it doesn't exist
      const [emailIdx] = await connection.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'facilities' 
        AND INDEX_NAME = 'facility_email_idx'
      `, [dbName])
      
      if ((emailIdx as any[]).length === 0) {
        await connection.query(`CREATE INDEX \`facility_email_idx\` ON \`facilities\` (\`email\`)`)
        console.log('✅ Added facility_email_idx index')
      }
    }
  } catch (facilityError: any) {
    console.warn('⚠️  Could not update facilities table:', facilityError.message)
  }

  // Create devices table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`devices\` (
      \`id\` varchar(36) NOT NULL,
      \`serial_number\` varchar(20) NOT NULL,
      \`type\` varchar(20) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`sensor_size\` int NOT NULL DEFAULT 200,
      \`ports\` int NOT NULL DEFAULT 2,
      \`mode\` varchar(50) NOT NULL DEFAULT 'change_of_state',
      \`status\` varchar(20) NOT NULL DEFAULT 'active',
      \`last_update\` datetime,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`serial_number\` (\`serial_number\`),
      KEY \`serial_idx\` (\`serial_number\`),
      KEY \`device_facility_idx\` (\`facility_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created devices table')

  // Create energy_data table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`energy_data\` (
      \`id\` varchar(36) NOT NULL,
      \`device_id\` varchar(36) NOT NULL,
      \`timestamp\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`voltage\` decimal(8,2) NOT NULL,
      \`current\` decimal(8,2) NOT NULL,
      \`power\` decimal(10,2) NOT NULL,
      \`energy\` decimal(12,2) NOT NULL,
      \`credit_balance\` decimal(12,2) NOT NULL,
      \`battery_level\` decimal(5,2),
      \`solar_generation\` decimal(10,2),
      \`grid_status\` varchar(20) NOT NULL DEFAULT 'connected',
      \`critical_load\` boolean NOT NULL DEFAULT false,
      PRIMARY KEY (\`id\`),
      KEY \`energy_device_idx\` (\`device_id\`),
      KEY \`timestamp_idx\` (\`timestamp\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created energy_data table')

  // Create payments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`payments\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`amount\` decimal(12,2) NOT NULL,
      \`method\` varchar(20) NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`transaction_id\` varchar(255),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`payment_facility_idx\` (\`facility_id\`),
      KEY \`payment_status_idx\` (\`status\`),
      KEY \`transaction_idx\` (\`transaction_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created payments table')

  // Create bills table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`bills\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`period_start\` datetime NOT NULL,
      \`period_end\` datetime NOT NULL,
      \`total_consumption\` decimal(12,2) NOT NULL,
      \`total_cost\` decimal(12,2) NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`due_date\` datetime NOT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`bill_facility_idx\` (\`facility_id\`),
      KEY \`bill_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created bills table')

  // Create service_jobs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`service_jobs\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36),
      \`type\` varchar(20) NOT NULL,
      \`priority\` varchar(20) NOT NULL DEFAULT 'medium',
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`description\` text NOT NULL,
      \`scheduled_date\` datetime,
      \`completed_date\` datetime,
      \`notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`job_facility_idx\` (\`facility_id\`),
      KEY \`job_technician_idx\` (\`technician_id\`),
      KEY \`job_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created service_jobs table')

  // Create help_requests table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`help_requests\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36),
      \`user_id\` varchar(36),
      \`name\` varchar(255) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`phone\` varchar(20),
      \`subject\` varchar(255) NOT NULL,
      \`message\` text NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`admin_notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`help_facility_idx\` (\`facility_id\`),
      KEY \`help_user_idx\` (\`user_id\`),
      KEY \`help_status_idx\` (\`status\`),
      KEY \`help_email_idx\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created help_requests table')

  // Create device_requests table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`device_requests\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36),
      \`user_id\` varchar(36),
      \`name\` varchar(255) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`phone\` varchar(20) NOT NULL,
      \`facility_name\` varchar(255),
      \`device_type\` varchar(50),
      \`quantity\` int NOT NULL DEFAULT 1,
      \`message\` text,
      \`status\` varchar(20) NOT NULL DEFAULT 'pending',
      \`admin_notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`device_req_facility_idx\` (\`facility_id\`),
      KEY \`device_req_user_idx\` (\`user_id\`),
      KEY \`device_req_status_idx\` (\`status\`),
      KEY \`device_req_email_idx\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created device_requests table')

  // Create service_subscriptions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`service_subscriptions\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`service_name\` varchar(50) NOT NULL,
      \`status\` varchar(20) NOT NULL DEFAULT 'active',
      \`plan_type\` varchar(50),
      \`start_date\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`expiry_date\` datetime,
      \`auto_renew\` boolean NOT NULL DEFAULT false,
      \`payment_method\` varchar(20),
      \`amount\` decimal(10,2),
      \`billing_cycle\` varchar(20),
      \`cancelled_at\` datetime,
      \`cancellation_reason\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`subscription_facility_idx\` (\`facility_id\`),
      KEY \`subscription_service_idx\` (\`service_name\`),
      KEY \`subscription_status_idx\` (\`status\`),
      KEY \`facility_service_idx\` (\`facility_id\`, \`service_name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created service_subscriptions table')

  // Create regions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`regions\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`name\` varchar(255) NOT NULL,
      \`status\` tinyint(1) NOT NULL DEFAULT 1,
      \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`region_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created regions table')

  // Create districts table (without FK constraint to avoid type incompatibility issues on existing schemas)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`districts\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`region_id\` bigint unsigned NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`status\` tinyint(1) NOT NULL DEFAULT 1,
      \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`district_region_idx\` (\`region_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created districts table')

  // Create technicians table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`technicians\` (
      \`id\` varchar(36) NOT NULL,
      \`first_name\` varchar(100) NOT NULL,
      \`last_name\` varchar(100) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`phone\` varchar(30),
      \`years_experience\` int DEFAULT 0,
      \`practicing_license\` varchar(255),
      \`short_bio\` text,
      \`region_id\` bigint unsigned,
      \`district_id\` bigint unsigned,
      \`availability_status\` enum('available','busy','offline') NOT NULL DEFAULT 'available',
      \`status\` enum('active','inactive','banned') NOT NULL DEFAULT 'active',
      \`license_verified\` tinyint(1) NOT NULL DEFAULT 0,
      \`license_verified_at\` datetime,
      \`average_rating\` decimal(5,2) DEFAULT 0,
      \`total_reviews\` int NOT NULL DEFAULT 0,
      \`last_active_at\` datetime,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`technician_email_unique\` (\`email\`),
      KEY \`technician_phone_idx\` (\`phone\`),
      KEY \`technician_region_idx\` (\`region_id\`),
      KEY \`technician_district_idx\` (\`district_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created technicians table')

  // Create equipment_categories table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`equipment_categories\` (
      \`id\` varchar(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`description\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created equipment_categories table')

  // Create facility_equipment table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`facility_equipment\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`category_id\` varchar(36),
      \`name\` varchar(255) NOT NULL,
      \`model\` varchar(255),
      \`serial_number\` varchar(255),
      \`manufacturer\` varchar(255),
      \`purchase_date\` datetime,
      \`installation_date\` datetime,
      \`warranty_expiry_date\` datetime,
      \`purchase_cost\` decimal(12,2),
      \`location_in_facility\` varchar(255),
      \`status\` enum('active','inactive','maintenance','retired') NOT NULL DEFAULT 'active',
      \`condition\` enum('excellent','good','fair','poor') NOT NULL DEFAULT 'good',
      \`specifications\` text,
      \`maintenance_notes\` text,
      \`images\` text,
      \`qr_code\` varchar(255),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`facility_equipment_facility_idx\` (\`facility_id\`),
      KEY \`facility_equipment_category_idx\` (\`category_id\`),
      KEY \`facility_equipment_serial_idx\` (\`serial_number\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created facility_equipment table')

  // Create maintenance_requests table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_requests\` (
      \`id\` varchar(36) NOT NULL,
      \`request_number\` varchar(50) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36),
      \`assigned_technician_id\` varchar(36),
      \`maintenance_type\` enum('preventive','corrective','emergency') NOT NULL DEFAULT 'corrective',
      \`urgency_level\` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      \`device_name\` varchar(255) NOT NULL,
      \`issue_description\` text NOT NULL,
      \`device_images\` text,
      \`additional_description\` text,
      \`base_fee\` decimal(12,2) DEFAULT 0,
      \`engineer_quote\` decimal(12,2),
      \`parts_cost\` decimal(12,2),
      \`total_cost\` decimal(12,2),
      \`advance_payment_amount\` decimal(12,2) DEFAULT 0,
      \`advance_payment_status\` enum('pending','paid') NOT NULL DEFAULT 'pending',
      \`advance_paid_at\` datetime,
      \`final_payment_amount\` decimal(12,2) DEFAULT 0,
      \`final_payment_status\` enum('pending','paid') NOT NULL DEFAULT 'pending',
      \`final_paid_at\` datetime,
      \`status\` enum('pending','engineer_assigned','engineer_confirmed','under_inspection','quote_submitted','quote_approved','quote_accepted','advance_due','advance_paid','in_progress','report_submitted','report_approved','final_payment_due','completed','reviewed','cancelled') NOT NULL DEFAULT 'pending',
      \`assigned_at\` datetime,
      \`confirmed_at\` datetime,
      \`quote_submitted_at\` datetime,
      \`quote_approved_at\` datetime,
      \`quote_accepted_at\` datetime,
      \`report_approved_at\` datetime,
      \`completed_at\` datetime,
      \`payment_completed_at\` datetime,
      \`cancellation_reason\` text,
      \`cancelled_at\` datetime,
      \`cancelled_by\` varchar(36),
      \`cancelled_by_type\` enum('admin','facility','technician'),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_request_facility_idx\` (\`facility_id\`),
      KEY \`maintenance_request_equipment_idx\` (\`equipment_id\`),
      KEY \`maintenance_request_technician_idx\` (\`assigned_technician_id\`),
      KEY \`maintenance_request_status_idx\` (\`status\`),
      KEY \`maintenance_request_number_idx\` (\`request_number\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_requests table')

  // Create maintenance_quotes table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_quotes\` (
      \`id\` varchar(36) NOT NULL,
      \`maintenance_request_id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36) NOT NULL,
      \`description\` text,
      \`base_fee\` decimal(12,2) DEFAULT 0,
      \`parts_cost\` decimal(12,2) DEFAULT 0,
      \`labor_hours\` decimal(10,2) DEFAULT 0,
      \`hourly_rate\` decimal(10,2) DEFAULT 0,
      \`total_cost\` decimal(12,2) DEFAULT 0,
      \`estimated_completion_time\` varchar(255),
      \`admin_approved\` tinyint(1) DEFAULT 0,
      \`admin_approved_at\` datetime,
      \`facility_accepted\` tinyint(1) DEFAULT 0,
      \`facility_accepted_at\` datetime,
      \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      \`admin_notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_quote_request_idx\` (\`maintenance_request_id\`),
      KEY \`maintenance_quote_technician_idx\` (\`technician_id\`),
      KEY \`maintenance_quote_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_quotes table')

  // Create maintenance_quote_items table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_quote_items\` (
      \`id\` varchar(36) NOT NULL,
      \`maintenance_quote_id\` varchar(36) NOT NULL,
      \`item_name\` varchar(255) NOT NULL,
      \`item_type\` enum('examination','parts','labor') NOT NULL,
      \`quantity\` decimal(10,2) NOT NULL DEFAULT 1,
      \`unit_price\` decimal(12,2) NOT NULL DEFAULT 0,
      \`total_price\` decimal(12,2) NOT NULL DEFAULT 0,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_quote_item_quote_idx\` (\`maintenance_quote_id\`),
      KEY \`maintenance_quote_item_type_idx\` (\`item_type\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_quote_items table')

  // Create maintenance_reports table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_reports\` (
      \`id\` varchar(36) NOT NULL,
      \`maintenance_request_id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36) NOT NULL,
      \`work_description\` text NOT NULL,
      \`parts_used\` text,
      \`recommendations\` text,
      \`completion_images\` text,
      \`work_started_at\` datetime,
      \`work_completed_at\` datetime,
      \`hours_worked\` decimal(10,2),
      \`admin_reviewed\` tinyint(1) DEFAULT 0,
      \`admin_approved\` tinyint(1) DEFAULT 0,
      \`admin_reviewed_at\` datetime,
      \`admin_comments\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_report_request_idx\` (\`maintenance_request_id\`),
      KEY \`maintenance_report_technician_idx\` (\`technician_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_reports table')

  // Create maintenance_reviews table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_reviews\` (
      \`id\` varchar(36) NOT NULL,
      \`maintenance_request_id\` varchar(36) NOT NULL,
      \`reviewer_id\` varchar(36) NOT NULL,
      \`reviewer_type\` enum('facility','technician') NOT NULL,
      \`reviewed_id\` varchar(36) NOT NULL,
      \`reviewed_type\` enum('facility','technician') NOT NULL,
      \`rating\` int NOT NULL DEFAULT 0,
      \`comment\` text,
      \`review_aspects\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_review_request_idx\` (\`maintenance_request_id\`),
      KEY \`maintenance_review_reviewer_idx\` (\`reviewer_id\`),
      KEY \`maintenance_review_reviewed_idx\` (\`reviewed_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_reviews table')

  // Create equipment_buybacks table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`equipment_buybacks\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36),
      \`equipment_name\` varchar(255) NOT NULL,
      \`brand\` varchar(255),
      \`model\` varchar(255),
      \`serial_number\` varchar(255),
      \`purchase_date\` datetime,
      \`age_years\` decimal(5,2),
      \`buyback_condition\` enum('excellent','good','fair','poor') NOT NULL DEFAULT 'good',
      \`buyback_functional_status\` enum('fully_functional','partially_functional','not_functional') NOT NULL DEFAULT 'fully_functional',
      \`has_warranty\` tinyint(1) NOT NULL DEFAULT 0,
      \`warranty_expiry\` datetime,
      \`has_documentation\` tinyint(1) NOT NULL DEFAULT 0,
      \`issue_description\` text,
      \`reason_for_sale\` varchar(255),
      \`expected_price\` decimal(12,2),
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`buyback_status\` enum('draft','submitted','under_review','offer_sent','accepted','rejected','pickup_scheduled','received','refurbishing','completed') NOT NULL DEFAULT 'submitted',
      \`admin_notes\` text,
      \`quote_amount\` decimal(12,2),
      \`quote_currency\` varchar(10),
      \`quote_expires_at\` datetime,
      \`pickup_date\` datetime,
      \`payout_amount\` decimal(12,2),
      \`payout_date\` datetime,
      \`impact_weight_kg\` decimal(8,2),
      \`created_by\` varchar(36),
      \`updated_by\` varchar(36),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`equipment_buybacks_facility_idx\` (\`facility_id\`),
      KEY \`equipment_buybacks_status_idx\` (\`buyback_status\`),
      KEY \`equipment_buybacks_equipment_idx\` (\`equipment_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created equipment_buybacks table')

  // Create equipment_buyback_photos table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`equipment_buyback_photos\` (
      \`id\` varchar(36) NOT NULL,
      \`buyback_id\` varchar(36) NOT NULL,
      \`url\` text NOT NULL,
      \`caption\` varchar(255),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`equipment_buyback_photos_buyback_idx\` (\`buyback_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created equipment_buyback_photos table')

  // Create refurbishment_jobs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`refurbishment_jobs\` (
      \`id\` varchar(36) NOT NULL,
      \`buyback_id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36),
      \`title\` varchar(255) NOT NULL,
      \`refurb_status\` enum('planned','in_progress','on_hold','completed','cancelled') NOT NULL DEFAULT 'planned',
      \`refurb_priority\` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
      \`start_date\` datetime,
      \`estimated_completion\` datetime,
      \`completed_at\` datetime,
      \`parts_cost\` decimal(12,2) DEFAULT 0,
      \`labor_cost\` decimal(12,2) DEFAULT 0,
      \`notes\` text,
      \`findings\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`refurbishment_jobs_buyback_idx\` (\`buyback_id\`),
      KEY \`refurbishment_jobs_technician_idx\` (\`technician_id\`),
      KEY \`refurbishment_jobs_status_idx\` (\`refurb_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created refurbishment_jobs table')

  // Create resale_inventory table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`resale_inventory\` (
      \`id\` varchar(36) NOT NULL,
      \`refurbishment_job_id\` varchar(36) NOT NULL,
      \`sku\` varchar(50),
      \`equipment_name\` varchar(255) NOT NULL,
      \`brand\` varchar(255),
      \`model\` varchar(255),
      \`resale_condition\` enum('excellent','good','fair') NOT NULL DEFAULT 'good',
      \`resale_status\` enum('draft','listed','reserved','sold','retired') NOT NULL DEFAULT 'draft',
      \`list_price\` decimal(12,2),
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`reserved_by_facility_id\` varchar(36),
      \`reserved_at\` datetime,
      \`sold_at\` datetime,
      \`sale_price\` decimal(12,2),
      \`projected_margin\` decimal(12,2),
      \`margin_percentage\` decimal(5,2),
      \`warranty_months\` int,
      \`notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`resale_inventory_job_idx\` (\`refurbishment_job_id\`),
      KEY \`resale_inventory_status_idx\` (\`resale_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created resale_inventory table')

  // Create spare_parts table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`spare_parts\` (
      \`id\` varchar(36) NOT NULL,
      \`sku\` varchar(50) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`category\` varchar(100),
      \`manufacturer\` varchar(255),
      \`specification\` text,
      \`unit_cost\` decimal(12,2) NOT NULL DEFAULT 0,
      \`quantity_on_hand\` int NOT NULL DEFAULT 0,
      \`reorder_level\` int NOT NULL DEFAULT 5,
      \`storage_location\` varchar(100),
      \`lead_time_days\` int,
      \`last_restocked_at\` datetime,
      \`supplier_name\` varchar(255),
      \`supplier_contact\` varchar(255),
      \`part_status\` enum('active','inactive','discontinued') NOT NULL DEFAULT 'active',
      \`metadata\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`spare_parts_sku_idx\` (\`sku\`),
      KEY \`spare_parts_category_idx\` (\`category\`),
      KEY \`spare_parts_status_idx\` (\`part_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created spare_parts table')

  // Create part_orders table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`part_orders\` (
      \`id\` varchar(36) NOT NULL,
      \`part_id\` varchar(36) NOT NULL,
      \`requested_by_id\` varchar(36),
      \`part_requester_type\` enum('technician','admin','system') NOT NULL DEFAULT 'technician',
      \`maintenance_request_id\` varchar(36),
      \`quantity\` int NOT NULL DEFAULT 1,
      \`unit_price\` decimal(12,2),
      \`total_price\` decimal(12,2),
      \`part_order_status\` enum('draft','pending_approval','approved','rejected','ordered','received','cancelled') NOT NULL DEFAULT 'pending_approval',
      \`part_order_priority\` enum('low','medium','high') NOT NULL DEFAULT 'medium',
      \`needed_by\` datetime,
      \`approved_by_id\` varchar(36),
      \`approved_at\` datetime,
      \`received_at\` datetime,
      \`vendor_name\` varchar(255),
      \`tracking_number\` varchar(255),
      \`notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`part_orders_part_idx\` (\`part_id\`),
      KEY \`part_orders_status_idx\` (\`part_order_status\`),
      KEY \`part_orders_maintenance_idx\` (\`maintenance_request_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created part_orders table')

  // Create technician_disbursements table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`technician_disbursements\` (
      \`id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36) NOT NULL,
      \`period_start\` datetime NOT NULL,
      \`period_end\` datetime NOT NULL,
      \`total_amount\` decimal(12,2) NOT NULL,
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`disbursement_status\` enum('draft','pending','approved','processing','paid','failed') NOT NULL DEFAULT 'draft',
      \`payment_method\` varchar(50),
      \`transaction_reference\` varchar(255),
      \`paid_at\` datetime,
      \`notes\` text,
      \`created_by\` varchar(36),
      \`updated_by\` varchar(36),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`technician_disbursements_technician_idx\` (\`technician_id\`),
      KEY \`technician_disbursements_status_idx\` (\`disbursement_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created technician_disbursements table')

  // Create equipment_health_scores table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`equipment_health_scores\` (
      \`id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`overall_score\` decimal(5,2) NOT NULL,
      \`health_condition_rating\` enum('excellent','good','fair','poor') NOT NULL DEFAULT 'good',
      \`health_risk_level\` enum('low','moderate','high','critical') NOT NULL DEFAULT 'low',
      \`utilization_rate\` decimal(5,2),
      \`uptime_percentage\` decimal(5,2),
      \`downtime_hours\` decimal(8,2),
      \`issues_detected\` text,
      \`recommendations\` text,
      \`next_inspection_date\` datetime,
      \`last_assessment_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`created_by\` varchar(36),
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`equipment_health_scores_equipment_idx\` (\`equipment_id\`),
      KEY \`equipment_health_scores_facility_idx\` (\`facility_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created equipment_health_scores table')

  // Create equipment_service_events table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`equipment_service_events\` (
      \`id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`maintenance_request_id\` varchar(36),
      \`equipment_event_type\` enum('maintenance_request','preventive_maintenance','calibration','inspection','repair','upgrade','decommissioned') NOT NULL,
      \`title\` varchar(255) NOT NULL,
      \`description\` text,
      \`event_date\` datetime NOT NULL,
      \`performed_by\` varchar(255),
      \`documents\` text,
      \`metrics\` text,
      \`next_action_date\` datetime,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`equipment_service_events_equipment_idx\` (\`equipment_id\`),
      KEY \`equipment_service_events_facility_idx\` (\`facility_id\`),
      KEY \`equipment_service_events_type_idx\` (\`equipment_event_type\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created equipment_service_events table')

  // Create maintenance_plans table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plans\` (
      \`id\` varchar(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`description\` text,
      \`tier\` enum('starter','standard','premium','enterprise') NOT NULL DEFAULT 'standard',
      \`monthly_price\` decimal(12,2) NOT NULL,
      \`annual_price\` decimal(12,2),
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`response_time_hours\` int,
      \`visits_per_year\` int,
      \`coverage_description\` text,
      \`includes_parts\` tinyint(1) NOT NULL DEFAULT 0,
      \`includes_loaner_equipment\` tinyint(1) NOT NULL DEFAULT 0,
      \`includes_24x7_support\` tinyint(1) NOT NULL DEFAULT 0,
      \`maintenance_plan_status\` enum('active','inactive') NOT NULL DEFAULT 'active',
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plans_tier_idx\` (\`tier\`),
      KEY \`maintenance_plans_status_idx\` (\`maintenance_plan_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plans table')

  // Create facility_maintenance_plans table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`facility_maintenance_plans\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`plan_id\` varchar(36) NOT NULL,
      \`facility_plan_status\` enum('active','pending','suspended','expired','cancelled') NOT NULL DEFAULT 'pending',
      \`start_date\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`end_date\` datetime,
      \`maintenance_billing_cycle\` enum('monthly','quarterly','annual') NOT NULL DEFAULT 'monthly',
      \`last_payment_date\` datetime,
      \`next_payment_date\` datetime,
      \`auto_renew\` tinyint(1) NOT NULL DEFAULT 1,
      \`notes\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`facility_maintenance_plans_facility_idx\` (\`facility_id\`),
      KEY \`facility_maintenance_plans_plan_idx\` (\`plan_id\`),
      KEY \`facility_maintenance_plans_status_idx\` (\`facility_plan_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created facility_maintenance_plans table')

  // Create maintenance_plan_visits table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_visits\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_plan_id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36),
      \`visit_type\` enum('preventive','inspection','training','audit') NOT NULL,
      \`visit_status\` enum('scheduled','in_progress','completed','missed','rescheduled','cancelled') NOT NULL DEFAULT 'scheduled',
      \`scheduled_date\` datetime NOT NULL,
      \`completed_date\` datetime,
      \`summary\` text,
      \`findings\` text,
      \`follow_up_actions\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plan_visits_facility_plan_idx\` (\`facility_plan_id\`),
      KEY \`maintenance_plan_visits_technician_idx\` (\`technician_id\`),
      KEY \`maintenance_plan_visits_status_idx\` (\`visit_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plan_visits table')

  // Create maintenance_plan_requests table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_requests\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`request_number\` varchar(50) NOT NULL UNIQUE,
      \`status\` enum('pending','technician_assigned','evaluation_in_progress','proposal_submitted','admin_approved','facility_approved','facility_rejected','payment_pending','payment_confirmed','active','cancelled') NOT NULL DEFAULT 'pending',
      \`assigned_technician_id\` varchar(36) NULL,
      \`assigned_at\` datetime NULL,
      \`proposal_submitted_at\` datetime NULL,
      \`admin_approved_at\` datetime NULL,
      \`admin_approved_by\` varchar(36) NULL,
      \`facility_approved_at\` datetime NULL,
      \`facility_rejected_at\` datetime NULL,
      \`facility_rejection_reason\` text NULL,
      \`notes\` text NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plan_requests_facility_idx\` (\`facility_id\`),
      KEY \`maintenance_plan_requests_technician_idx\` (\`assigned_technician_id\`),
      KEY \`maintenance_plan_requests_status_idx\` (\`status\`),
      KEY \`maintenance_plan_requests_number_idx\` (\`request_number\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plan_requests table')

  // Create maintenance_plan_request_equipment table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_request_equipment\` (
      \`id\` varchar(36) NOT NULL,
      \`request_id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36) NOT NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plan_request_equipment_request_idx\` (\`request_id\`),
      KEY \`maintenance_plan_request_equipment_equipment_idx\` (\`equipment_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plan_request_equipment table')

  // Create maintenance_plan_proposals table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_proposals\` (
      \`id\` varchar(36) NOT NULL,
      \`request_id\` varchar(36) NOT NULL,
      \`technician_id\` varchar(36) NOT NULL,
      \`total_cost\` decimal(12,2) NOT NULL,
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`proposal_notes\` text NULL,
      \`status\` enum('draft','submitted','admin_approved','admin_rejected','facility_approved','facility_rejected') NOT NULL DEFAULT 'draft',
      \`submitted_at\` datetime NULL,
      \`admin_approved_at\` datetime NULL,
      \`admin_approved_by\` varchar(36) NULL,
      \`admin_rejection_reason\` text NULL,
      \`facility_approved_at\` datetime NULL,
      \`facility_rejected_at\` datetime NULL,
      \`facility_rejection_reason\` text NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plan_proposals_request_idx\` (\`request_id\`),
      KEY \`maintenance_plan_proposals_technician_idx\` (\`technician_id\`),
      KEY \`maintenance_plan_proposals_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plan_proposals table')

  // Create maintenance_plan_proposal_items table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_proposal_items\` (
      \`id\` varchar(36) NOT NULL,
      \`proposal_id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36) NOT NULL,
      \`maintenance_type\` enum('preventive','corrective','inspection','calibration','full_service') NOT NULL,
      \`schedule_type\` enum('per_year','per_service','monthly','quarterly','custom') NOT NULL,
      \`visits_per_year\` int NULL,
      \`price_per_service\` decimal(12,2) NULL,
      \`price_per_year\` decimal(12,2) NULL,
      \`total_cost\` decimal(12,2) NOT NULL,
      \`duration_months\` int NULL,
      \`start_date\` datetime NULL,
      \`end_date\` datetime NULL,
      \`includes_parts\` tinyint(1) NOT NULL DEFAULT 0,
      \`includes_emergency_support\` tinyint(1) NOT NULL DEFAULT 0,
      \`response_time_hours\` int NULL,
      \`description\` text NULL,
      \`notes\` text NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plan_proposal_items_proposal_idx\` (\`proposal_id\`),
      KEY \`maintenance_plan_proposal_items_equipment_idx\` (\`equipment_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plan_proposal_items table')

  // Create maintenance_plan_payments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_payments\` (
      \`id\` varchar(36) NOT NULL,
      \`proposal_id\` varchar(36) NOT NULL,
      \`request_id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`payment_type\` enum('half','full') NOT NULL,
      \`amount\` decimal(12,2) NOT NULL,
      \`total_amount\` decimal(12,2) NOT NULL,
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`payment_method\` varchar(50) NULL,
      \`transaction_id\` varchar(255) NULL,
      \`payment_status\` enum('pending','paid','confirmed','failed','refunded') NOT NULL DEFAULT 'pending',
      \`paid_at\` datetime NULL,
      \`confirmed_at\` datetime NULL,
      \`confirmed_by\` varchar(36) NULL,
      \`admin_notes\` text NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`maintenance_plan_payments_proposal_idx\` (\`proposal_id\`),
      KEY \`maintenance_plan_payments_request_idx\` (\`request_id\`),
      KEY \`maintenance_plan_payments_facility_idx\` (\`facility_id\`),
      KEY \`maintenance_plan_payments_status_idx\` (\`payment_status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created maintenance_plan_payments table')

  // Create maintenance_plan_status_history table for audit trail
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`maintenance_plan_status_history\` (
      \`id\` VARCHAR(36) PRIMARY KEY,
      \`request_id\` VARCHAR(36),
      \`proposal_id\` VARCHAR(36),
      \`payment_id\` VARCHAR(36),
      \`entity_type\` ENUM('request', 'proposal', 'payment') NOT NULL,
      \`previous_status\` VARCHAR(50),
      \`new_status\` VARCHAR(50) NOT NULL,
      \`changed_by\` VARCHAR(36) NOT NULL,
      \`changed_by_role\` ENUM('admin', 'facility', 'technician') NOT NULL,
      \`changed_by_name\` VARCHAR(255),
      \`reason\` TEXT,
      \`metadata\` TEXT,
      \`ip_address\` VARCHAR(100),
      \`user_agent\` VARCHAR(255),
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`maintenance_plan_history_request_idx\` (\`request_id\`),
      INDEX \`maintenance_plan_history_proposal_idx\` (\`proposal_id\`),
      INDEX \`maintenance_plan_history_payment_idx\` (\`payment_id\`),
      INDEX \`maintenance_plan_history_entity_type_idx\` (\`entity_type\`),
      INDEX \`maintenance_plan_history_changed_by_idx\` (\`changed_by\`),
      INDEX \`maintenance_plan_history_created_idx\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('✅ Created maintenance_plan_status_history table')

  // Create equipment_assessments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`equipment_assessments\` (
      \`id\` varchar(36) NOT NULL,
      \`equipment_id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`assessment_type\` enum('initial','routine','compliance','risk') NOT NULL DEFAULT 'initial',
      \`assessment_result\` enum('pass','monitor','maintenance_required','critical') NOT NULL DEFAULT 'pass',
      \`score\` decimal(5,2),
      \`summary\` text,
      \`findings\` text,
      \`recommendations\` text,
      \`next_steps\` text,
      \`assessed_by\` varchar(255),
      \`assessed_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`equipment_assessments_equipment_idx\` (\`equipment_id\`),
      KEY \`equipment_assessments_facility_idx\` (\`facility_id\`),
      KEY \`equipment_assessments_type_idx\` (\`assessment_type\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created equipment_assessments table')

  // ============================================
  // BOOKING SYSTEM TABLES
  // ============================================

  // Create departments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`departments\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`description\` text,
      \`is_active\` boolean NOT NULL DEFAULT true,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`department_facility_idx\` (\`facility_id\`),
      KEY \`department_is_active_idx\` (\`is_active\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created departments table')

  // Create doctors table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`doctors\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`department_id\` varchar(36),
      \`full_name\` varchar(255) NOT NULL,
      \`specialty\` varchar(255) NOT NULL,
      \`bio\` text,
      \`phone\` varchar(255),
      \`email\` varchar(255),
      \`photo_url\` varchar(255),
      \`is_active\` boolean NOT NULL DEFAULT true,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`doctor_facility_idx\` (\`facility_id\`),
      KEY \`doctor_department_idx\` (\`department_id\`),
      KEY \`doctor_is_active_idx\` (\`is_active\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created doctors table')

  // Create doctor_time_slots table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`doctor_time_slots\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`doctor_id\` varchar(36) NOT NULL,
      \`starts_at\` datetime NOT NULL,
      \`ends_at\` datetime NOT NULL,
      \`capacity\` int NOT NULL DEFAULT 1,
      \`status\` enum('available','blocked','booked','cancelled') NOT NULL DEFAULT 'available',
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`time_slot_facility_idx\` (\`facility_id\`),
      KEY \`time_slot_doctor_idx\` (\`doctor_id\`),
      KEY \`time_slot_status_idx\` (\`status\`),
      KEY \`time_slot_starts_at_idx\` (\`starts_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created doctor_time_slots table')

  // Create patients table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`patients\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`full_name\` varchar(255) NOT NULL,
      \`phone\` varchar(255) NOT NULL,
      \`email\` varchar(255),
      \`date_of_birth\` date,
      \`gender\` enum('male','female','other'),
      \`first_visit\` boolean NOT NULL DEFAULT true,
      \`opted_in_whatsapp\` boolean NOT NULL DEFAULT false,
      \`opted_in_sms\` boolean NOT NULL DEFAULT false,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`patient_facility_idx\` (\`facility_id\`),
      KEY \`patient_phone_idx\` (\`phone\`),
      KEY \`patient_facility_phone_idx\` (\`facility_id\`, \`phone\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created patients table')

  // Create appointments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`appointments\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`department_id\` varchar(36) NOT NULL,
      \`doctor_id\` varchar(36) NOT NULL,
      \`patient_id\` varchar(36) NOT NULL,
      \`time_slot_id\` varchar(36) NOT NULL,
      \`status\` enum('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending',
      \`source\` enum('web','whatsapp') NOT NULL DEFAULT 'web',
      \`notes\` text,
      \`ai_intake_summary_id\` varchar(36),
      \`appointment_number\` varchar(255) NOT NULL,
      \`access_code\` varchar(6) NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`appointment_facility_idx\` (\`facility_id\`),
      KEY \`appointment_department_idx\` (\`department_id\`),
      KEY \`appointment_doctor_idx\` (\`doctor_id\`),
      KEY \`appointment_patient_idx\` (\`patient_id\`),
      KEY \`appointment_time_slot_idx\` (\`time_slot_id\`),
      KEY \`appointment_status_idx\` (\`status\`),
      KEY \`appointment_number_idx\` (\`appointment_number\`),
      KEY \`appointment_access_code_idx\` (\`access_code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created appointments table')
  
  // Add access_code column to existing appointments table if it doesn't exist
  try {
    const [appointmentColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'access_code'
    `, [dbName])
    
    if ((appointmentColumns as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE \`appointments\` 
        ADD COLUMN \`access_code\` varchar(6) NULL AFTER \`appointment_number\`
      `)
      await connection.query(`
        ALTER TABLE \`appointments\` 
        ADD INDEX \`appointment_access_code_idx\` (\`access_code\`)
      `)
      // Update existing appointments to have access codes
      await connection.query(`
        UPDATE \`appointments\`
        SET \`access_code\` = UPPER(RIGHT(\`appointment_number\`, 6))
        WHERE \`access_code\` IS NULL
      `)
      console.log('✅ Added access_code column to appointments table')
    }
  } catch (error: any) {
    console.warn('⚠️  Could not add access_code column:', error.message)
  }

  // Create ai_intake_summaries table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`ai_intake_summaries\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`appointment_id\` varchar(36) NOT NULL,
      \`raw_conversation\` text,
      \`structured_summary\` text NOT NULL,
      \`model_name\` varchar(255) NOT NULL,
      \`tokens_used\` int NOT NULL DEFAULT 0,
      \`collected_via\` enum('web','whatsapp') NOT NULL DEFAULT 'web',
      \`status\` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
      \`error_message\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`ai_intake_facility_idx\` (\`facility_id\`),
      KEY \`ai_intake_appointment_idx\` (\`appointment_id\`),
      KEY \`ai_intake_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created ai_intake_summaries table')

  // Create communication_logs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`communication_logs\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`appointment_id\` varchar(36),
      \`channel\` enum('whatsapp','sms') NOT NULL DEFAULT 'whatsapp',
      \`direction\` enum('outbound','inbound') NOT NULL DEFAULT 'outbound',
      \`to_number\` varchar(255) NOT NULL,
      \`template_name\` varchar(255),
      \`payload\` text NOT NULL,
      \`status\` enum('queued','sent','delivered','failed') NOT NULL DEFAULT 'queued',
      \`provider_message_id\` varchar(255),
      \`error_message\` text,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`communication_log_facility_idx\` (\`facility_id\`),
      KEY \`communication_log_appointment_idx\` (\`appointment_id\`),
      KEY \`communication_log_status_idx\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created communication_logs table')

  // Create visits table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`visits\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`visit_type\` enum('standalone','widget') NOT NULL DEFAULT 'standalone',
      \`referrer\` varchar(500),
      \`user_agent\` varchar(500),
      \`ip_address\` varchar(100),
      \`session_id\` varchar(255),
      \`selected_department\` boolean NOT NULL DEFAULT false,
      \`selected_doctor\` boolean NOT NULL DEFAULT false,
      \`selected_time_slot\` boolean NOT NULL DEFAULT false,
      \`confirmed_booking\` boolean NOT NULL DEFAULT false,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`visit_facility_idx\` (\`facility_id\`),
      KEY \`visit_session_idx\` (\`session_id\`),
      KEY \`visit_created_at_idx\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created visits table')

  // Create facility_feedback table
  // First, check if table exists and get the actual data type of facilities.id
  try {
    const [facilityIdInfo]: any = await connection.query(`
      SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'id'
    `, [dbName])

    // Create table without foreign keys first
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`facility_feedback\` (
        \`id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`appointment_id\` varchar(36) NULL,
        \`feedback_number\` varchar(255) NOT NULL,
        \`user_role\` enum('patient','visitor','relative','caregiver') NOT NULL,
        \`phone_number\` varchar(255) NULL,
        \`service_department\` varchar(255) NULL,
        \`feedback_types\` text NOT NULL,
        \`detailed_feedback\` text NOT NULL,
        \`ratings\` text NULL,
        \`overall_experience\` int NULL,
        \`staff_friendliness\` int NULL,
        \`wait_time\` int NULL,
        \`cleanliness\` int NULL,
        \`communication\` int NULL,
        \`treatment_quality\` int NULL,
        \`facility_comfort\` int NULL,
        \`is_attended\` tinyint(1) NOT NULL DEFAULT 0,
        \`internal_notes\` text NULL,
        \`attended_at\` datetime NULL,
        \`attended_by\` varchar(36) NULL,
        \`ip_address\` varchar(255) NULL,
        \`user_agent\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`feedback_number\` (\`feedback_number\`),
        KEY \`feedback_facility_idx\` (\`facility_id\`),
        KEY \`feedback_appointment_idx\` (\`appointment_id\`),
        KEY \`feedback_number_idx\` (\`feedback_number\`),
        KEY \`feedback_is_attended_idx\` (\`is_attended\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created facility_feedback table')

    // Now try to add foreign keys if they don't exist
    if (facilityIdInfo && facilityIdInfo.length > 0) {
      // Check if foreign key already exists
      const [existingFKs]: any = await connection.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'facility_feedback'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
          AND CONSTRAINT_NAME = 'facility_feedback_ibfk_1'
      `, [dbName])

      if (existingFKs.length === 0) {
        try {
          await connection.query(`
            ALTER TABLE \`facility_feedback\`
            ADD CONSTRAINT \`facility_feedback_ibfk_1\`
            FOREIGN KEY (\`facility_id\`) REFERENCES \`facilities\` (\`id\`) ON DELETE CASCADE
          `)
          console.log('✅ Added facility_id foreign key')
        } catch (fkError: any) {
          if (fkError.code !== 'ER_DUP_KEY') {
            console.warn('⚠️  Could not add facility_id foreign key:', fkError.message)
          }
        }
      }

      // Check if appointment foreign key exists
      const [existingAppFKs]: any = await connection.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'facility_feedback'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
          AND CONSTRAINT_NAME = 'facility_feedback_ibfk_2'
      `, [dbName])

      if (existingAppFKs.length === 0) {
        try {
          await connection.query(`
            ALTER TABLE \`facility_feedback\`
            ADD CONSTRAINT \`facility_feedback_ibfk_2\`
            FOREIGN KEY (\`appointment_id\`) REFERENCES \`appointments\` (\`id\`) ON DELETE SET NULL
          `)
          console.log('✅ Added appointment_id foreign key')
        } catch (fkError: any) {
          if (fkError.code !== 'ER_DUP_KEY') {
            console.warn('⚠️  Could not add appointment_id foreign key:', fkError.message)
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error creating facility_feedback table:', error.message)
    // Continue anyway - table might already exist
  }

  // Create feature_requests table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`feature_requests\` (
        \`id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`service_name\` varchar(50) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`description\` text NOT NULL,
        \`priority\` varchar(20) DEFAULT 'medium',
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`admin_notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`feature_request_facility_idx\` (\`facility_id\`),
        KEY \`feature_request_service_idx\` (\`service_name\`),
        KEY \`feature_request_status_idx\` (\`status\`),
        KEY \`feature_request_facility_service_idx\` (\`facility_id\`, \`service_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created feature_requests table')

    // Try to add foreign key if it doesn't exist
    const [existingFKs]: any = await connection.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'feature_requests'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND CONSTRAINT_NAME = 'feature_requests_facility_fk'
    `, [dbName])

    if (existingFKs.length === 0) {
      try {
        await connection.query(`
          ALTER TABLE \`feature_requests\`
          ADD CONSTRAINT \`feature_requests_facility_fk\`
          FOREIGN KEY (\`facility_id\`) REFERENCES \`facilities\` (\`id\`) ON DELETE CASCADE
        `)
        console.log('✅ Added facility_id foreign key to feature_requests')
      } catch (fkError: any) {
        if (fkError.code !== 'ER_DUP_KEY') {
          console.warn('⚠️  Could not add facility_id foreign key to feature_requests:', fkError.message)
        }
      }
    }
  } catch (error: any) {
    console.error('Error creating feature_requests table:', error.message)
    // Continue anyway - table might already exist
  }

  // Add referral columns to facilities table
  try {
    const [referralCodeColumn]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'referral_code'
    `, [dbName])

    if (referralCodeColumn[0].count === 0) {
      // TiDB doesn't support UNIQUE constraint in ADD COLUMN, so add column first
      await connection.query(`
        ALTER TABLE \`facilities\`
        ADD COLUMN \`referral_code\` varchar(20) NULL COMMENT 'Unique referral code for this facility' AFTER \`invitation_expires\`
      `)
      
      // Then add UNIQUE constraint separately
      try {
        await connection.query(`
          ALTER TABLE \`facilities\`
          ADD UNIQUE KEY \`facility_referral_code_unique\` (\`referral_code\`)
        `)
      } catch (uniqueError: any) {
        // Unique constraint might already exist, that's OK
        if (uniqueError.code !== 'ER_DUP_KEYNAME' && uniqueError.code !== 'ER_DUP_ENTRY') {
          console.warn('⚠️  Could not add UNIQUE constraint on referral_code:', uniqueError.message)
        }
      }
      
      console.log('✅ Added referral_code column to facilities table')
    }

    const [referredByColumn]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'referred_by'
    `, [dbName])

    if (referredByColumn[0].count === 0) {
      await connection.query(`
        ALTER TABLE \`facilities\`
        ADD COLUMN \`referred_by\` varchar(36) NULL COMMENT 'ID of facility that referred this one' AFTER \`referral_code\`
      `)
      console.log('✅ Added referred_by column to facilities table')
    }

    const [benefitAppliedColumn]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'referral_benefit_applied'
    `, [dbName])

    if (benefitAppliedColumn[0].count === 0) {
      await connection.query(`
        ALTER TABLE \`facilities\`
        ADD COLUMN \`referral_benefit_applied\` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether referral benefit has been applied' AFTER \`referred_by\`
      `)
      console.log('✅ Added referral_benefit_applied column to facilities table')
    }

    // Generate referral codes for existing facilities that don't have one
    try {
      const [facilitiesWithoutCode]: any = await connection.query(`
        SELECT id FROM \`facilities\` WHERE \`referral_code\` IS NULL
      `)
      
      for (const facility of facilitiesWithoutCode) {
        try {
          const facilityId = facility.id.replace(/-/g, '')
          const referralCode = 'REF' + facilityId.substring(0, 8).padStart(8, '0')
          await connection.query(`
            UPDATE \`facilities\`
            SET \`referral_code\` = ?
            WHERE \`id\` = ? AND \`referral_code\` IS NULL
          `, [referralCode, facility.id])
        } catch (updateError: any) {
          // If UNIQUE constraint violation, try with a different suffix
          if (updateError.code === 'ER_DUP_ENTRY') {
            const facilityId = facility.id.replace(/-/g, '')
            const referralCode = 'REF' + facilityId.substring(0, 7) + Math.floor(Math.random() * 10)
            try {
              await connection.query(`
                UPDATE \`facilities\`
                SET \`referral_code\` = ?
                WHERE \`id\` = ? AND \`referral_code\` IS NULL
              `, [referralCode, facility.id])
            } catch (retryError: any) {
              // Skip if still fails
            }
          }
        }
      }
      console.log('✅ Generated referral codes for existing facilities')
    } catch (error: any) {
      console.warn('⚠️  Could not generate referral codes:', error.message)
    }
  } catch (error: any) {
    console.error('Error adding referral columns to facilities:', error.message)
  }

  // Create facility_referrals table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`facility_referrals\` (
        \`id\` varchar(36) NOT NULL,
        \`referrer_facility_id\` varchar(36) NOT NULL,
        \`referred_facility_id\` varchar(36) NOT NULL,
        \`referral_code\` varchar(20) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`benefit_approved\` tinyint(1) NOT NULL DEFAULT 0,
        \`benefit_approved_by\` varchar(36) NULL,
        \`benefit_approved_at\` datetime NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`referral_referrer_idx\` (\`referrer_facility_id\`),
        KEY \`referral_referred_idx\` (\`referred_facility_id\`),
        KEY \`referral_code_idx\` (\`referral_code\`),
        KEY \`referral_status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created facility_referrals table')
  } catch (error: any) {
    console.error('Error creating facility_referrals table:', error.message)
  }

  // Add commission_percentage column to maintenance_requests
  try {
    const [columns]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'maintenance_requests'
        AND COLUMN_NAME = 'commission_percentage'
    `, [dbName])

    if (columns[0].count === 0) {
      await connection.query(`
        ALTER TABLE \`maintenance_requests\`
        ADD COLUMN \`commission_percentage\` DECIMAL(5, 2) NULL COMMENT 'Commission percentage (0-100)' AFTER \`assigned_technician_id\`
      `)
      console.log('✅ Added commission_percentage column to maintenance_requests')
    } else {
      console.log('⚠ commission_percentage column already exists')
    }
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ commission_percentage column already exists')
    } else {
      console.error('Error adding commission_percentage column:', error.message)
    }
  }

  // Create technician_commissions table
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
  console.log('✅ Created technician_commissions table')

  // Create technician_withdrawals table
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
  console.log('✅ Created technician_withdrawals table')

  // Create service_access_payments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`service_access_payments\` (
      \`id\` varchar(36) NOT NULL,
      \`facility_id\` varchar(36) NOT NULL,
      \`service_name\` varchar(50) NOT NULL,
      \`amount\` decimal(12,2) NOT NULL,
      \`currency\` varchar(10) DEFAULT 'TZS',
      \`payment_method\` varchar(50) NULL,
      \`transaction_id\` varchar(255) NULL,
      \`status\` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
      \`paid_at\` datetime NULL,
      \`package_id\` varchar(50) NULL,
      \`package_name\` varchar(255) NULL,
      \`payment_plan\` varchar(50) NULL,
      \`metadata\` text NULL,
      \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`service_access_payment_facility_idx\` (\`facility_id\`),
      KEY \`service_access_payment_service_idx\` (\`service_name\`),
      KEY \`service_access_payment_status_idx\` (\`status\`),
      KEY \`service_access_payment_facility_service_idx\` (\`facility_id\`, \`service_name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('✅ Created service_access_payments table')

  // Fix column name if it was created as payment_status instead of status
  try {
    await connection.query(`
      ALTER TABLE \`service_access_payments\` 
      CHANGE COLUMN \`payment_status\` \`status\` enum('pending','completed','failed') NOT NULL DEFAULT 'pending';
    `)
    console.log('✅ Fixed service_access_payments column name (payment_status -> status)')
  } catch (error: any) {
    // Column might already be named 'status' or doesn't exist, which is fine
    if (error.code !== 'ER_BAD_FIELD_ERROR' && error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.warn('Note: Could not rename payment_status column (this is OK if column is already named status):', error.message)
    }
  }

  // Add new columns for solar package selection if they don't exist
  const packageColumns = [
    { name: 'package_id', type: 'varchar(50) NULL', after: 'paid_at' },
    { name: 'package_name', type: 'varchar(255) NULL', after: 'package_id' },
    { name: 'payment_plan', type: 'varchar(50) NULL', after: 'package_name' },
    { name: 'metadata', type: 'text NULL', after: 'payment_plan' },
  ]

  for (const col of packageColumns) {
    try {
      await connection.query(`
        ALTER TABLE \`service_access_payments\`
        ADD COLUMN \`${col.name}\` ${col.type} AFTER \`${col.after}\`;
      `)
      console.log(`✅ Added ${col.name} column to service_access_payments table`)
    } catch (error: any) {
      // Column might already exist, which is fine
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log(`ℹ️  Column ${col.name} already exists, skipping`)
      } else {
        console.warn(`Note: Could not add ${col.name} column:`, error.message)
      }
    }
  }

  // ============================================
  // AFYA FINANCE TABLES
  // ============================================

  // Create tmda_medical_equipment_consumables table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`tmda_medical_equipment_consumables\` (
        \`id\` varchar(36) NOT NULL,
        \`brand_name\` varchar(255) NOT NULL,
        \`generic_name\` varchar(255) NOT NULL,
        \`gmdn_term\` varchar(500) NULL,
        \`intended_use\` text NULL,
        \`local_technical_representative\` varchar(255) NULL,
        \`manufacturer\` varchar(255) NULL,
        \`representative_contact\` varchar(255) NULL,
        \`representative_price\` decimal(12,2) NULL,
        \`category\` varchar(100) NULL,
        \`subcategory\` varchar(100) NULL,
        \`product_type\` varchar(50) NOT NULL DEFAULT 'equipment',
        \`is_visible_to_facilities\` tinyint(1) NOT NULL DEFAULT 0,
        \`admin_price\` decimal(12,2) NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'TZS',
        \`status\` varchar(20) NOT NULL DEFAULT 'pending_review',
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`tmda_me_brand_name_idx\` (\`brand_name\`),
        KEY \`tmda_me_generic_name_idx\` (\`generic_name\`),
        KEY \`tmda_me_category_idx\` (\`category\`),
        KEY \`tmda_me_subcategory_idx\` (\`subcategory\`),
        KEY \`tmda_me_status_idx\` (\`status\`),
        KEY \`tmda_me_visible_idx\` (\`is_visible_to_facilities\`),
        KEY \`tmda_me_manufacturer_idx\` (\`manufacturer\`),
        KEY \`tmda_me_product_type_idx\` (\`product_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created tmda_medical_equipment_consumables table')
  } catch (error: any) {
    console.error('Error creating tmda_medical_equipment_consumables table:', error.message)
  }

  // Create tmda_pharmaceutical_products table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`tmda_pharmaceutical_products\` (
        \`id\` varchar(36) NOT NULL,
        \`brand_name\` varchar(255) NOT NULL,
        \`generic_name\` varchar(255) NOT NULL,
        \`dosage_form\` varchar(100) NOT NULL,
        \`active_pharmaceutical_ingredients\` text NULL,
        \`product_strength\` varchar(255) NULL,
        \`local_technical_representative\` varchar(255) NULL,
        \`manufacturer\` varchar(255) NULL,
        \`representative_contact\` varchar(255) NULL,
        \`representative_price\` decimal(12,2) NULL,
        \`category\` varchar(100) NULL,
        \`subcategory\` varchar(100) NULL,
        \`is_visible_to_facilities\` tinyint(1) NOT NULL DEFAULT 0,
        \`admin_price\` decimal(12,2) NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'TZS',
        \`status\` varchar(20) NOT NULL DEFAULT 'pending_review',
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`tmda_brand_name_idx\` (\`brand_name\`),
        KEY \`tmda_generic_name_idx\` (\`generic_name\`),
        KEY \`tmda_category_idx\` (\`category\`),
        KEY \`tmda_subcategory_idx\` (\`subcategory\`),
        KEY \`tmda_status_idx\` (\`status\`),
        KEY \`tmda_visible_idx\` (\`is_visible_to_facilities\`),
        KEY \`tmda_manufacturer_idx\` (\`manufacturer\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created tmda_pharmaceutical_products table')
  } catch (error: any) {
    console.error('Error creating tmda_pharmaceutical_products table:', error.message)
  }

  // Create afya_finance_products table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_products\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`category\` varchar(100) NOT NULL,
        \`subcategory\` varchar(100) NULL,
        \`description\` text NULL,
        \`manufacturer\` varchar(255) NULL,
        \`tmda_product_id\` varchar(36) NULL,
        \`unit\` varchar(50) NOT NULL,
        \`unit_price\` decimal(12,2) NOT NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'TZS',
        \`min_order_quantity\` int NOT NULL DEFAULT 1,
        \`max_order_quantity\` int NULL,
        \`stock_available\` tinyint(1) NOT NULL DEFAULT 1,
        \`stock_quantity\` int NULL,
        \`image_url\` varchar(500) NULL,
        \`specifications\` text NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'active',
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`afp_category_idx\` (\`category\`),
        KEY \`afp_subcategory_idx\` (\`subcategory\`),
        KEY \`afp_status_idx\` (\`status\`),
        KEY \`afp_name_idx\` (\`name\`),
        KEY \`afp_tmda_product_idx\` (\`tmda_product_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_products table')
  } catch (error: any) {
    console.error('Error creating afya_finance_products table:', error.message)
  }

  // Create afya_finance_pools table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_pools\` (
        \`id\` varchar(36) NOT NULL,
        \`pool_number\` varchar(50) NOT NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`product_name\` varchar(255) NOT NULL,
        \`target_participants\` int NOT NULL,
        \`current_participants\` int NOT NULL DEFAULT 0,
        \`unit_price\` decimal(12,2) NOT NULL,
        \`discount_percentage\` decimal(5,2) NOT NULL DEFAULT '0.00',
        \`status\` varchar(20) NOT NULL DEFAULT 'open',
        \`closes_at\` datetime NOT NULL,
        \`delivery_hub_id\` varchar(36) NULL,
        \`delivery_region\` varchar(100) NULL,
        \`created_by\` varchar(36) NULL,
        \`fulfilled_at\` datetime NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`pool_number\` (\`pool_number\`),
        KEY \`afpool_number_idx\` (\`pool_number\`),
        KEY \`afpool_product_idx\` (\`product_id\`),
        KEY \`afpool_status_idx\` (\`status\`),
        KEY \`afpool_closes_at_idx\` (\`closes_at\`),
        KEY \`afpool_hub_idx\` (\`delivery_hub_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_pools table')
  } catch (error: any) {
    console.error('Error creating afya_finance_pools table:', error.message)
  }

  // Create afya_finance_pool_participants table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_pool_participants\` (
        \`id\` varchar(36) NOT NULL,
        \`pool_id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`quantity\` int NOT NULL,
        \`unit_price\` decimal(12,2) NOT NULL,
        \`total_amount\` decimal(12,2) NOT NULL,
        \`payment_method\` varchar(50) NULL,
        \`payment_status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`payment_transaction_id\` varchar(36) NULL,
        \`delivery_address\` text NULL,
        \`delivery_status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`delivered_at\` datetime NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`afpp_pool_idx\` (\`pool_id\`),
        KEY \`afpp_facility_idx\` (\`facility_id\`),
        KEY \`afpp_payment_status_idx\` (\`payment_status\`),
        KEY \`afpp_delivery_status_idx\` (\`delivery_status\`),
        KEY \`afpp_pool_facility_idx\` (\`pool_id\`, \`facility_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_pool_participants table')
  } catch (error: any) {
    console.error('Error creating afya_finance_pool_participants table:', error.message)
  }

  // Create afya_finance_orders table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_orders\` (
        \`id\` varchar(36) NOT NULL,
        \`order_number\` varchar(50) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`order_type\` varchar(20) NOT NULL,
        \`pool_id\` varchar(36) NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`product_name\` varchar(255) NOT NULL,
        \`quantity\` int NOT NULL,
        \`unit_price\` decimal(12,2) NOT NULL,
        \`discount_amount\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`total_amount\` decimal(12,2) NOT NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'TZS',
        \`payment_method\` varchar(50) NULL,
        \`payment_status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`payment_transaction_id\` varchar(36) NULL,
        \`order_status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`delivery_address\` text NULL,
        \`delivery_hub_id\` varchar(36) NULL,
        \`estimated_delivery\` datetime NULL,
        \`delivered_at\` datetime NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`order_number\` (\`order_number\`),
        KEY \`afo_order_number_idx\` (\`order_number\`),
        KEY \`afo_facility_idx\` (\`facility_id\`),
        KEY \`afo_pool_idx\` (\`pool_id\`),
        KEY \`afo_product_idx\` (\`product_id\`),
        KEY \`afo_order_status_idx\` (\`order_status\`),
        KEY \`afo_payment_status_idx\` (\`payment_status\`),
        KEY \`afo_created_at_idx\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_orders table')
  } catch (error: any) {
    console.error('Error creating afya_finance_orders table:', error.message)
  }

  // Create afya_finance_credit_applications table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_credit_applications\` (
        \`id\` varchar(36) NOT NULL,
        \`application_number\` varchar(50) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`requested_amount\` decimal(12,2) NOT NULL,
        \`currency\` varchar(10) NOT NULL DEFAULT 'TZS',
        \`purpose\` text NULL,
        \`credit_score\` int NULL,
        \`max_credit_limit\` decimal(12,2) NULL,
        \`approved_amount\` decimal(12,2) NULL,
        \`interest_rate\` decimal(5,2) NULL,
        \`repayment_terms\` int NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`reviewed_by\` varchar(36) NULL,
        \`reviewed_at\` datetime NULL,
        \`rejection_reason\` text NULL,
        \`facility_data\` text NULL,
        \`ai_scoring_data\` text NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`application_number\` (\`application_number\`),
        KEY \`afca_application_number_idx\` (\`application_number\`),
        KEY \`afca_facility_idx\` (\`facility_id\`),
        KEY \`afca_status_idx\` (\`status\`),
        KEY \`afca_created_at_idx\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_credit_applications table')
  } catch (error: any) {
    console.error('Error creating afya_finance_credit_applications table:', error.message)
  }

  // Create afya_finance_credit_accounts table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_credit_accounts\` (
        \`id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`application_id\` varchar(36) NOT NULL,
        \`credit_limit\` decimal(12,2) NOT NULL,
        \`available_credit\` decimal(12,2) NOT NULL,
        \`used_credit\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`interest_rate\` decimal(5,2) NOT NULL,
        \`repayment_terms\` int NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'active',
        \`last_payment_at\` datetime NULL,
        \`next_payment_due\` datetime NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`facility_id\` (\`facility_id\`),
        KEY \`afcac_facility_idx\` (\`facility_id\`),
        KEY \`afcac_application_idx\` (\`application_id\`),
        KEY \`afcac_status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_credit_accounts table')
  } catch (error: any) {
    console.error('Error creating afya_finance_credit_accounts table:', error.message)
  }

  // Create afya_finance_emergency_requests table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_emergency_requests\` (
        \`id\` varchar(36) NOT NULL,
        \`request_number\` varchar(50) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`product_name\` varchar(255) NOT NULL,
        \`quantity\` int NOT NULL,
        \`urgency\` varchar(20) NOT NULL DEFAULT 'high',
        \`status\` varchar(20) NOT NULL DEFAULT 'open',
        \`matched_facility_id\` varchar(36) NULL,
        \`matched_at\` datetime NULL,
        \`fulfilled_at\` datetime NULL,
        \`expires_at\` datetime NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`request_number\` (\`request_number\`),
        KEY \`afer_request_number_idx\` (\`request_number\`),
        KEY \`afer_facility_idx\` (\`facility_id\`),
        KEY \`afer_product_idx\` (\`product_id\`),
        KEY \`afer_status_idx\` (\`status\`),
        KEY \`afer_matched_facility_idx\` (\`matched_facility_id\`),
        KEY \`afer_expires_at_idx\` (\`expires_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_emergency_requests table')
  } catch (error: any) {
    console.error('Error creating afya_finance_emergency_requests table:', error.message)
  }

  // Create afya_finance_mini_warehouses table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_mini_warehouses\` (
        \`id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`region\` varchar(100) NOT NULL,
        \`city\` varchar(100) NOT NULL,
        \`address\` text NOT NULL,
        \`capacity\` int NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'active',
        \`approved_by\` varchar(36) NULL,
        \`approved_at\` datetime NULL,
        \`monthly_earnings\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`total_earnings\` decimal(12,2) NOT NULL DEFAULT '0.00',
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`facility_id\` (\`facility_id\`),
        KEY \`afmw_facility_idx\` (\`facility_id\`),
        KEY \`afmw_region_idx\` (\`region\`),
        KEY \`afmw_status_idx\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_mini_warehouses table')
  } catch (error: any) {
    console.error('Error creating afya_finance_mini_warehouses table:', error.message)
  }

  // Create afya_finance_inventory table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_inventory\` (
        \`id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`product_id\` varchar(36) NOT NULL,
        \`quantity\` int NOT NULL DEFAULT 0,
        \`reorder_level\` int NOT NULL DEFAULT 0,
        \`reorder_quantity\` int NULL,
        \`last_restocked_at\` datetime NULL,
        \`expiry_date\` date NULL,
        \`batch_number\` varchar(100) NULL,
        \`location\` varchar(255) NULL,
        \`notes\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`afinv_facility_idx\` (\`facility_id\`),
        KEY \`afinv_product_idx\` (\`product_id\`),
        KEY \`afinv_facility_product_idx\` (\`facility_id\`, \`product_id\`),
        KEY \`afinv_expiry_date_idx\` (\`expiry_date\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_inventory table')
  } catch (error: any) {
    console.error('Error creating afya_finance_inventory table:', error.message)
  }

  // Create afya_finance_hub_requests table
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`afya_finance_hub_requests\` (
        \`id\` varchar(36) NOT NULL,
        \`facility_id\` varchar(36) NOT NULL,
        \`region\` varchar(100) NOT NULL,
        \`city\` varchar(100) NOT NULL,
        \`address\` text NOT NULL,
        \`storage_capacity\` int NULL,
        \`justification\` text NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`reviewed_by\` varchar(36) NULL,
        \`reviewed_at\` datetime NULL,
        \`rejection_reason\` text NULL,
        \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`afhr_facility_idx\` (\`facility_id\`),
        KEY \`afhr_status_idx\` (\`status\`),
        KEY \`afhr_created_at_idx\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('✅ Created afya_finance_hub_requests table')
  } catch (error: any) {
    console.error('Error creating afya_finance_hub_requests table:', error.message)
  }

/**
 * Relations
 */
}

/**
 * Run database migrations
 * This creates all tables defined in schema.ts
 */
async function migrate() {
  // Check if environment variables are set
  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = parseInt(process.env.DB_PORT || '4000')
  const dbUser = process.env.DB_USER || 'root'
  const dbPassword = process.env.DB_PASSWORD || ''
  const dbName = process.env.DB_NAME || 'afya_solar'

  // Debug: Show if using .env values or defaults
  const usingDefaults = 
    dbHost === 'localhost' && 
    dbPort === 4000 && 
    dbUser === 'root' && 
    dbPassword === '' && 
    dbName === 'afya_solar'

  if (usingDefaults) {
    console.warn('⚠️  Warning: Using default database values. Make sure your .env file is configured!')
  }

  console.log(`Connecting to database: ${dbUser}@${dbHost}:${dbPort}/${dbName}`)

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

    const db = drizzle(connection, { schema, mode: 'default' })

    console.log('Running migrations...')
    console.log('Creating tables from schema...')
    
    // Check if tables already exist
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME IN ('users', 'facilities', 'devices', 'energy_data', 'payments', 'bills', 'service_jobs', 'help_requests', 'device_requests', 'service_subscriptions', 'regions', 'districts', 'technicians', 'equipment_categories', 'facility_equipment', 'maintenance_requests', 'maintenance_quotes', 'maintenance_quote_items', 'maintenance_reports', 'maintenance_reviews', 'departments', 'doctors', 'doctor_time_slots', 'patients', 'appointments', 'ai_intake_summaries', 'communication_logs', 'visits', 'facility_feedback', 'afya_finance_products', 'afya_finance_pools', 'afya_finance_pool_participants', 'afya_finance_orders', 'afya_finance_credit_applications', 'afya_finance_credit_accounts', 'afya_finance_emergency_requests', 'afya_finance_mini_warehouses', 'afya_finance_inventory', 'afya_finance_hub_requests')
    `, [dbName])
    
    const existingTables = (tables as any[]).map((t: any) => t.TABLE_NAME)
    const requiredTables = ['users', 'facilities', 'devices', 'energy_data', 'payments', 'bills', 'service_jobs', 'help_requests', 'device_requests', 'service_subscriptions', 'regions', 'districts', 'technicians', 'equipment_categories', 'facility_equipment', 'maintenance_requests', 'maintenance_quotes', 'maintenance_quote_items', 'maintenance_reports', 'maintenance_reviews', 'departments', 'doctors', 'doctor_time_slots', 'patients', 'appointments', 'ai_intake_summaries', 'communication_logs', 'visits', 'facility_feedback', 'afya_finance_products', 'afya_finance_pools', 'afya_finance_pool_participants', 'afya_finance_orders', 'afya_finance_credit_applications', 'afya_finance_credit_accounts', 'afya_finance_emergency_requests', 'afya_finance_mini_warehouses', 'afya_finance_inventory', 'afya_finance_hub_requests']
    const allTablesExist = requiredTables.every(table => existingTables.includes(table))
    
    if (allTablesExist) {
      console.log('✅ All tables already exist in the database.')
      console.log('   Tables found:', existingTables.join(', '))
      console.log('   Using direct SQL method to ensure tables are up to date...')
      await createTablesDirectly(connection, dbName)
      console.log('✅ All tables verified and up to date!')
      return
    }
    
    // Try to use Drizzle Kit's push command first (only if tables don't exist)
    const { execSync } = await import('child_process')
    
    try {
      console.log('Pushing schema to database using Drizzle Kit...')
      
      // Run drizzle-kit push with timeout
      execSync('npx drizzle-kit push', { 
        stdio: 'inherit',
        env: { ...process.env },
        cwd: process.cwd(),
        timeout: 120000, // 2 minutes timeout
      })
      
      console.log('✅ Migrations completed successfully!')
      console.log('✅ All tables have been created in the database.')
    } catch (error: any) {
      console.error('❌ Error running Drizzle Kit push:', error.message)
      if (error.code === 'ER_MULTIPLE_PRI_KEY' || error.errno === 1068) {
        console.error('   Tables already exist with conflicting schema.')
      }
      console.error('\nTrying alternative method: Creating tables directly...')
      
      // Fallback: Create tables directly using SQL
      try {
        await createTablesDirectly(connection, dbName)
        console.log('✅ Migrations completed successfully using direct SQL!')
        console.log('✅ All tables have been created in the database.')
      } catch (sqlError: any) {
        console.error('❌ Error creating tables directly:', sqlError.message)
        throw error // Throw original error
      }
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed!')
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Please check:')
      console.error('1. Is your database server running?')
      console.error('2. Is your .env file configured correctly?')
      console.error('3. Are the connection details correct?')
      console.error(`\nAttempted connection: ${dbUser}@${dbHost}:${dbPort}/${dbName}`)
      console.error('\nRequired environment variables:')
      console.error('  - DB_HOST')
      console.error('  - DB_PORT')
      console.error('  - DB_USER')
      console.error('  - DB_PASSWORD')
      console.error('  - DB_NAME')
      console.error('\nSee SETUP_DATABASE.md for configuration instructions.')
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\nDatabase connection timed out. Please check:')
      console.error('1. Is your database server accessible?')
      console.error('2. Are you behind a firewall or VPN?')
      console.error('3. Is your network connection stable?')
      console.error('4. For TiDB Cloud, ensure your IP is whitelisted')
      console.error(`\nAttempted connection: ${dbUser}@${dbHost}:${dbPort}/${dbName}`)
      console.error('\nThe migration script will try to create tables directly...')
    } else {
      console.error('Error:', error.message)
      if (error.code) {
        console.error('Error code:', error.code)
      }
    }
    process.exit(1)
  } finally {
    if (connection) {
      if (typeof connection.end === 'function') {
        await connection.end()
      } else if (typeof connection.destroy === 'function') {
        connection.destroy()
      }
    }
  }
}

migrate()
