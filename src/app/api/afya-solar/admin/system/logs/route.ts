import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

// Mock system logs data
interface SystemLog {
  id: string
  level: 'info' | 'warning' | 'error' | 'debug'
  category: string
  message: string
  userId?: string
  ipAddress?: string
  timestamp: string
  metadata?: Record<string, any>
}

const mockLogs: SystemLog[] = [
  {
    id: '1',
    level: 'info',
    category: 'authentication',
    message: 'User login successful',
    userId: '2',
    ipAddress: '192.168.1.100',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    metadata: { userAgent: 'Mozilla/5.0...' }
  },
  {
    id: '2',
    level: 'warning',
    category: 'system',
    message: 'High memory usage detected',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    metadata: { memoryUsage: '87%', threshold: '85%' }
  },
  {
    id: '3',
    level: 'error',
    category: 'database',
    message: 'Database connection failed',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    metadata: { error: 'Connection timeout', retryCount: 3 }
  },
  {
    id: '4',
    level: 'info',
    category: 'automation',
    message: 'Scheduled backup completed successfully',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    metadata: { backupSize: '2.3GB', duration: '45 seconds' }
  },
  {
    id: '5',
    level: 'warning',
    category: 'security',
    message: 'Multiple failed login attempts',
    userId: 'unknown',
    ipAddress: '192.168.1.200',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    metadata: { attempts: 5, timeWindow: '5 minutes' }
  },
  {
    id: '6',
    level: 'info',
    category: 'api',
    message: 'API rate limit reached',
    userId: '3',
    timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
    metadata: { endpoint: '/api/analytics', requests: 1000, limit: 1000 }
  },
  {
    id: '7',
    level: 'error',
    category: 'payment',
    message: 'Payment processing failed',
    userId: '1',
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    metadata: { 
      paymentId: 'pay_123456789', 
      amount: 150000, 
      currency: 'TZS',
      error: 'Insufficient funds'
    }
  },
  {
    id: '8',
    level: 'debug',
    category: 'energy',
    message: 'Smart meter data received',
    timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    metadata: { 
      meterId: 'SM001', 
      power: 2500, 
      energy: 15.6,
      batteryLevel: 78
    }
  }
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') || 'all'
    const category = searchParams.get('category') || 'all'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Filter logs based on parameters
    let filteredLogs = mockLogs

    if (level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level)
    }

    if (category !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.category === category)
    }

    // Sort by timestamp (newest first) and limit
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    filteredLogs = filteredLogs.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: filteredLogs,
      meta: {
        count: filteredLogs.length,
        total: mockLogs.length,
        filters: { level, category, limit },
        note: 'Mock data - replace with real database logs'
      }
    })

  } catch (error) {
    console.error('Error fetching system logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system logs' },
      { status: 500 }
    )
  }
}
