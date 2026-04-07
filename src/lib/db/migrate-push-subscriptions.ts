/**
 * Migration script to create push_subscriptions table
 * Run: tsx src/lib/db/migrate-push-subscriptions.ts
 */
import mysql from 'mysql2/promise'

async function migratePushSubscriptions() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'afyasolar',
  })

  try {
    console.log('Creating push_subscriptions table...')

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`push_subscriptions\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`endpoint\` TEXT NOT NULL,
        \`p256dh\` TEXT NOT NULL,
        \`auth\` TEXT NOT NULL,
        \`user_agent\` VARCHAR(500),
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`push_subscription_user_idx\` (\`user_id\`),
        INDEX \`push_subscription_endpoint_idx\` (\`endpoint\`(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    console.log('✅ Created push_subscriptions table')
  } catch (error) {
    console.error('❌ Error creating push_subscriptions table:', error)
    throw error
  } finally {
    await connection.end()
  }
}

migratePushSubscriptions()
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })

