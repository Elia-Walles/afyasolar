import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'

// Mock system configuration data
interface SystemConfig {
  id: string
  category: 'general' | 'security' | 'notifications' | 'automation' | 'integrations'
  key: string
  value: string | boolean | number
  description: string
  type: 'string' | 'boolean' | 'number' | 'select'
  options?: string[]
}

const mockConfigs: SystemConfig[] = [
  // General Settings
  {
    id: '1',
    category: 'general',
    key: 'System Name',
    value: 'Afya Solar Management System',
    description: 'Display name for the system',
    type: 'string'
  },
  {
    id: '2',
    category: 'general',
    key: 'Default Timezone',
    value: 'Africa/Dar_es_Salaam',
    description: 'Default timezone for the system',
    type: 'string'
  },
  {
    id: '3',
    category: 'general',
    key: 'Maintenance Mode',
    value: false,
    description: 'Enable maintenance mode to disable user access',
    type: 'boolean'
  },
  
  // Security Settings
  {
    id: '4',
    category: 'security',
    key: 'Session Timeout',
    value: 480,
    description: 'Session timeout in minutes',
    type: 'number'
  },
  {
    id: '5',
    category: 'security',
    key: 'Two-Factor Authentication',
    value: false,
    description: 'Require 2FA for admin users',
    type: 'boolean'
  },
  {
    id: '6',
    category: 'security',
    key: 'Password Policy',
    value: 'strong',
    description: 'Password strength requirement',
    type: 'select',
    options: ['weak', 'medium', 'strong']
  },
  
  // Notification Settings
  {
    id: '7',
    category: 'notifications',
    key: 'Email Notifications',
    value: true,
    description: 'Enable email notifications for system events',
    type: 'boolean'
  },
  {
    id: '8',
    category: 'notifications',
    key: 'SMTP Server',
    value: 'smtp.afyasolar.com',
    description: 'SMTP server for outgoing emails',
    type: 'string'
  },
  {
    id: '9',
    category: 'notifications',
    key: 'Alert Email',
    value: 'alerts@afyasolar.com',
    description: 'Email address for system alerts',
    type: 'string'
  },
  
  // Automation Settings
  {
    id: '10',
    category: 'automation',
    key: 'Auto-Suspend Overdue',
    value: true,
    description: 'Automatically suspend services with overdue payments',
    type: 'boolean'
  },
  {
    id: '11',
    category: 'automation',
    key: 'Grace Period Days',
    value: 7,
    description: 'Number of days before auto-suspension',
    type: 'number'
  },
  {
    id: '12',
    category: 'automation',
    key: 'Backup Frequency',
    value: 'daily',
    description: 'System backup frequency',
    type: 'select',
    options: ['hourly', 'daily', 'weekly']
  },
  
  // Integration Settings
  {
    id: '13',
    category: 'integrations',
    key: 'Payment Gateway',
    value: 'flutterwave',
    description: 'Default payment gateway',
    type: 'select',
    options: ['flutterwave', 'mpesa', 'tigo pesa', 'airtel money']
  },
  {
    id: '14',
    category: 'integrations',
    key: 'SMS Provider',
    value: 'twilio',
    description: 'SMS service provider for notifications',
    type: 'select',
    options: ['twilio', 'africastalking', 'infobip']
  },
  {
    id: '15',
    category: 'integrations',
    key: 'API Rate Limit',
    value: 1000,
    description: 'Maximum API requests per hour',
    type: 'number'
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
      data: mockConfigs,
      meta: {
        count: mockConfigs.length,
        note: 'Mock data - replace with real database configuration'
      }
    })

  } catch (error) {
    console.error('Error fetching system config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system configuration' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { configId, value } = body

    if (!configId) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      )
    }

    // Find and update config (in real implementation, this would update the database)
    const configIndex = mockConfigs.findIndex(config => config.id === configId)
    if (configIndex === -1) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    mockConfigs[configIndex].value = value

    return NextResponse.json({
      success: true,
      data: mockConfigs[configIndex],
      message: 'Configuration updated successfully'
    })

  } catch (error) {
    console.error('Error updating system config:', error)
    return NextResponse.json(
      { error: 'Failed to update system configuration' },
      { status: 500 }
    )
  }
}
