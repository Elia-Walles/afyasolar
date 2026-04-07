import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'
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

/**
 * Get SSL configuration for TiDB Cloud
 */
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

/**
 * Regions data from SQL file
 */
const regionsData = [
  { id: 1, name: 'Arusha' },
  { id: 2, name: 'Dar es salaam' },
  { id: 3, name: 'Dodoma' },
  { id: 4, name: 'Tanga' },
  { id: 7, name: 'Morogoro' },
  { id: 8, name: 'Pwani' },
  { id: 9, name: 'Kilimanjaro' },
  { id: 10, name: 'Mtwara' },
  { id: 11, name: 'Lindi' },
  { id: 12, name: 'Ruvuma' },
  { id: 13, name: 'Songwe' },
  { id: 14, name: 'Mbeya' },
  { id: 15, name: 'Njombe' },
  { id: 16, name: 'Rukwa' },
  { id: 17, name: 'Katavi' },
  { id: 19, name: 'Kigoma' },
  { id: 20, name: 'Geita' },
  { id: 21, name: 'Kagera' },
  { id: 22, name: 'Mwanza' },
  { id: 23, name: 'Shinyanga' },
  { id: 24, name: 'Simiyu' },
  { id: 25, name: 'Mara' },
  { id: 26, name: 'Manyara' },
  { id: 27, name: 'Singida' },
  { id: 28, name: 'Iringa' },
  { id: 29, name: 'Tabora' },
  { id: 30, name: 'Songea' },
  { id: 33, name: 'Pemba Kaskazini' },
  { id: 34, name: 'Pemba Kusini' },
  { id: 35, name: 'Unguja Kaskazini' },
  { id: 36, name: 'Unguja Kusini' },
  { id: 37, name: 'Unguja Magharibi' },
]

/**
 * Districts data from SQL file
 */
