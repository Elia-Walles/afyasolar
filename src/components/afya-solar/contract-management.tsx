'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  FileText, 
  Calendar, 
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Download,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Users,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react'

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

interface ContractMetrics {
  totalContracts: number
  activeContracts: number
  expiredContracts: number
  totalValue: number
  monthlyRecurringRevenue: number
  contractsExpiringNextMonth: number
  contractsByPlanType: Array<{
    type: string
    count: number
    value: number
    percentage: number
  }>
  contractsByStatus: Array<{
    status: string
    count: number
    percentage: number
  }>
}

export default function AfyaSolarContractManagement() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [metrics, setMetrics] = useState<ContractMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planTypeFilter, setPlanTypeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchContracts()
    fetchMetrics()
  }, [statusFilter, planTypeFilter])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: statusFilter,
        planType: planTypeFilter
      })
      
      const response = await fetch(`/api/afya-solar/admin/contracts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch contracts')
      
      const data = await response.json()
      setContracts(data.data || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
      setContracts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/afya-solar/admin/contracts/metrics')
      if (!response.ok) throw new Error('Failed to fetch contract metrics')
      
      const data = await response.json()
      setMetrics(data.data)
    } catch (error) {
      console.error('Error fetching contract metrics:', error)
    }
  }

  const updateContractStatus = async (contractId: string, status: string) => {
    try {
      const response = await fetch(`/api/afya-solar/admin/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (!response.ok) throw new Error('Failed to update contract status')
      
      fetchContracts()
      fetchMetrics()
    } catch (error) {
      console.error('Error updating contract status:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'terminated': return 'bg-red-100 text-red-800'
      case 'suspended': return 'bg-orange-100 text-orange-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlanTypeColor = (planType: string) => {
    switch (planType) {
      case 'cash': return 'bg-blue-100 text-blue-800'
      case 'installment': return 'bg-purple-100 text-purple-800'
      case 'paas': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.packageName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  if (loading && !metrics) {
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
          <h2 className="text-2xl font-bold text-gray-900">Contract Management</h2>
          <p className="text-gray-600">Manage service agreements and contracts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchContracts(); fetchMetrics(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalContracts}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.activeContracts} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                Contract portfolio value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.monthlyRecurringRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Recurring monthly
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{metrics.contractsExpiringNextMonth}</div>
              <p className="text-xs text-muted-foreground">
                Next 30 days
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contract Distribution */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contracts by Plan Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.contractsByPlanType.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-gray-500" />
                      <span className="font-medium capitalize">{item.type}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.count} contracts</p>
                      <p className="text-sm text-gray-500">{formatCurrency(item.value)}</p>
                      <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contracts by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.contractsByStatus.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span className="font-medium capitalize">{item.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{item.count} contracts</span>
                      <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contracts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Plan Type</label>
              <Select value={planTypeFilter} onValueChange={setPlanTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="paas">Power-as-a-Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Contracts</CardTitle>
          <CardDescription>Active and historical service agreements</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No contracts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Plan Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.slice(0, 50).map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                    <TableCell>{contract.facilityName}</TableCell>
                    <TableCell>{contract.packageName}</TableCell>
                    <TableCell>
                      <Badge className={getPlanTypeColor(contract.planType)}>
                        {contract.planType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(contract.status)}>
                        {contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(contract.totalValue)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{contract.terms.duration} {contract.terms.durationUnit}</p>
                        <p className="text-gray-500">
                          {new Date(contract.startDate).toLocaleDateString()} - 
                          {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'Ongoing'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedContract(contract)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Contract Detail Dialog */}
      {selectedContract && (
        <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Contract {selectedContract.contractNumber}</DialogTitle>
              <DialogDescription>
                Service agreement details for {selectedContract.facilityName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Contract Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Facility</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedContract.facilityName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Package</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedContract.packageName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Plan Type</label>
                  <Badge className={getPlanTypeColor(selectedContract.planType)}>
                    {selectedContract.planType.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Badge className={getStatusColor(selectedContract.status)}>
                    {selectedContract.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">Contract Value</label>
                  <p className="text-sm bg-gray-50 p-2 rounded font-semibold">
                    {formatCurrency(selectedContract.totalValue)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Billing Cycle</label>
                  <p className="text-sm bg-gray-50 p-2 rounded capitalize">
                    {selectedContract.billingCycle}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Auto Renew</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {selectedContract.autoRenew ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Contract Terms */}
              <div>
                <label className="text-sm font-medium mb-2 block">Contract Terms</label>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm"><strong>Duration:</strong> {selectedContract.terms.duration} {selectedContract.terms.durationUnit}</p>
                    <p className="text-sm"><strong>Warranty:</strong> {selectedContract.terms.warrantyPeriod} months</p>
                  </div>
                  <div>
                    <p className="text-sm"><strong>Maintenance:</strong> {selectedContract.terms.maintenanceIncluded ? 'Included' : 'Not Included'}</p>
                    <p className="text-sm"><strong>Support Level:</strong> {selectedContract.terms.supportLevel}</p>
                  </div>
                </div>
              </div>

              {/* Important Dates */}
              <div>
                <label className="text-sm font-medium mb-2 block">Important Dates</label>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm"><strong>Start Date:</strong></p>
                    <p className="text-sm">{new Date(selectedContract.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm"><strong>End Date:</strong></p>
                    <p className="text-sm">
                      {selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString() : 'Ongoing'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm"><strong>Signed Date:</strong></p>
                    <p className="text-sm">
                      {selectedContract.signedAt ? new Date(selectedContract.signedAt).toLocaleDateString() : 'Not signed'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <label className="text-sm font-medium mb-2 block">Contract Documents</label>
                <div className="space-y-2">
                  {selectedContract.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{doc.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {selectedContract.status === 'active' && (
                  <Button variant="outline" onClick={() => updateContractStatus(selectedContract.id, 'suspended')}>
                    Suspend Contract
                  </Button>
                )}
                {selectedContract.status === 'suspended' && (
                  <Button onClick={() => updateContractStatus(selectedContract.id, 'active')}>
                    Reactivate Contract
                  </Button>
                )}
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contract
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
