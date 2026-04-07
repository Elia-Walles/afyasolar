import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'
import * as telemetrySchema from './schema-telemetry'
import * as afyaSolarSchema from './afya-solar-schema'
import * as fs from 'fs'
import * as path from 'path'

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
 * Database connection configuration
 * Uses TiDB Cloud (MySQL compatible)
 */
const connection = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '4000'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'afya_solar',
  ssl: getSSLConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

/**
 * Drizzle database instance
 */
export const db = drizzle(connection, { schema: { ...schema, ...telemetrySchema, ...afyaSolarSchema }, mode: 'default' })

/**
 * Get raw database connection for raw SQL queries
 */
export function getRawConnection() {
  return connection
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await connection.query('SELECT 1')
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}