const districtsData = [
  { id: 1, regionId: 2, name: 'Kinondoni' },
  { id: 3, regionId: 1, name: 'Ngorongoro' },
  { id: 5, regionId: 1, name: 'Arusha' },
  { id: 6, regionId: 1, name: 'Arumeru' },
  { id: 7, regionId: 1, name: 'Longido' },
  { id: 8, regionId: 1, name: 'Monduli' },
  { id: 9, regionId: 1, name: 'Karatu' },
  { id: 10, regionId: 2, name: 'Ilala' },
  { id: 11, regionId: 2, name: 'Temeke' },
  { id: 12, regionId: 2, name: 'Ubungo' },
  { id: 13, regionId: 2, name: 'Kigamboni' },
  { id: 14, regionId: 3, name: 'Dodoma' },
  { id: 15, regionId: 3, name: 'Chamwino' },
  { id: 16, regionId: 3, name: 'Chemba' },
  { id: 17, regionId: 3, name: 'Kondoa' },
  { id: 18, regionId: 3, name: 'Bahi' },
  { id: 19, regionId: 3, name: 'Mpwapwa' },
  { id: 20, regionId: 3, name: 'Kongwa' },
  { id: 21, regionId: 20, name: 'Bukombe' },
  { id: 22, regionId: 20, name: 'Mbogwe' },
  { id: 23, regionId: 20, name: 'Geita' },
  { id: 24, regionId: 20, name: 'Chato' },
  { id: 25, regionId: 20, name: 'Nyang\'wale' },
  { id: 26, regionId: 28, name: 'Iringa' },
  { id: 27, regionId: 28, name: 'Mufindi' },
  { id: 28, regionId: 28, name: 'Kilolo' },
  { id: 29, regionId: 21, name: 'Biharamulo' },
  { id: 30, regionId: 21, name: 'Karagwe' },
  { id: 31, regionId: 21, name: 'Muleba' },
  { id: 32, regionId: 21, name: 'Bukoba' },
  { id: 33, regionId: 21, name: 'Ngara' },
  { id: 34, regionId: 21, name: 'Missenyi' },
  { id: 35, regionId: 21, name: 'Kyerwa' },
  { id: 36, regionId: 17, name: 'Mlele' },
  { id: 37, regionId: 17, name: 'Mpanda' },
  { id: 38, regionId: 17, name: 'Tanganyika' },
  { id: 39, regionId: 19, name: 'Kigoma' },
  { id: 40, regionId: 19, name: 'Kasulu' },
  { id: 41, regionId: 19, name: 'Kankoko' },
  { id: 42, regionId: 19, name: 'Uvinza' },
  { id: 43, regionId: 19, name: 'Buhigwe' },
  { id: 44, regionId: 19, name: 'Kibondo' },
  { id: 45, regionId: 9, name: 'Siha' },
  { id: 46, regionId: 9, name: 'Moshi' },
  { id: 47, regionId: 9, name: 'Mwanga' },
  { id: 48, regionId: 8, name: 'Rombo' },
  { id: 49, regionId: 9, name: 'Hai' },
  { id: 50, regionId: 9, name: 'Same' },
  { id: 51, regionId: 11, name: 'Nachingwea' },
  { id: 52, regionId: 11, name: 'Ruangwa' },
  { id: 53, regionId: 11, name: 'Liwale' },
  { id: 54, regionId: 11, name: 'Lindi' },
  { id: 55, regionId: 11, name: 'Kilwa' },
  { id: 56, regionId: 26, name: 'Babati' },
  { id: 57, regionId: 26, name: 'Mbulu' },
  { id: 58, regionId: 26, name: 'Hanang\'' },
  { id: 59, regionId: 26, name: 'Kiteto' },
  { id: 60, regionId: 26, name: 'Simanjiro' },
  { id: 61, regionId: 25, name: 'Rorya' },
  { id: 62, regionId: 25, name: 'Serengeti' },
  { id: 63, regionId: 25, name: 'Bunda' },
  { id: 64, regionId: 25, name: 'Butiama' },
  { id: 65, regionId: 25, name: 'Tarime' },
  { id: 66, regionId: 25, name: 'Musoma' },
  { id: 67, regionId: 14, name: 'Chunya' },
  { id: 68, regionId: 14, name: 'Kyela' },
  { id: 69, regionId: 14, name: 'Mbeya' },
  { id: 70, regionId: 14, name: 'Rungwe' },
  { id: 71, regionId: 14, name: 'Mbarali' },
  { id: 72, regionId: 7, name: 'Gairo' },
  { id: 73, regionId: 7, name: 'Kilombero' },
  { id: 74, regionId: 7, name: 'Kilosa' },
  { id: 75, regionId: 7, name: 'Mvomero' },
  { id: 76, regionId: 7, name: 'Morogoro' },
  { id: 77, regionId: 7, name: 'Ulanga' },
  { id: 78, regionId: 7, name: 'Malinyi' },
  { id: 79, regionId: 10, name: 'Newala' },
  { id: 80, regionId: 10, name: 'Nanyumbu' },
  { id: 81, regionId: 10, name: 'Mtwara' },
  { id: 82, regionId: 10, name: 'Masasi' },
  { id: 83, regionId: 10, name: 'Tandahimba' },
  { id: 84, regionId: 22, name: 'Ilemela' },
  { id: 85, regionId: 22, name: 'Kwimba' },
  { id: 86, regionId: 22, name: 'Sengerema' },
  { id: 87, regionId: 22, name: 'Nyamagana' },
  { id: 88, regionId: 22, name: 'Magu' },
  { id: 89, regionId: 22, name: 'Ukerewe' },
  { id: 90, regionId: 22, name: 'Misungwi' },
  { id: 91, regionId: 15, name: 'Njombe' },
  { id: 92, regionId: 15, name: 'Ludewa' },
  { id: 93, regionId: 15, name: 'Wang\'ing\'ombe' },
  { id: 94, regionId: 15, name: 'Makete' },
  { id: 95, regionId: 8, name: 'Bagamoyo' },
  { id: 96, regionId: 8, name: 'Mkuranga' },
  { id: 97, regionId: 8, name: 'Rufiji' },
  { id: 98, regionId: 8, name: 'Mafia' },
  { id: 99, regionId: 8, name: 'Kibaha' },
  { id: 100, regionId: 8, name: 'Kisarawe' },
  { id: 101, regionId: 8, name: 'Kibiti' },
  { id: 102, regionId: 16, name: 'Sumbawanga' },
  { id: 103, regionId: 16, name: 'Nkasi' },
  { id: 104, regionId: 16, name: 'Kalambo' },
  { id: 105, regionId: 12, name: 'Namtumbo' },
  { id: 106, regionId: 12, name: 'Mbinga' },
  { id: 107, regionId: 12, name: 'Nyasa' },
  { id: 108, regionId: 12, name: 'Tunduru' },
  { id: 109, regionId: 12, name: 'Songea' },
  { id: 110, regionId: 23, name: 'Kishapu' },
  { id: 111, regionId: 23, name: 'Kahama' },
  { id: 112, regionId: 23, name: 'Shinyanga' },
  { id: 113, regionId: 24, name: 'Busega' },
  { id: 114, regionId: 24, name: 'Maswa' },
  { id: 115, regionId: 24, name: 'Bariadi' },
  { id: 116, regionId: 24, name: 'Meatu' },
  { id: 117, regionId: 24, name: 'Itilima' },
  { id: 118, regionId: 27, name: 'Mkalama' },
  { id: 119, regionId: 27, name: 'Manyoni' },
  { id: 120, regionId: 27, name: 'Singida' },
  { id: 121, regionId: 27, name: 'Ikungi' },
  { id: 122, regionId: 27, name: 'Iramba' },
  { id: 123, regionId: 13, name: 'Songwe' },
  { id: 124, regionId: 13, name: 'Ileje' },
  { id: 125, regionId: 13, name: 'Mbozi' },
  { id: 126, regionId: 13, name: 'Momba' },
  { id: 127, regionId: 29, name: 'Nzega' },
  { id: 128, regionId: 29, name: 'Kaliua' },
  { id: 129, regionId: 29, name: 'Igunga' },
  { id: 130, regionId: 29, name: 'Sikonge' },
  { id: 131, regionId: 29, name: 'Tabora' },
  { id: 132, regionId: 29, name: 'Urambo' },
  { id: 133, regionId: 29, name: 'Uyui' },
  { id: 134, regionId: 4, name: 'Tanga' },
  { id: 135, regionId: 4, name: 'Muheza' },
  { id: 136, regionId: 4, name: 'Mkinga' },
  { id: 137, regionId: 4, name: 'Pangani' },
  { id: 138, regionId: 4, name: 'Handeni' },
  { id: 139, regionId: 4, name: 'Korogwe' },
  { id: 140, regionId: 4, name: 'Kilindi' },
  { id: 141, regionId: 4, name: 'Lushoto' },
  { id: 145, regionId: 33, name: 'Micheweni' },
  { id: 146, regionId: 33, name: 'Wete' },
  { id: 147, regionId: 34, name: 'Chakechake' },
  { id: 148, regionId: 34, name: 'Mkoani' },
  { id: 149, regionId: 35, name: 'Kaskazini A' },
  { id: 150, regionId: 35, name: 'Kaskazini B' },
  { id: 151, regionId: 36, name: 'Unguja Kati' },
  { id: 152, regionId: 36, name: 'Unguja Kusini' },
  { id: 153, regionId: 37, name: 'Unguja Magharibi' },
  { id: 154, regionId: 37, name: 'Unguja Mjini' },
  { id: 155, regionId: 2, name: 'WINGERS' },
]

