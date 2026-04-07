import mysql from 'mysql2/promise'
import * as path from 'path'
import * as fs from 'fs'

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

  console.warn(`CA certificate not found at ${caPath}. Using insecure connection.`)
  return {
    rejectUnauthorized: false,
  }
}

async function addReferralColumns() {
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

    console.log('Checking for referral columns...')

    // Check if referral_code column exists
    const [referralCodeColumn]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'referral_code'
    `, [dbName])

    if (referralCodeColumn[0].count === 0) {
      console.log('Adding referral_code column...')
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
        console.log('✅ Added UNIQUE constraint on referral_code')
      } catch (uniqueError: any) {
        // Unique constraint might already exist, that's OK
        if (uniqueError.code !== 'ER_DUP_KEYNAME' && uniqueError.code !== 'ER_DUP_ENTRY') {
          console.warn('⚠️  Could not add UNIQUE constraint on referral_code:', uniqueError.message)
        }
      }
      
      console.log('✅ Added referral_code column to facilities table')
    } else {
      console.log('ℹ️  referral_code column already exists')
      
      // Check if UNIQUE constraint exists
      try {
        const [uniqueIndexes]: any = await connection.query(`
          SELECT INDEX_NAME
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'facilities'
            AND COLUMN_NAME = 'referral_code'
            AND NON_UNIQUE = 0
        `, [dbName])
        
        if (uniqueIndexes.length === 0) {
          console.log('Adding UNIQUE constraint on referral_code...')
          await connection.query(`
            ALTER TABLE \`facilities\`
            ADD UNIQUE KEY \`facility_referral_code_unique\` (\`referral_code\`)
          `)
          console.log('✅ Added UNIQUE constraint on referral_code')
        }
      } catch (uniqueError: any) {
        if (uniqueError.code !== 'ER_DUP_KEYNAME') {
          console.warn('⚠️  Could not add UNIQUE constraint on referral_code:', uniqueError.message)
        }
      }
    }

    // Check if referred_by column exists
    const [referredByColumn]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'referred_by'
    `, [dbName])

    if (referredByColumn[0].count === 0) {
      console.log('Adding referred_by column...')
      await connection.query(`
        ALTER TABLE \`facilities\`
        ADD COLUMN \`referred_by\` varchar(36) NULL COMMENT 'ID of facility that referred this one' AFTER \`referral_code\`
      `)
      console.log('✅ Added referred_by column to facilities table')
    } else {
      console.log('ℹ️  referred_by column already exists')
    }

    // Check if referral_benefit_applied column exists
    const [benefitAppliedColumn]: any = await connection.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'facilities'
        AND COLUMN_NAME = 'referral_benefit_applied'
    `, [dbName])

    if (benefitAppliedColumn[0].count === 0) {
      console.log('Adding referral_benefit_applied column...')
      await connection.query(`
        ALTER TABLE \`facilities\`
        ADD COLUMN \`referral_benefit_applied\` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether referral benefit has been applied' AFTER \`referred_by\`
      `)
      console.log('✅ Added referral_benefit_applied column to facilities table')
    } else {
      console.log('ℹ️  referral_benefit_applied column already exists')
    }

    // Generate referral codes for existing facilities that don't have one
    console.log('Generating referral codes for existing facilities...')
    try {
      // First, get all facilities without referral codes
      const [facilitiesWithoutCode]: any = await connection.query(`
        SELECT id FROM \`facilities\` WHERE \`referral_code\` IS NULL
      `)
      
      let updatedCount = 0
      for (const facility of facilitiesWithoutCode) {
        try {
          // Generate a unique referral code
          const facilityId = facility.id.replace(/-/g, '')
          const referralCode = 'REF' + facilityId.substring(0, 8).padStart(8, '0')
          
          await connection.query(`
            UPDATE \`facilities\`
            SET \`referral_code\` = ?
            WHERE \`id\` = ? AND \`referral_code\` IS NULL
          `, [referralCode, facility.id])
          updatedCount++
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
              updatedCount++
            } catch (retryError: any) {
              console.warn(`⚠️  Could not generate referral code for facility ${facility.id}`)
            }
          }
        }
      }
      console.log(`✅ Generated referral codes for ${updatedCount} facilities`)
    } catch (error: any) {
      console.warn('⚠️  Could not generate referral codes:', error.message)
    }

    console.log('\n✅ All referral columns have been added successfully!')
  } catch (error: any) {
    console.error('\n❌ Error adding referral columns:', error.message)
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('   One or more columns already exist. This is OK.')
    } else {
      throw error
    }
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

addReferralColumns()
  .then(() => {
    console.log('\nMigration completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nMigration failed:', error)
    process.exit(1)
  })
