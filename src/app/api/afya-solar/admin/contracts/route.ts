import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

// Mock contracts data
interface Contract {
  id: string
  contractNumber: string
  facilityId: string
  facilityName: string
  packageName: string
  planType: 'cash' | 'installment' | 'paas'
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'suspended'
  startDate: string
  endDate?: string
  billingCycle: 'monthly' | 'quarterly' | 'annually'
  totalValue: number
  currency: string
  autoRenew: boolean
  terms: {
    duration: number
    durationUnit: 'months' | 'years'
    maintenanceIncluded: boolean
    supportLevel: 'basic' | 'standard' | 'premium'
    warrantyPeriod: number
  }
  documents: Array<{
    id: string
    name: string
    type: 'contract' | 'invoice' | 'receipt' | 'amendment'
    url: string
    uploadedAt: string
  }>
  createdAt: string
  updatedAt: string
  signedAt?: string
}

const mockContracts: Contract[] = [
  {
    id: '1',
    contractNumber: 'SOL-2024-001',
    facilityId: 'facility-1',
    facilityName: 'St. Mary\'s Hospital',
    packageName: 'Ultra Package (10kW)',
    planType: 'cash',
    status: 'active',
    startDate: new Date('2024-01-15').toISOString(),
    endDate: new Date('2025-01-14').toISOString(),
    billingCycle: 'annually',
    totalValue: 15000000,
    currency: 'TZS',
    autoRenew: true,
    terms: {
      duration: 1,
      durationUnit: 'years',
      maintenanceIncluded: true,
      supportLevel: 'premium',
      warrantyPeriod: 24
    },
    documents: [
      {
        id: '1',
        name: 'Service Agreement - St Mary\'s Hospital.pdf',
        type: 'contract',
        url: '/documents/contracts/SOL-2024-001.pdf',
        uploadedAt: new Date('2024-01-15').toISOString()
      }
    ],
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-15').toISOString(),
    signedAt: new Date('2024-01-15').toISOString()
  },
  {
    id: '2',
    contractNumber: 'SOL-2024-002',
    facilityId: 'facility-2',
    facilityName: 'City Health Center',
    packageName: 'Pro Package (6kW)',
    planType: 'installment',
    status: 'active',
    startDate: new Date('2024-02-01').toISOString(),
    endDate: new Date('2026-02-01').toISOString(),
    billingCycle: 'monthly',
    totalValue: 12000000,
    currency: 'TZS',
    autoRenew: false,
    terms: {
      duration: 24,
      durationUnit: 'months',
      maintenanceIncluded: true,
      supportLevel: 'standard',
      warrantyPeriod: 24
    },
    documents: [
      {
        id: '2',
        name: 'Installment Agreement - City Health Center.pdf',
        type: 'contract',
        url: '/documents/contracts/SOL-2024-002.pdf',
        uploadedAt: new Date('2024-02-01').toISOString()
      }
    ],
    createdAt: new Date('2024-01-25').toISOString(),
    updatedAt: new Date('2024-02-01').toISOString(),
    signedAt: new Date('2024-02-01').toISOString()
  },
  {
    id: '3',
    contractNumber: 'SOL-2024-003',
    facilityId: 'facility-3',
    facilityName: 'Rural Medical Clinic',
    packageName: 'Plus Package (4.2kW)',
    planType: 'paas',
    status: 'active',
    startDate: new Date('2024-03-01').toISOString(),
    billingCycle: 'monthly',
    totalValue: 3600000, // Annual value
    currency: 'TZS',
    autoRenew: true,
    terms: {
      duration: 12,
      durationUnit: 'months',
      maintenanceIncluded: true,
      supportLevel: 'premium',
      warrantyPeriod: 36
    },
    documents: [
      {
        id: '3',
        name: 'PaaS Agreement - Rural Medical Clinic.pdf',
        type: 'contract',
        url: '/documents/contracts/SOL-2024-003.pdf',
        uploadedAt: new Date('2024-03-01').toISOString()
      }
    ],
    createdAt: new Date('2024-02-20').toISOString(),
    updatedAt: new Date('2024-03-01').toISOString(),
    signedAt: new Date('2024-03-01').toISOString()
  },
  {
    id: '4',
    contractNumber: 'SOL-2023-015',
    facilityId: 'facility-4',
    facilityName: 'District Medical Center',
    packageName: 'Essential Package (2kW)',
    planType: 'cash',
    status: 'expired',
    startDate: new Date('2023-01-01').toISOString(),
    endDate: new Date('2024-01-01').toISOString(),
    billingCycle: 'annually',
    totalValue: 8000000,
    currency: 'TZS',
    autoRenew: false,
    terms: {
      duration: 1,
      durationUnit: 'years',
      maintenanceIncluded: false,
      supportLevel: 'basic',
      warrantyPeriod: 12
    },
    documents: [
      {
        id: '4',
        name: 'Service Agreement - District Medical Center.pdf',
        type: 'contract',
        url: '/documents/contracts/SOL-2023-015.pdf',
        uploadedAt: new Date('2023-01-01').toISOString()
      }
    ],
    createdAt: new Date('2022-12-20').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    signedAt: new Date('2023-01-01').toISOString()
  }
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const planType = searchParams.get('planType') || 'all'

    // Filter contracts based on parameters
    let filteredContracts = mockContracts

    if (status !== 'all') {
      filteredContracts = filteredContracts.filter(contract => contract.status === status)
    }

    if (planType !== 'all') {
      filteredContracts = filteredContracts.filter(contract => contract.planType === planType)
    }

    // Sort by creation date (newest first)
    filteredContracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      data: filteredContracts,
      meta: {
        count: filteredContracts.length,
        total: mockContracts.length,
        filters: { status, planType },
        note: 'Mock data - replace with real database queries'
      }
    })

  } catch (error) {
    console.error('Error fetching contracts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contractId = params.id
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Find and update contract (in real implementation, this would update the database)
    const contractIndex = mockContracts.findIndex(contract => contract.id === contractId)
    if (contractIndex === -1) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    mockContracts[contractIndex].status = status
    mockContracts[contractIndex].updatedAt = new Date().toISOString()

    return NextResponse.json({
      success: true,
      data: mockContracts[contractIndex],
      message: 'Contract status updated successfully'
    })

  } catch (error) {
    console.error('Error updating contract:', error)
    return NextResponse.json(
      { error: 'Failed to update contract' },
      { status: 500 }
    )
  }
}
