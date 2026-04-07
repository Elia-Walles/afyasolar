import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

// Mock contract metrics data
const mockContractMetrics = {
  totalContracts: 156,
  activeContracts: 142,
  expiredContracts: 8,
  suspendedContracts: 4,
  draftContracts: 2,
  totalValue: 1847500000, // TZS
  monthlyRecurringRevenue: 28450000, // TZS
  contractsExpiringNextMonth: 12,
  contractsByPlanType: [
    {
      type: 'cash',
      count: 68,
      value: 1020000000,
      percentage: 43.6
    },
    {
      type: 'installment',
      count: 52,
      value: 624500000,
      percentage: 33.3
    },
    {
      type: 'paas',
      count: 36,
      value: 203000000,
      percentage: 23.1
    }
  ],
  contractsByStatus: [
    {
      status: 'active',
      count: 142,
      percentage: 91.0
    },
    {
      status: 'expired',
      count: 8,
      percentage: 5.1
    },
    {
      status: 'suspended',
      count: 4,
      percentage: 2.6
    },
    {
      status: 'draft',
      count: 2,
      percentage: 1.3
    }
  ]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In real implementation, calculate these metrics from database
    return NextResponse.json({
      success: true,
      data: mockContractMetrics,
      meta: {
        generatedAt: new Date().toISOString(),
        note: 'Mock data - replace with real database calculations'
      }
    })

  } catch (error) {
    console.error('Error fetching contract metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contract metrics' },
      { status: 500 }
    )
  }
}
