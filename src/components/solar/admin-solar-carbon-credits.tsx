import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Leaf, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Award,
  FileText,
  BarChart3,
  Calculator
} from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'

interface CarbonCredit {
  id: string
  deviceId: string
  facilityId: string
  facilityName: string
  deviceSerial: string
  period: string
  startDate: string
  endDate: string
  energyGenerated: number
  co2Saved: number
  creditsEarned: number
  creditValue: number
  totalValue: number
  verificationStatus: 'pending' | 'verified' | 'certified' | 'rejected'
  certificateId?: string
  verifiedAt?: string
  verifiedBy?: string
  createdAt: string
  metadata: {
    efficiency: number
    operatingHours: number
    baselineEmissions: number
    gridEmissionFactor: number
    calculationMethod: string
  }
}

interface CalculationRequest {
  deviceId: string
  facilityId: string
  period: string
  startDate: string
  endDate: string
  gridEmissionFactor: number
}

export function AdminSolarCarbonCredits() {
  const [activeTab, setActiveTab] = useState('credits')
  const [selectedFacility, setSelectedFacility] = useState('all')
  const [selectedDevice, setSelectedDevice] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')

  // Fetch carbon credits
  const { data: carbonCredits = [], isLoading, refetch } = useQuery({
    queryKey: ['carbon-credits', selectedFacility, selectedDevice, statusFilter, periodFilter],
    queryFn: async (): Promise<CarbonCredit[]> => {
      const params = new URLSearchParams({
        ...(selectedFacility !== 'all' && { facilityId: selectedFacility }),
        ...(selectedDevice !== 'all' && { deviceId: selectedDevice }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(periodFilter !== 'all' && { period: periodFilter }),
        limit: '50'
      })
      
      const response = await fetch(`/api/admin/carbon-credits?${params}`)
      if (!response.ok) throw new Error('Failed to fetch carbon credits')
      const data = await response.json()
      return data.data
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Calculate credits mutation
  const calculateCreditsMutation = useMutation({
    mutationFn: async (request: CalculationRequest) => {
      const response = await fetch('/api/admin/carbon-credits/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      if (!response.ok) throw new Error('Failed to calculate credits')
      return response.json()
    },
    onSuccess: () => {
      refetch()
    }
  })

  // Update credit status mutation
  const updateCreditMutation = useMutation({
    mutationFn: async ({ id, verificationStatus, verifiedBy, notes }: any) => {
      const response = await fetch(`/api/admin/carbon-credits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationStatus, verifiedBy, notes })
      })
      if (!response.ok) throw new Error('Failed to update credit')
      return response.json()
    },
    onSuccess: () => {
      refetch()
    }
  })

  const filteredCredits = carbonCredits.filter(credit => {
    const matchesFacility = selectedFacility === 'all' || credit.facilityId === selectedFacility
    const matchesDevice = selectedDevice === 'all' || credit.deviceId === selectedDevice
    const matchesStatus = statusFilter === 'all' || credit.verificationStatus === statusFilter
    const matchesPeriod = periodFilter === 'all' || credit.period === periodFilter
    
    return matchesFacility && matchesDevice && matchesStatus && matchesPeriod
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'certified': return 'bg-green-100 text-green-800'
      case 'verified': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'certified': return <Award className="h-4 w-4" />
      case 'verified': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'rejected': return <AlertTriangle className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const stats = {
    totalCredits: carbonCredits.reduce((sum, c) => sum + c.creditsEarned, 0),
    totalValue: carbonCredits.reduce((sum, c) => sum + c.totalValue, 0),
    totalCO2: carbonCredits.reduce((sum, c) => sum + c.co2Saved, 0),
    certified: carbonCredits.filter(c => c.verificationStatus === 'certified').length,
    pending: carbonCredits.filter(c => c.verificationStatus === 'pending').length,
    verified: carbonCredits.filter(c => c.verificationStatus === 'verified').length
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading carbon credits...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Solar Carbon Credits</h2>
          <p className="text-muted-foreground">
            Carbon offset tracking and credit management system
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Credits
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold">{stats.totalCredits.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Carbon credits earned</p>
              </div>
              <Leaf className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Market value</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CO₂ Saved</p>
                <p className="text-2xl font-bold">{stats.totalCO2.toFixed(0)} kg</p>
                <p className="text-xs text-muted-foreground">Environmental impact</p>
              </div>
              <Leaf className="h-8 w-8 text-green-700" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Certified</p>
                <p className="text-2xl font-bold">{stats.certified}</p>
                <p className="text-xs text-muted-foreground">Verified credits</p>
              </div>
              <Award className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="credits">Carbon Credits</TabsTrigger>
          <TabsTrigger value="calculator">Credit Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="credits" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Facilities</SelectItem>
                    <SelectItem value="fac-1">Kigali Central Hospital</SelectItem>
                    <SelectItem value="fac-2">Muhanga Health Center</SelectItem>
                    <SelectItem value="fac-3">Rubavu Dispensary</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="certified">Certified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="2024-01">January 2024</SelectItem>
                    <SelectItem value="2024-02">February 2024</SelectItem>
                    <SelectItem value="2024-03">March 2024</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Credits List */}
          <Card>
            <CardHeader>
              <CardTitle>Carbon Credits ({filteredCredits.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredCredits.map((credit) => (
                  <div key={credit.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(credit.verificationStatus)}
                          <div className="flex-1">
                            <h3 className="font-semibold">{credit.facilityName}</h3>
                            <p className="text-sm text-muted-foreground">
                              Device: {credit.deviceSerial} • Period: {credit.period}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(credit.verificationStatus)}>
                              {credit.verificationStatus}
                            </Badge>
                            {credit.certificateId && (
                              <Badge variant="outline">
                                {credit.certificateId}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Energy Generated</p>
                            <p className="text-sm font-medium">{credit.energyGenerated} kWh</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">CO₂ Saved</p>
                            <p className="text-sm font-medium">{credit.co2Saved} kg</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Credits Earned</p>
                            <p className="text-sm font-medium">{credit.creditsEarned.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Value</p>
                            <p className="text-sm font-medium">${credit.totalValue.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs text-muted-foreground">
                          <div>
                            <span>Efficiency: {credit.metadata.efficiency}%</span>
                          </div>
                          <div>
                            <span>Operating Hours: {credit.metadata.operatingHours}</span>
                          </div>
                          <div>
                            <span>Grid Factor: {credit.metadata.gridEmissionFactor}</span>
                          </div>
                          <div>
                            <span>Created: {format(new Date(credit.createdAt), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground">
                            {credit.verifiedAt && (
                              <span>Verified by {credit.verifiedBy} on {format(new Date(credit.verifiedAt), 'MMM dd, yyyy')}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            {credit.verificationStatus === 'pending' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateCreditMutation.mutate({
                                  id: credit.id,
                                  verificationStatus: 'verified',
                                  verifiedBy: 'admin@afyalink.com'
                                })}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                            )}
                            {credit.verificationStatus === 'verified' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => updateCreditMutation.mutate({
                                  id: credit.id,
                                  verificationStatus: 'certified',
                                  verifiedBy: 'admin@afyalink.com',
                                  certificateId: `CC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                                })}
                              >
                                <Award className="h-4 w-4 mr-1" />
                                Certify
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredCredits.length === 0 && (
                <div className="text-center py-8">
                  <Leaf className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No carbon credits found</h3>
                  <p className="text-gray-500">Calculate credits from energy generation data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Carbon Credit Calculator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Credit Calculator</h3>
                <p className="text-gray-500 mb-6">
                  Calculate carbon credits based on energy generation data and grid emission factors
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Calculate New Credits
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminSolarCarbonCredits
