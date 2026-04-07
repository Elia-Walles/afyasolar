'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Zap, 
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Package
} from 'lucide-react'

interface ClientService {
  id: number
  facilityId: string
  status: string
  siteName: string
  serviceLocation: string
  startDate: string | null
  endDate: string | null
  autoSuspendEnabled: boolean
  graceDays: number
  adminNotes: string
  createdAt: string
  updatedAt: string
  package: {
    id: number
    code: string
    name: string
    ratedKw: number
    suitableFor: string
  }
  plan: {
    id: number
    planTypeCode: string
    currency: string
    pricing: {
      cashPrice?: number
      installmentDurationMonths?: number
      defaultUpfrontPercent?: string
      defaultMonthlyAmount?: number
      eaasMonthlyFee?: number
      eaasBillingModel?: string
    }
  }
  facility: {
    id: string
    name: string
    city: string
    region: string
    phone: string
    email: string
  }
  smartmeter: {
    id: number
    meterSerial: string
    vendor: string
    siteAddress: string
    installedAt: string
    lastSeenAt: string
  } | null
}

interface ServiceDetails {
  service: ClientService
  statusHistory: Array<{
    id: number
    oldStatus: string
    newStatus: string
    reasonCode: string
    reasonText: string
    createdAt: string
  }>
  contracts: {
    type: string
    contract: any
  } | null
}

