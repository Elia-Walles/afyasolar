import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { generateId } from '@/lib/utils'

// Mock users data - in real implementation this would be from database
interface AdminUser {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'admin' | 'support' | 'viewer'
  status: 'active' | 'inactive' | 'suspended'
  lastLogin?: string
  createdAt: string
  permissions: string[]
}

const mockUsers: AdminUser[] = [
  {
    id: '1',
    name: 'System Administrator',
    email: 'admin@afyasolar.com',
    role: 'super_admin',
    status: 'active',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ['all']
  },
  {
    id: '2',
    name: 'John Manager',
    email: 'john.manager@afyasolar.com',
    role: 'admin',
    status: 'active',
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ['users.read', 'users.write', 'analytics.read', 'config.read']
  },
  {
    id: '3',
    name: 'Sarah Support',
    email: 'sarah.support@afyasolar.com',
    role: 'support',
    status: 'active',
    lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ['tickets.read', 'tickets.write', 'customers.read']
  }
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: mockUsers,
      meta: {
        count: mockUsers.length,
        note: 'Mock data - replace with real database queries'
      }
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
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
    const { name, email, role, permissions } = body

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, role' },
        { status: 400 }
      )
    }

    // Create new user (in real implementation, this would be saved to database)
    const newUser: AdminUser = {
      id: generateId(),
      name,
      email,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      permissions: permissions || getDefaultPermissions(role)
    }

    // In real implementation, save to database
    mockUsers.push(newUser)

    return NextResponse.json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case 'super_admin':
      return ['all']
    case 'admin':
      return ['users.read', 'users.write', 'analytics.read', 'config.read', 'config.write']
    case 'support':
      return ['tickets.read', 'tickets.write', 'customers.read', 'energy.read']
    case 'viewer':
      return ['analytics.read', 'energy.read', 'customers.read']
    default:
      return []
  }
}
