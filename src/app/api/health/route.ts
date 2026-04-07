import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
export async function GET() {
  const startTime = Date.now()
  
  try {
    // Check database connection
    const dbStartTime = Date.now()
    await db.execute(sql`SELECT 1`)
    const dbLatency = Date.now() - dbStartTime
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'connected',
        latency: `${dbLatency}ms`,
      },
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'development',
    }, { status: 200 })
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'development',
    }, { status: 503 })
  }
}

