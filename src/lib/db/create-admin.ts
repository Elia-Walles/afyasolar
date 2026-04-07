/**
 * Script to create admin users
 * 
 * Usage:
 *   npm run create-admin
 *   or
 *   tsx src/lib/db/create-admin.ts
 * 
 * This script allows you to create admin users directly in the database.
 * Admin users can access the admin dashboard and manage the system.
 */

// Load environment variables FIRST before any imports that depend on env.ts
import * as fs from 'fs'
import * as path from 'path'

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

// Now import modules that depend on env.ts
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'
import { eq } from 'drizzle-orm'
import { randomUUID, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import * as readline from 'readline'

function getSSLConfig() {
  const dbSSL = process.env.DB_SSL === 'true'
  if (!dbSSL) {
    return undefined
  }

  const caPath = process.env.DB_CA_PATH
  if (caPath && fs.existsSync(caPath)) {
    return {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true,
    }
  }

  return {
    rejectUnauthorized: false,
  }
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function createAdmin() {
  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = parseInt(process.env.DB_PORT || '4000')
  const dbUser = process.env.DB_USER || 'root'
  const dbPassword = process.env.DB_PASSWORD || ''
  const dbName = process.env.DB_NAME || 'afya_solar'

  console.log('🔐 Admin User Creation Script')
  console.log('============================\n')

  // Get admin details
  const name = await askQuestion('Enter admin full name: ')
  if (!name || name.trim().length < 2) {
    console.error('❌ Name must be at least 2 characters')
    process.exit(1)
  }

  const email = await askQuestion('Enter admin email: ')
  if (!email || !email.includes('@')) {
    console.error('❌ Valid email is required')
    process.exit(1)
  }

  const password = await askQuestion('Enter admin password (min 8 characters): ')
  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters')
    process.exit(1)
  }

  const confirmPassword = await askQuestion('Confirm password: ')
  if (password !== confirmPassword) {
    console.error('❌ Passwords do not match')
    process.exit(1)
  }

  console.log('\nConnecting to database...')

  let connection
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      ssl: getSSLConfig(),
      connectTimeout: 60000,
    })

    const db = drizzle(connection, { schema, mode: 'default' })

    // Check if admin already exists
    const existing = await db
      .select()
      .from(schema.admins)
      .where(eq(schema.admins.email, email))
      .limit(1)

    if (existing[0]) {
      console.error(`❌ Admin with email ${email} already exists`)
      process.exit(1)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date()
    verificationExpires.setHours(verificationExpires.getHours() + 24) // 24 hours from now

    // Create admin in admins table (email verification required)
    const adminId = randomUUID()
    await db.insert(schema.admins).values({
      id: adminId,
      email: email.trim(),
      name: name.trim(),
      password: hashedPassword,
      emailVerified: false, // Admin must verify email before login
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      failedLoginAttempts: 0,
      invitationCount: 0,
      tokenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log('\n✅ Admin created successfully!')
    console.log(`   Email: ${email}`)
    console.log(`   Name: ${name}`)
    console.log(`   ID: ${adminId}`)

    // Send verification email (lazy import to avoid env validation issues)
    console.log('\n📧 Sending verification email...')
    // Use same logic as env.ts: NEXTAUTH_URL > Vercel production > Localhost
    let baseUrl = process.env.NEXTAUTH_URL
    if (!baseUrl) {
      // If running on Vercel (production), use the custom domain
      if (process.env.VERCEL || process.env.VERCEL_ENV === 'production') {
        baseUrl = 'https://afya-solar.vercel.app'
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`
    
    try {
      // Import email service dynamically after env is loaded
      const { sendVerificationEmail } = await import('../email')
      const emailSent = await sendVerificationEmail({
        to: email.trim(),
        name: name.trim(),
        verificationToken,
      })

      if (emailSent) {
        console.log('\n✅ Verification email sent successfully!')
        console.log(`\n📋 Important: The admin must verify their email before they can log in.`)
        console.log(`   Verification URL: ${verificationUrl}\n`)
        
        // If SMTP is not configured, show the URL in console
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
          console.log('⚠️  SMTP not configured - email was logged to console above.')
          console.log('   To send real emails, configure SMTP settings in your .env file:')
          console.log('   - SMTP_HOST (e.g., smtp.gmail.com)')
          console.log('   - SMTP_PORT (e.g., 587)')
          console.log('   - SMTP_USER (your email address)')
          console.log('   - SMTP_PASSWORD (your email password or app password)')
          console.log('   - NEXTAUTH_URL (your app URL, default: http://localhost:3000)\n')
        }
      } else {
        console.error('\n⚠️  Failed to send verification email.')
        console.error('   Please check your SMTP configuration in .env file.')
        console.error('   The admin can still verify their email using the verification URL.')
        console.log(`   Verification URL: ${verificationUrl}\n`)
      }
    } catch (emailError: any) {
      console.error('\n⚠️  Error sending verification email:', emailError.message)
      console.error('   The admin can still verify their email using the verification URL.')
      console.log(`   Verification URL: ${verificationUrl}\n`)
    }
  } catch (error: any) {
    console.error('\n❌ Error creating admin user:')
    if (error.code === 'ECONNREFUSED') {
      console.error('   Database connection refused. Please check your .env file and database settings.')
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error(`   User with email ${email} already exists`)
    } else {
      console.error('   ', error.message)
    }
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// Run if called directly
if (require.main === module) {
  createAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { createAdmin }

