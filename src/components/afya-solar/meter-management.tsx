'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Zap, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Send,
  Power,
  PowerOff
} from 'lucide-react'

interface SmartMeter {
  id: number
  meterSerial: string
  vendor: string
  apiEndpoint: string
  siteAddress: string
  installedAt: string
  lastSeenAt: string
  createdAt: string
  updatedAt: string
  service: {
    id: number
    facilityId: string
    status: string
    siteName: string
  } | null
}

interface MeterCommand {
  id: number
  smartmeterId: number
  clientServiceId: number
  commandType: string
  requestedByUserId: string
  requestedReasonCode: string
  requestedReasonText: string
  status: string
  vendorRequestId: string
  sentAt: string
  ackedAt: string
  errorMessage: string
  createdAt: string
  smartmeter: {
    id: number
    meterSerial: string
    vendor: string
    siteAddress: string
  }
  service: {
    id: number
    facilityId: string
    status: string
    siteName: string
  }
}

interface MeterFormData {
  meterSerial: string
  vendor: string
  apiEndpoint: string
  siteAddress: string
}

export default function AfyaSolarMeterManagement() {
  const [meters, setMeters] = useState<SmartMeter[]>([])
  const [commands, setCommands] = useState<MeterCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCommandDialogOpen, setIsCommandDialogOpen] = useState(false)
  const [selectedMeter, setSelectedMeter] = useState<SmartMeter | null>(null)
  const [formData, setFormData] = useState<MeterFormData>({
    meterSerial: '',
    vendor: '',
    apiEndpoint: '',
    siteAddress: ''
  })
  const [commandFormData, setCommandFormData] = useState({
    smartmeterId: 0,
    clientServiceId: 0,
    commandType: 'ENABLE',
    reasonCode: 'ADMIN_OVERRIDE',
    reasonText: ''
  })

  useEffect(() => {
    fetchMeters()
    fetchCommands()
  }, [searchTerm, vendorFilter, statusFilter])

  const fetchMeters = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(vendorFilter !== 'all' && { vendor: vendorFilter })
      })

      const response = await fetch(`/api/afya-solar/smartmeters?${params}`)
      const data = await response.json()
      setMeters(data.data || [])
    } catch (error) {
      console.error('Error fetching meters:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCommands = async () => {
    try {
      const params = new URLSearchParams({
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/afya-solar/meter-commands?${params}`)
      const data = await response.json()
      setCommands(data.data || [])
    } catch (error) {
      console.error('Error fetching commands:', error)
    }
  }

  const handleCreateMeter = async () => {
    try {
      const response = await fetch('/api/afya-solar/smartmeters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsCreateDialogOpen(false)
        setFormData({ meterSerial: '', vendor: '', apiEndpoint: '', siteAddress: '' })
        fetchMeters()
      }
    } catch (error) {
      console.error('Error creating meter:', error)
    }
  }

  const handleCreateCommand = async () => {
    try {
      const response = await fetch('/api/afya-solar/meter-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandFormData)
      })

      if (response.ok) {
        setIsCommandDialogOpen(false)
        setCommandFormData({
          smartmeterId: 0,
          clientServiceId: 0,
          commandType: 'ENABLE',
          reasonCode: 'ADMIN_OVERRIDE',
          reasonText: ''
        })
        fetchCommands()
      }
    } catch (error) {
      console.error('Error creating command:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'QUEUED': return 'bg-yellow-100 text-yellow-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACKED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCommandColor = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-yellow-100 text-yellow-800'
      case 'SENT': return 'bg-blue-100 text-blue-800'
      case 'ACKED': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCommandIcon = (commandType: string) => {
    return commandType === 'ENABLE' ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />
  }

  const isMeterOnline = (lastSeenAt: string) => {
    const lastSeen = new Date(lastSeenAt)
    const now = new Date()
    const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60)
    return diffHours < 24
  }

  const filteredMeters = meters.filter(meter => {
    const matchesSearch = !searchTerm || 
      meter.meterSerial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meter.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meter.siteAddress?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesVendor = vendorFilter === 'all' || meter.vendor === vendorFilter

    return matchesSearch && matchesVendor
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
          <h1 className="text-3xl font-bold text-gray-900">Smart Meter Management</h1>
          <p className="text-gray-600">Manage smart meters and remote commands</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Register Meter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Smart Meter</DialogTitle>
                <DialogDescription>
                  Add a new smart meter to the system
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="meterSerial">Meter Serial Number</Label>
                  <Input
                    id="meterSerial"
                    value={formData.meterSerial}
                    onChange={(e) => setFormData({ ...formData, meterSerial: e.target.value })}
                    placeholder="e.g., SM001234567"
                  />
                </div>
                <div>
                  <Label htmlFor="vendor">Vendor</Label>
                  <Select value={formData.vendor} onValueChange={(value) => setFormData({ ...formData, vendor: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SolarEdge">SolarEdge</SelectItem>
                      <SelectItem value="Enphase">Enphase</SelectItem>
                      <SelectItem value="Huawei">Huawei</SelectItem>
                      <SelectItem value="Sungrow">Sungrow</SelectItem>
                      <SelectItem value="Fronius">Fronius</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="apiEndpoint">API Endpoint</Label>
                  <Input
                    id="apiEndpoint"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                    placeholder="https://api.vendor.com/meters"
                  />
                </div>
                <div>
                  <Label htmlFor="siteAddress">Site Address</Label>
                  <Input
                    id="siteAddress"
                    value={formData.siteAddress}
                    onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                    placeholder="Physical installation address"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMeter}>
                  Register Meter
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search meters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                <SelectItem value="SolarEdge">SolarEdge</SelectItem>
                <SelectItem value="Enphase">Enphase</SelectItem>
                <SelectItem value="Huawei">Huawei</SelectItem>
                <SelectItem value="Sungrow">Sungrow</SelectItem>
                <SelectItem value="Fronius">Fronius</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { fetchMeters(); fetchCommands(); }}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMeters.map((meter) => (
          <Card key={meter.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <CardTitle className="text-lg">{meter.meterSerial}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  {isMeterOnline(meter.lastSeenAt) ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Online
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800">
                      <Clock className="h-3 w-3 mr-1" />
                      Offline
                    </Badge>
                  )}
                  {meter.service && (
                    <Badge className={getStatusColor(meter.service.status)}>
                      {meter.service.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>
                {meter.vendor} • {meter.siteAddress}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Service Info */}
                {meter.service && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm">
                      <div><strong>Service:</strong> {meter.service.siteName}</div>
                      <div><strong>Facility ID:</strong> {meter.service.facilityId}</div>
                    </div>
                  </div>
                )}

                {/* Status Info */}
                <div className="text-sm space-y-1">
                  <div><strong>Installed:</strong> {meter.installedAt ? new Date(meter.installedAt).toLocaleDateString() : 'Not installed'}</div>
                  <div><strong>Last Seen:</strong> {new Date(meter.lastSeenAt).toLocaleString()}</div>
                  <div><strong>Created:</strong> {new Date(meter.createdAt).toLocaleDateString()}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMeter(meter)
                        setCommandFormData({
                          ...commandFormData,
                          smartmeterId: meter.id,
                          clientServiceId: meter.service?.id || 0
                        })
                        setIsCommandDialogOpen(true)
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Commands */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Commands</CardTitle>
          <CardDescription>Latest smart meter commands and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {commands.slice(0, 10).map((command) => (
              <div key={command.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getCommandIcon(command.commandType)}
                    <span className="font-medium">{command.commandType}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Meter: {command.smartmeter.meterSerial} • {command.smartmeter.vendor}
                  </div>
                  <div className="text-sm text-gray-600">
                    Service: {command.service.siteName}
                  </div>
                  <div className="text-sm text-gray-600">
                    Reason: {command.requestedReasonCode}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getCommandColor(command.status)}>
                    {command.status}
                  </Badge>
                  <Badge variant="outline">{command.requestedReasonCode}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Command Dialog */}
      <Dialog open={isCommandDialogOpen} onOpenChange={setIsCommandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Meter Command</DialogTitle>
            <DialogDescription>
              Send a remote command to the selected smart meter
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Meter</Label>
              <div className="bg-gray-50 p-2 rounded">
                {selectedMeter?.meterSerial} ({selectedMeter?.vendor})
              </div>
            </div>
            <div>
              <Label htmlFor="commandType">Command Type</Label>
              <Select value={commandFormData.commandType} onValueChange={(value) => setCommandFormData({ ...commandFormData, commandType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENABLE">Enable Power</SelectItem>
                  <SelectItem value="DISABLE">Disable Power</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reasonCode">Reason Code</Label>
              <Select value={commandFormData.reasonCode} onValueChange={(value) => setCommandFormData({ ...commandFormData, reasonCode: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN_OVERRIDE">Admin Override</SelectItem>
                  <SelectItem value="OVERDUE">Overdue Payment</SelectItem>
                  <SelectItem value="PLAN_CHANGE">Plan Change</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reasonText">Reason Text</Label>
              <Input
                id="reasonText"
                value={commandFormData.reasonText}
                onChange={(e) => setCommandFormData({ ...commandFormData, reasonText: e.target.value })}
                placeholder="Optional reason description"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsCommandDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCommand}>
              Send Command
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {filteredMeters.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No smart meters found</p>
            <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
              Register First Meter
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
