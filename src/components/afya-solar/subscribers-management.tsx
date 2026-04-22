'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Users,
  Search,
  Eye,
  Zap,
  DollarSign,
  FileText,
  Bell,
  BarChart3,
  Activity,
  Monitor,
  LayoutDashboard,
  Plug,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  MapPin,
  Phone,
  Mail,
  Calendar,
  AlertTriangle
} from 'lucide-react'
import { useAfyaSolarSubscribers, type AfyaSolarSubscriber } from '@/hooks/use-afya-solar-subscribers'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'

type SortField = 'name' | 'city' | 'status' | 'creditBalance' | 'subscriptionStatus' | 'registeredDate'
type SortOrder = 'asc' | 'desc'

export default function AfyaSolarSubscribersManagement() {
  const router = useRouter()
  const { data: subscribers, isLoading, error, refetch } = useAfyaSolarSubscribers()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending' | 'completed-payment'>('completed-payment')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const metrics = useMemo(() => {
    if (!subscribers) return {
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      lowCredit: 0,
      completedPayment: 0,
      totalCreditBalance: 0,
    }

    const total = subscribers.length
    const active = subscribers.filter(s => s.status === 'active').length
    const inactive = subscribers.filter(s => s.status === 'inactive').length
    const suspended = subscribers.filter(s => s.status === 'suspended').length
    const lowCredit = subscribers.filter(s => s.status === 'low_credit').length
    const completedPayment = subscribers.filter(s => s.paymentStatus === 'completed').length
    const totalCreditBalance = subscribers.reduce((sum, s) => sum + (s.creditBalance || 0), 0)

    return {
      total,
      active,
      inactive,
      suspended,
      lowCredit,
      completedPayment,
      totalCreditBalance,
    }
  }, [subscribers])

  // Apply filters and sorting
  const filteredAndSortedSubscribers = useMemo(() => {
    if (!subscribers) return []
    
    let filtered = subscribers

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(subscriber => 
        subscriber.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscriber.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscriber.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscriber.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscriber.smartmeterSerial?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed-payment') {
        // Filter facilities with completed Afya Solar payments OR active subscriptions
        filtered = filtered.filter(subscriber => 
          subscriber.paymentStatus === 'completed' || 
          (subscriber.subscriptionStatus === 'active' && subscriber.paymentStatus === 'completed')
        )
      } else {
        // Regular status filters
        filtered = filtered.filter(subscriber => subscriber.status === statusFilter)
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (sortField === 'creditBalance' || sortField === 'registeredDate') {
        aValue = Number(aValue) || 0
        bValue = Number(bValue) || 0
      } else {
        aValue = String(aValue || '').toLowerCase()
        bValue = String(bValue || '').toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [subscribers, searchQuery, statusFilter, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'suspended': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed-payment': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSubscriptionColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'trial': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewFacilityDashboard = (facilityId: string, section: string = 'overview') => {
    // Navigate to facility dashboard as admin with specific section
    router.push(`/dashboard/admin/facility/${facilityId}?section=${section}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-600 text-center">
          <h3 className="text-lg font-medium mb-2">Failed to load subscribers</h3>
          <p className="text-sm text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Afya Solar Subscribers</h2>
          <p className="text-gray-600">Manage facilities subscribed to Afya Solar services</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">
              All facilities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Payments</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.completedPayment}</div>
            <p className="text-xs text-muted-foreground">
              Paid subscribers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{metrics.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Not active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Credit</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.lowCredit}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.suspended}</div>
            <p className="text-xs text-muted-foreground">
              Service suspended
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalCreditBalance)}</div>
            <p className="text-xs text-muted-foreground">
              Across all subscribers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search facilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
              <option value="completed-payment">Completed Payment</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Subscribers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriber Facilities ({filteredAndSortedSubscribers.length})</CardTitle>
          <CardDescription>
            Click on any facility to view and control their dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('name')}
                      className="font-medium"
                    >
                      Facility {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </Button>
                  </th>
                  <th className="text-left p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('city')}
                      className="font-medium"
                    >
                      Location {sortField === 'city' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </Button>
                  </th>
                  <th className="text-left p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('status')}
                      className="font-medium"
                    >
                      Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </Button>
                  </th>
                  <th className="text-left p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleSort('creditBalance')}
                      className="font-medium"
                    >
                      Credit Balance {sortField === 'creditBalance' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </Button>
                  </th>
                  <th className="text-left p-2">Smart Meter</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSubscribers.map((subscriber, index) => (
                  <tr key={`${subscriber.id}-${index}`} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{subscriber.name}</div>
                        <div className="text-sm text-gray-600">{subscriber.region}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        {subscriber.city}
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={getStatusColor(subscriber.status)}>
                        {subscriber.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className={subscriber.creditBalance < 10000 ? 'text-red-600 font-medium' : ''}>
                        {formatCurrency(subscriber.creditBalance)}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-gray-400" />
                        {subscriber.smartmeterSerial || 'N/A'}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleViewFacilityDashboard(subscriber.id, 'overview')}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Dashboard
                        </Button>
                        
                        <div className="relative group">
                          <Button size="sm" variant="outline">
                            <LayoutDashboard className="h-3 w-3" />
                          </Button>
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                            <div className="py-1">
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'overview')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <LayoutDashboard className="h-3 w-3" />
                                Overview
                              </button>
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'devices')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Plug className="h-3 w-3" />
                                Devices
                              </button>
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'energy')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Zap className="h-3 w-3" />
                                Energy
                              </button>
                              {/* Live Monitoring entry removed from facility dashboard navigation */}
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'bills-payment')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <DollarSign className="h-3 w-3" />
                                Bills & Payment
                              </button>
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'subscription')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <FileText className="h-3 w-3" />
                                Subscription
                              </button>
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'notifications')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Bell className="h-3 w-3" />
                                Notifications & Alerts
                              </button>
                              <button
                                onClick={() => handleViewFacilityDashboard(subscriber.id, 'overview')}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                              >
                                <BarChart3 className="h-3 w-3" />
                                Overview report
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredAndSortedSubscribers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No subscribers found matching your criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