async function seedRegionsDistricts() {
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

    const db = drizzle(connection, { schema, mode: 'default' })

    console.log('\n🌱 Starting regions and districts seeding...\n')

    // Check if regions already exist
    const existingRegions = await db.select().from(schema.regions).limit(1)
    
    if (existingRegions.length > 0) {
      console.log('⚠️  Regions already exist. Using INSERT ... ON DUPLICATE KEY UPDATE to update existing data...')
      console.log('   (Skipping deletion to preserve foreign key relationships)\n')
    }

    // Insert regions using raw SQL to handle specific IDs with AUTO_INCREMENT
    console.log('📋 Inserting regions...')
    let regionSuccessCount = 0
    for (const region of regionsData) {
      try {
        await connection.query(
          `INSERT INTO regions (id, name, status, created_at, updated_at) 
           VALUES (?, ?, ?, NOW(), NOW()) 
           ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)`,
          [region.id, region.name, 1]
        )
        regionSuccessCount++
        console.log(`   ✅ Inserted: ${region.name} (ID: ${region.id})`)
      } catch (error: any) {
        console.error(`   ❌ Error inserting ${region.name}:`, error.message)
      }
    }
    
    // Update AUTO_INCREMENT to be higher than the max ID
    const maxRegionId = Math.max(...regionsData.map(r => r.id))
    await connection.query(`ALTER TABLE regions AUTO_INCREMENT = ?`, [maxRegionId + 1])
    
    console.log(`\n✅ Inserted ${regionSuccessCount} regions\n`)

    // Insert districts using raw SQL to handle specific IDs with AUTO_INCREMENT
    console.log('📋 Inserting districts...')
    let districtSuccessCount = 0
    for (const district of districtsData) {
      try {
        await connection.query(
          `INSERT INTO districts (id, region_id, name, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, NOW(), NOW()) 
           ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), region_id = VALUES(region_id)`,
          [district.id, district.regionId, district.name, 1]
        )
        districtSuccessCount++
        console.log(`   ✅ Inserted: ${district.name} (Region ID: ${district.regionId})`)
      } catch (error: any) {
        console.error(`   ❌ Error inserting ${district.name}:`, error.message)
      }
    }
    
    // Update AUTO_INCREMENT to be higher than the max ID
    const maxDistrictId = Math.max(...districtsData.map(d => d.id))
    await connection.query(`ALTER TABLE districts AUTO_INCREMENT = ?`, [maxDistrictId + 1])
    console.log(`\n✅ Inserted ${districtSuccessCount} districts\n`)

    console.log('✅ Regions and districts seeding completed!\n')

    await connection.end()
  } catch (error) {
    console.error('❌ Error seeding regions and districts:', error)
    if (connection) {
      await connection.end()
    }
    process.exit(1)
  }
}

// Run the seeder
seedRegionsDistricts()