export default function AfyaSolarServiceManagement() {
  const [services, setServices] = useState<ClientService[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planTypeFilter, setPlanTypeFilter] = useState('all')
  const [selectedService, setSelectedService] = useState<ServiceDetails | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  useEffect(() => {
    fetchServices()
  }, [searchTerm, statusFilter, planTypeFilter, pagination.page])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(planTypeFilter !== 'all' && { planType: planTypeFilter })
      })

      const response = await fetch(`/api/afya-solar/client-services?${params}`)
      const data = await response.json()
      
      setServices(data.data?.services || [])
      setPagination(prev => ({
        ...prev,
        total: data.data?.pagination?.total || 0,
        pages: data.data?.pagination?.pages || 0
      }))
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceDetails = async (serviceId: number) => {
    try {
      const response = await fetch(`/api/afya-solar/client-services/${serviceId}`)
      const data = await response.json()
      setSelectedService(data.data)
      setIsDetailsDialogOpen(true)
    } catch (error) {
      console.error('Error fetching service details:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'SUSPENDED_OVERDUE': return 'bg-red-100 text-red-800'
      case 'SUSPENDED_ADMIN': return 'bg-orange-100 text-orange-800'
      case 'PENDING_INSTALL': return 'bg-blue-100 text-blue-800'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800'
      case 'COMPLETED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="h-4 w-4" />
      case 'SUSPENDED_OVERDUE': return <AlertTriangle className="h-4 w-4" />
      case 'SUSPENDED_ADMIN': return <AlertTriangle className="h-4 w-4" />
      case 'PENDING_INSTALL': return <Clock className="h-4 w-4" />
      default: return <Users className="h-4 w-4" />
    }
  }

  const getPlanTypeColor = (planTypeCode: string) => {
    switch (planTypeCode) {
      case 'CASH': return 'bg-green-100 text-green-800'
      case 'INSTALLMENT': return 'bg-blue-100 text-blue-800'
      case 'EAAS': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredServices = services.filter(service => {
    const matchesSearch = !searchTerm || 
      service.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.facility.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.package.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter
    const matchesPlanType = planTypeFilter === 'all' || service.plan.planTypeCode === planTypeFilter

    return matchesSearch && matchesStatus && matchesPlanType
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Management</h1>
          <p className="text-gray-600">Manage client solar services and installations</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Service
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING_INSTALL">Pending Install</SelectItem>
                <SelectItem value="SUSPENDED_OVERDUE">Suspended (Overdue)</SelectItem>
                <SelectItem value="SUSPENDED_ADMIN">Suspended (Admin)</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planTypeFilter} onValueChange={setPlanTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by plan type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plan Types</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="INSTALLMENT">Installment</SelectItem>
                <SelectItem value="EAAS">EAAS</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchServices}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Services List */}
      <div className="space-y-4">
        {filteredServices.map((service) => (
          <Card key={service.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-4">
                    <h3 className="text-lg font-semibold">{service.siteName || 'Unnamed Site'}</h3>
                    <Badge className={getStatusColor(service.status)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(service.status)}
                        <span>{service.status.replace('_', ' ')}</span>
                      </div>
                    </Badge>
                    <Badge className={getPlanTypeColor(service.plan.planTypeCode)}>
                      {service.plan.planTypeCode}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span>{service.package.name} ({service.package.ratedKw} kW)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{service.facility.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{service.facility.city}, {service.facility.region}</span>
                    </div>
                  </div>

                  {service.smartmeter && (
                    <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                      <Zap className="h-4 w-4" />
                      <span>Meter: {service.smartmeter.meterSerial} ({service.smartmeter.vendor})</span>
                    </div>
                  )}

                  {service.serviceLocation && (
                    <div className="flex items-center space-x-2 mt-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{service.serviceLocation}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 mt-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Created: {new Date(service.createdAt).toLocaleDateString()}</span>
                    </div>
                    {service.startDate && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Started: {new Date(service.startDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchServiceDetails(service.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} services
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.page + 1, prev.pages) }))}
              disabled={pagination.page === pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Service Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Details</DialogTitle>
            <DialogDescription>
              Complete information about the selected solar service
            </DialogDescription>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Service Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Site Name:</strong> {selectedService.service.siteName}</div>
                    <div><strong>Status:</strong> <Badge className={getStatusColor(selectedService.service.status)}>{selectedService.service.status}</Badge></div>
                    <div><strong>Location:</strong> {selectedService.service.serviceLocation}</div>
                    <div><strong>Created:</strong> {new Date(selectedService.service.createdAt).toLocaleDateString()}</div>
                    {selectedService.service.startDate && (
                      <div><strong>Started:</strong> {new Date(selectedService.service.startDate).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Facility Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {selectedService.service.facility.name}</div>
                    <div><strong>Location:</strong> {selectedService.service.facility.city}, {selectedService.service.facility.region}</div>
                    <div><strong>Phone:</strong> {selectedService.service.facility.phone}</div>
                    <div><strong>Email:</strong> {selectedService.service.facility.email}</div>
                  </div>
                </div>
              </div>

              {/* Package & Plan */}
              <div>
                <h4 className="font-medium mb-2">Package & Plan</h4>
                <div className="bg-gray-50 p-4 rounded">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div><strong>Package:</strong> {selectedService.service.package.name}</div>
                      <div><strong>Code:</strong> {selectedService.service.package.code}</div>
                      <div><strong>Power:</strong> {selectedService.service.package.ratedKw} kW</div>
                      <div><strong>Suitable For:</strong> {selectedService.service.package.suitableFor}</div>
                    </div>
                    <div>
                      <div><strong>Plan Type:</strong> <Badge className={getPlanTypeColor(selectedService.service.plan.planTypeCode)}>{selectedService.service.plan.planTypeCode}</Badge></div>
                      <div><strong>Currency:</strong> {selectedService.service.plan.currency}</div>
                      {selectedService.service.plan.pricing.cashPrice && (
                        <div><strong>Cash Price:</strong> TZS {selectedService.service.plan.pricing.cashPrice.toLocaleString()}</div>
                      )}
                      {selectedService.service.plan.pricing.defaultMonthlyAmount && (
                        <div><strong>Monthly Amount:</strong> TZS {selectedService.service.plan.pricing.defaultMonthlyAmount.toLocaleString()}</div>
                      )}
                      {selectedService.service.plan.pricing.eaasMonthlyFee && (
                        <div><strong>EAAS Fee:</strong> TZS {selectedService.service.plan.pricing.eaasMonthlyFee.toLocaleString()}/mo</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Smart Meter */}
              {selectedService.service.smartmeter && (
                <div>
                  <h4 className="font-medium mb-2">Smart Meter</h4>
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Serial:</strong> {selectedService.service.smartmeter.meterSerial}</div>
                      <div><strong>Vendor:</strong> {selectedService.service.smartmeter.vendor}</div>
                      <div><strong>Site Address:</strong> {selectedService.service.smartmeter.siteAddress}</div>
                      <div><strong>Installed:</strong> {new Date(selectedService.service.smartmeter.installedAt).toLocaleDateString()}</div>
                      <div><strong>Last Seen:</strong> {new Date(selectedService.service.smartmeter.lastSeenAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status History */}
              {selectedService.statusHistory && selectedService.statusHistory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Status History</h4>
                  <div className="space-y-2">
                    {selectedService.statusHistory.map((history) => (
                      <div key={history.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium">{history.newStatus}</div>
                          <div className="text-sm text-gray-600">{history.reasonText}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{new Date(history.createdAt).toLocaleDateString()}</div>
                          <Badge variant="outline">{history.reasonCode}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {filteredServices.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No services found</p>
            <p className="text-sm text-gray-500">Try adjusting your filters or create a new service</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
