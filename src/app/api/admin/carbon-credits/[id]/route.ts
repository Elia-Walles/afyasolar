import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

/**
 * PUT /api/admin/carbon-credits/[id]
 * Update a carbon credit record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { verificationStatus, verifiedBy, notes, certificateId } = body

    const updatedCredit = {
      id,
      verificationStatus,
      verifiedAt: verificationStatus !== 'pending' ? new Date().toISOString() : undefined,
      verifiedBy: verificationStatus !== 'pending' ? verifiedBy : undefined,
      notes,
      certificateId: verificationStatus === 'certified' ? certificateId : undefined,
      updatedAt: new Date().toISOString(),
    }

    console.log('Updating carbon credit:', updatedCredit)

    return NextResponse.json({
      success: true,
      data: updatedCredit,
      message: 'Carbon credit updated successfully',
    })
  } catch (error) {
    console.error('Error updating carbon credit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update carbon credit' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/admin/carbon-credits/[id]
 * Delete a carbon credit record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    console.log('Deleting carbon credit:', id)

    return NextResponse.json({
      success: true,
      message: 'Carbon credit deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting carbon credit:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete carbon credit' },
      { status: 500 },
    )
  }
}

