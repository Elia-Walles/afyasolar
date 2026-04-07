import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import { facilities } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, sql, isNull } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

// Mock support tickets table - in real implementation this would be a proper table
interface SupportTicket {
  id: string
  ticketNumber: string
  facilityId: string
  facilityName: string
  subject: string
  description: string
  category: 'technical' | 'billing' | 'installation' | 'maintenance' | 'general'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  assignedTo?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
}

// Mock data for demonstration
const mockTickets: SupportTicket[] = [
  {
    id: '1',
    ticketNumber: 'SOL-2024-001',
    facilityId: 'facility-1',
    facilityName: 'St. Mary\'s Hospital',
    subject: 'Solar panels not generating expected power',
    description: 'Our solar system is only generating about 60% of the expected power output. We have checked the connections and everything seems fine.',
    category: 'technical',
    priority: 'high',
    status: 'open',
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    ticketNumber: 'SOL-2024-002',
    facilityId: 'facility-2',
    facilityName: 'City Health Center',
    subject: 'Invoice discrepancy for monthly billing',
    description: 'We received an invoice that doesn\'t match our consumption. The amount seems higher than usual.',
    category: 'billing',
    priority: 'medium',
    status: 'in_progress',
    assignedTo: 'support-agent-1',
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    ticketNumber: 'SOL-2024-003',
    facilityId: 'facility-3',
    facilityName: 'Rural Medical Clinic',
    subject: 'Request for additional battery storage',
    description: 'We would like to expand our battery capacity to ensure longer backup during power outages.',
    category: 'installation',
    priority: 'low',
    status: 'resolved',
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
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
    const category = searchParams.get('category') || 'all'
    const priority = searchParams.get('priority') || 'all'

    // Filter tickets based on parameters
    let filteredTickets = mockTickets

    if (status !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === status)
    }

    if (category !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => ticket.category === category)
    }

    if (priority !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => ticket.priority === priority)
    }

    // Sort by creation date (newest first)
    filteredTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      data: filteredTickets,
      meta: {
        count: filteredTickets.length,
        filters: { status, category, priority }
      }
    })

  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { facilityId, subject, description, category, priority } = body

    if (!facilityId || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: facilityId, subject, description' },
        { status: 400 }
      )
    }

    // Get facility name
    const facility = await db
      .select({ name: facilities.name })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .limit(1)

    const facilityName = facility[0]?.name || 'Unknown Facility'

    // Generate ticket number
    const ticketNumber = `SOL-${new Date().getFullYear()}-${String(mockTickets.length + 1).padStart(3, '0')}`

    // Create new ticket (in real implementation, this would be saved to database)
    const newTicket: SupportTicket = {
      id: generateId(),
      ticketNumber,
      facilityId,
      facilityName,
      subject,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open',
      createdBy: session.user.id || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // In real implementation, save to database
    mockTickets.push(newTicket)

    return NextResponse.json({
      success: true,
      data: newTicket,
      message: 'Support ticket created successfully'
    })

  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create support ticket' },
      { status: 500 }
    )
  }
}
