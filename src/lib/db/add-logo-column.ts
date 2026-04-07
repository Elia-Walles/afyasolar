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

async function addLogoColumn() {
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

    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'facilities' 
      AND COLUMN_NAME = 'logo_url'
    `, [dbName])

    if ((columns as any[]).length > 0) {
      console.log('✅ logo_url column already exists')
      return
    }

    // Add the column
    await connection.query(`
      ALTER TABLE \`facilities\` 
      ADD COLUMN \`logo_url\` varchar(500) NULL AFTER \`booking_settings\`
    `)

    console.log('✅ Successfully added logo_url column to facilities table')
  } catch (error: any) {
    console.error('❌ Error adding logo_url column:', error.message)
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ Column already exists (duplicate field name error)')
    } else {
      throw error
    }
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

addLogoColumn()
  .then(() => {
    console.log('Migration completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
