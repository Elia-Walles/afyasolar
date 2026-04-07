import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

// Mock metrics data - in real implementation this would be calculated from database
const mockMetrics = {
  totalTickets: 156,
  openTickets: 23,
  inProgressTickets: 15,
  resolvedTickets: 118,
  avgResponseTime: 2.4, // hours
  avgResolutionTime: 24.6, // hours
  customerSatisfaction: 87.5, // percentage
  ticketsByCategory: [
    { category: 'technical', count: 68, percentage: 43.6 },
    { category: 'billing', count: 34, percentage: 21.8 },
    { category: 'installation', count: 28, percentage: 17.9 },
    { category: 'maintenance', count: 18, percentage: 11.5 },
    { category: 'general', count: 8, percentage: 5.1 }
  ],
  ticketsByPriority: [
    { priority: 'low', count: 45, percentage: 28.8 },
    { priority: 'medium', count: 67, percentage: 42.9 },
    { priority: 'high', count: 32, percentage: 20.5 },
    { priority: 'urgent', count: 12, percentage: 7.7 }
  ]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In real implementation, calculate these metrics from database
    // For now, return mock data
    return NextResponse.json({
      success: true,
      data: mockMetrics,
      meta: {
        generatedAt: new Date().toISOString(),
        note: 'Mock data - replace with real database calculations'
      }
    })

  } catch (error) {
    console.error('Error fetching support metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support metrics' },
      { status: 500 }
    )
  }
}
