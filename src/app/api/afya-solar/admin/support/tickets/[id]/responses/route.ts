import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { generateId } from '@/lib/utils'

// Mock responses storage - in real implementation this would be a proper table
interface SupportResponse {
  id: string
  ticketId: string
  message: string
  isInternal: boolean
  createdBy: string
  createdAt: string
}

const mockResponses: SupportResponse[] = [
  {
    id: '1',
    ticketId: '1',
    message: 'We have received your ticket and are investigating the issue. Our technical team will contact you within 24 hours.',
    isInternal: false,
    createdBy: 'support-agent-1',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
]

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const body = await request.json()
    const { message, isInternal } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Create new response (in real implementation, this would be saved to database)
    const newResponse: SupportResponse = {
      id: generateId(),
      ticketId,
      message,
      isInternal: isInternal || false,
      createdBy: session.user.id || 'admin',
      createdAt: new Date().toISOString()
    }

    // In real implementation, save to database
    mockResponses.push(newResponse)

    return NextResponse.json({
      success: true,
      data: newResponse,
      message: 'Response added successfully'
    })

  } catch (error) {
    console.error('Error adding response:', error)
    return NextResponse.json(
      { error: 'Failed to add response' },
      { status: 500 }
    )
  }
}
