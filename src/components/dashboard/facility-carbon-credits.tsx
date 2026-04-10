"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Leaf, 
  TrendingUp, 
  DollarSign, 
  Calculator,
  Calendar,
  BarChart3,
  Award,
  RefreshCw,
  Download,
  Plus
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface CarbonCredit {
  id: string
  deviceId: string
  facilityId: string
  period: string
  startDate: string
  endDate: string
  energyGenerated: number // kWh
  co2Saved: number // kg
  creditsEarned: number // tons
  creditValue: number // USD per ton
  totalValue: number // USD
  verificationStatus: 'pending' | 'verified' | 'certified' | 'rejected'
  metadata: {
    efficiency: number
    operatingHours: number
    baselineEmissions: number
    gridEmissionFactor: number
    calculationMethod: string
  }
  createdAt: string
}

interface FacilityCarbonCreditsProps {
  facilityId: string
}

export function FacilityCarbonCredits({ facilityId }: FacilityCarbonCreditsProps) {
  // Radix SelectItem disallows empty string values; use 'all' sentinel.
  const [selectedDevice, setSelectedDevice] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('monthly')
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Fetch facility devices
  const { data: devices = [] } = useQuery({
    queryKey: ['facility-devices', facilityId],
    queryFn: async () => {
      const response = await fetch(`/api/devices?facilityId=${facilityId}`)
      if (!response.ok) throw new Error('Failed to fetch devices')
      const data = await response.json()
      return data.data || []
    }
  })

  // Fetch carbon credits
  const { data: carbonCredits = [], isLoading, refetch } = useQuery({
    queryKey: ['facility-carbon-credits', facilityId, selectedDevice, selectedPeriod],
    queryFn: async (): Promise<CarbonCredit[]> => {
      const params = new URLSearchParams({
        facilityId,
        ...(selectedDevice && selectedDevice !== 'all' && { deviceId: selectedDevice }),
        ...(selectedPeriod && selectedPeriod !== 'all' && { period: selectedPeriod }),
        limit: '12'
      })
      
      const response = await fetch(`/api/facility/carbon-credits/calculate?${params}`)
      if (!response.ok) throw new Error('Failed to fetch carbon credits')
      const data = await response.json()
      return data.data || []
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Calculate credits mutation
  const calculateCreditsMutation = useMutation({
    mutationFn: async (request: any) => {
      const response = await fetch('/api/facility/carbon-credits/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      if (!response.ok) throw new Error('Failed to calculate credits')
      return response.json()
    },
    onSuccess: () => {
      refetch()
      setIsCalculatorOpen(false)
      toast.success('Carbon credits calculated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to calculate carbon credits')
    }
  })

  const stats = {
    totalCredits: carbonCredits.reduce((sum, c) => sum + c.creditsEarned, 0),
    totalValue: carbonCredits.reduce((sum, c) => sum + c.totalValue, 0),
    totalCO2: carbonCredits.reduce((sum, c) => sum + c.co2Saved, 0),
    pending: carbonCredits.filter(c => c.verificationStatus === 'pending').length,
    verified: carbonCredits.filter(c => c.verificationStatus === 'verified').length,
    certified: carbonCredits.filter(c => c.verificationStatus === 'certified').length
  }

  const handleCalculateCredits = () => {
    if (!selectedDevice || selectedDevice === 'all' || !startDate || !endDate) {
      toast.error('Please select device and date range')
      return
    }

    calculateCreditsMutation.mutate({
      facilityId,
      deviceId: selectedDevice,
      period: selectedPeriod,
      startDate,
      endDate,
      gridEmissionFactor: 0.5 // Rwanda grid average
    })
  }

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
      case 'verified': return <TrendingUp className="h-4 w-4" />
      case 'pending': return <Calendar className="h-4 w-4" />
      case 'rejected': return <div className="h-4 w-4 rounded-full bg-red-500" />
      default: return <Leaf className="h-4 w-4" />
    }
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
          <h2 className="text-2xl font-bold">Carbon Credits</h2>
          <p className="text-muted-foreground">
            Track your environmental impact and carbon offset contributions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen}>
            <DialogTrigger asChild>
              <Button>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Credits
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Calculate Carbon Credits
                </DialogTitle>
                <DialogDescription>
                  Calculate carbon credits based on your solar energy generation for a specific period.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="device" className="text-right">
                    Device
                  </Label>
                  <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select device" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device: any) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name || device.serialNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="period" className="text-right">
                    Period
                  </Label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="start-date" className="text-right">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="end-date" className="text-right">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCalculatorOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCalculateCredits}
                  disabled={calculateCreditsMutation.isPending}
                >
                  {calculateCreditsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Calculate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Devices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {devices.map((device: any) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name || device.serialNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Periods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Credits List */}
      <Card>
        <CardHeader>
          <CardTitle>Carbon Credits History ({carbonCredits.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {carbonCredits.map((credit) => (
              <div key={credit.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(credit.verificationStatus)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{credit.period}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(credit.startDate), 'MMM dd, yyyy')} - {format(new Date(credit.endDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(credit.verificationStatus)}>
                          {credit.verificationStatus}
                        </Badge>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {carbonCredits.length === 0 && (
            <div className="text-center py-8">
              <Leaf className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No carbon credits found</h3>
              <p className="text-gray-500 mb-4">Calculate your first carbon credits from energy generation data</p>
              <Button onClick={() => setIsCalculatorOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Calculate Credits
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
