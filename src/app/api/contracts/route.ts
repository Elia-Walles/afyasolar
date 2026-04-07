import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { contracts, facilities } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/contracts
 * Get contracts for a facility
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    // Build query conditions
    const conditions = [eq(contracts.facilityId, facilityId)]
    
    if (status) {
      conditions.push(eq(contracts.status, status))
    }
    
    if (type) {
      conditions.push(eq(contracts.contractType, type))
    }

    const facilityContracts = await db
      .select()
      .from(contracts)
      .where(and(...conditions))
      .orderBy(desc(contracts.createdAt))

    return NextResponse.json({ contracts: facilityContracts })

  } catch (error) {
    console.error('Error fetching contracts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/contracts
 * Create a new contract
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const facilityId = session.user.facilityId
    if (!facilityId) {
      return NextResponse.json({ error: 'Facility ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { 
      contractType, 
      startDate, 
      endDate, 
      monthlyFee, 
      depositPaid, 
      totalPrice, 
      coverageScope,
      terms 
    } = body

    // Validate required fields
    if (!contractType || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: contractType, startDate' },
        { status: 400 }
      )
    }

    // Validate contract type
    const validTypes = ['full-payment', 'paas', 'installment']
    if (!validTypes.includes(contractType)) {
      return NextResponse.json(
        { error: 'Invalid contract type' },
        { status: 400 }
      )
    }

    // Get facility info
    const [facility] = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    // Create contract
    const contract = await db.insert(contracts).values({
      id: generateId(),
      facilityId,
      contractType,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      monthlyFee: monthlyFee ? monthlyFee.toString() : null,
      depositPaid: depositPaid ? depositPaid.toString() : null,
      totalPrice: totalPrice ? totalPrice.toString() : null,
      coverageScope: coverageScope || 'full-facility',
      status: 'active',
      terms: terms || null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        contractType,
        status: 'active',
        message: 'Contract created successfully'
      }
    })

  } catch (error) {
    console.error('Error creating contract:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/contracts/[id]
 * Update contract status or details
 */
export async function PATCH(
  request: NextRequest,
  { params }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { status, endDate, terms } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['active', 'expired', 'terminated', 'suspended']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Update contract
    const [updatedContract] = await db
      .update(contracts)
      .set({
        ...(status && { status }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(terms && { terms }),
        updatedAt: new Date()
      })
      .where(eq(contracts.id, id))
      .returning()

    if (!updatedContract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      contract: updatedContract
    })

  } catch (error) {
    console.error('Error updating contract:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
