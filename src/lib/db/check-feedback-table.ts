import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
try {
  require('dotenv').config()
} catch (error) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach((line) => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          const cleanValue = value.replace(/^["']|["']$/g, '')
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = cleanValue
          }
        }
      }
    })
  }
}

function getSSLConfig() {
  if (process.env.DB_SSL !== 'true') {
    return undefined
  }
  const caPath = process.env.DB_CA_PATH || path.join(process.cwd(), 'certs', 'isgrootx1.pem')
  if (fs.existsSync(caPath)) {
    return {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true,
    }
  }
  return {
    rejectUnauthorized: false,
  }
}

async function checkFeedbackTable() {
  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = parseInt(process.env.DB_PORT || '4000')
  const dbUser = process.env.DB_USER || 'root'
  const dbPassword = process.env.DB_PASSWORD || ''
  const dbName = process.env.DB_NAME || 'afya_solar'

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

    // Check if facility_feedback table exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'facility_feedback'
    `, [dbName])

    if ((tables as any[]).length > 0) {
      console.log('✅ facility_feedback table EXISTS!')
      
      // Show table structure
      const [columns] = await connection.query(`
        DESCRIBE facility_feedback
      `)
      
      console.log('\nTable structure:')
      console.table(columns)
      
      // Count records
      const [count] = await connection.query(`
        SELECT COUNT(*) as count FROM facility_feedback
      `)
      console.log(`\nTotal feedback records: ${(count as any[])[0].count}`)
    } else {
      console.log('❌ facility_feedback table DOES NOT EXIST')
      console.log('\nCreating table now...')
      
      // Create the table
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
          KEY \`feedback_is_attended_idx\` (\`is_attended\`),
          CONSTRAINT \`facility_feedback_ibfk_1\` FOREIGN KEY (\`facility_id\`) REFERENCES \`facilities\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`facility_feedback_ibfk_2\` FOREIGN KEY (\`appointment_id\`) REFERENCES \`appointments\` (\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `)
      
      console.log('✅ facility_feedback table created successfully!')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.code) {
      console.error('Error code:', error.code)
    }
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

checkFeedbackTable()
