import fs from "fs"
import path from "path"
import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config({ path: path.join(process.cwd(), ".env") })

async function run() {
  const migrationPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "db",
    "migrations",
    "20260416090000_create_facility_assessment_report_tables.sql"
  )

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`)
  }

  const sql = fs.readFileSync(migrationPath, "utf-8")
  if (!sql.trim()) throw new Error("Migration SQL is empty")

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    multipleStatements: true,
  })

  try {
    await connection.query(sql)
    console.log("✅ facility_energy_assessments and facility_climate_assessments are ready.")
  } finally {
    await connection.end()
  }
}

run().catch((error) => {
  console.error("❌ Failed to create assessment report tables.")
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
