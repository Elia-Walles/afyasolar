"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Zap, 
  DollarSign, 
  TrendingDown, 
  Leaf, 
  Battery,
  Sun,
  BarChart3,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface SimulatedFacility {
  id: string
  name: string
  location: string
  region: string
  status: string
  solarStatus: string
  paygStatus: string
  installationDate: string
  paygOperationalDate: string
  energyConsumptionBefore: number
  energyConsumptionAfter: number
  monthlyEnergySavings: number
  electricityCostBefore: string
  electricityCostAfter: string
  monthlyCostSavings: string
  carbonEmissionReduction: number
  solarCapacity: number
  batteryCapacity: number
  smartMeterSerial: string
  facilityType: string
  notes: string
}

interface DashboardStats {
  totalFacilities: number
  totalEnergySavings: number
  totalCostSavings: number
  totalCarbonReduction: number
  totalSolarCapacity: number
  averageEnergyReduction: number
  averageCostReduction: number
}

export default function SimulatedDashboard() {
  const [facilities, setFacilities] = useState<SimulatedFacility[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchSimulatedData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/investor/simulated-facilities')
      if (!response.ok) throw new Error('Failed to fetch simulated data')
      
      const data = await response.json()
      setFacilities(data.facilities || [])
      setStats(data.stats || null)
    } catch (error) {
      console.error('Error fetching simulated data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSimulatedData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'operational':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPerformanceBadge = (savingsPercent: number) => {
    if (savingsPercent >= 50) return { text: 'Excellent', color: 'bg-green-100 text-green-800' }
    if (savingsPercent >= 40) return { text: 'Very Good', color: 'bg-blue-100 text-blue-800' }
    if (savingsPercent >= 30) return { text: 'Good', color: 'bg-yellow-100 text-yellow-800' }
    return { text: 'Fair', color: 'bg-gray-100 text-gray-800' }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading investor dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Afya Solar - Investor Dashboard</h1>
            <p className="text-gray-600 mt-2">Real-time performance monitoring of installed facilities</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchSimulatedData}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Active Facilities</CardTitle>
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalFacilities}</div>
              <p className="text-sm text-gray-600">Fully operational sites</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Monthly Energy Savings</CardTitle>
                <Zap className="w-5 h-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalEnergySavings.toLocaleString()}</div>
              <p className="text-sm text-gray-600">kWh per month</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Monthly Cost Savings</CardTitle>
                <DollarSign className="w-5 h-5 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">TZS {Number(stats.totalCostSavings).toLocaleString()}</div>
              <p className="text-sm text-gray-600">Across all facilities</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">CO₂ Reduction</CardTitle>
                <Leaf className="w-5 h-5 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalCarbonReduction.toLocaleString()}</div>
              <p className="text-sm text-gray-600">kg per month</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Overview */}
      {stats && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Performance Overview
            </CardTitle>
            <CardDescription>Average improvements across all installed facilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">{stats.averageEnergyReduction}%</div>
                <p className="text-sm text-gray-600">Average Energy Reduction</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{stats.averageCostReduction}%</div>
                <p className="text-sm text-gray-600">Average Cost Reduction</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">{stats.totalSolarCapacity} kW</div>
                <p className="text-sm text-gray-600">Total Solar Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Facilities Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Installed Facilities - Performance Details
          </CardTitle>
          <CardDescription>Before and after comparison for each facility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {facilities.map((facility) => {
              const energyReductionPercent = Math.round((facility.monthlyEnergySavings / facility.energyConsumptionBefore) * 100)
              const costReductionPercent = Math.round((Number(facility.monthlyCostSavings) / Number(facility.electricityCostBefore)) * 100)
              const performanceBadge = getPerformanceBadge(energyReductionPercent)

              return (
                <div key={facility.id} className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
                  {/* Facility Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{facility.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {facility.location}, {facility.region}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Installed: {new Date(facility.installationDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(facility.status)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {facility.status}
                      </Badge>
                      <Badge variant="outline" className={performanceBadge.color}>
                        {performanceBadge.text}
                      </Badge>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Energy Consumption */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">Energy Consumption</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Before:</span>
                          <span className="font-medium">{facility.energyConsumptionBefore.toLocaleString()} kWh</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">After:</span>
                          <span className="font-medium text-green-600">{facility.energyConsumptionAfter.toLocaleString()} kWh</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-green-600">
                          <span>Savings:</span>
                          <span>-{energyReductionPercent}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost Analysis */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-700">Monthly Costs</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Before:</span>
                          <span className="font-medium">TZS {Number(facility.electricityCostBefore).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">After:</span>
                          <span className="font-medium text-green-600">TZS {Number(facility.electricityCostAfter).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-green-600">
                          <span>Savings:</span>
                          <span>-{costReductionPercent}%</span>
                        </div>
                      </div>
                    </div>

                    {/* System Specs */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-gray-700">System Specifications</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Solar Capacity:</span>
                          <span className="font-medium">{facility.solarCapacity} kW</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Battery:</span>
                          <span className="font-medium">{facility.batteryCapacity} kWh</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Meter:</span>
                          <span className="font-medium">{facility.smartMeterSerial}</span>
                        </div>
                      </div>
                    </div>

                    {/* Environmental Impact */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Leaf className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-medium text-gray-700">Environmental Impact</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">CO₂ Reduction:</span>
                          <span className="font-medium">{facility.carbonEmissionReduction.toLocaleString()} kg/month</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">PAYG Status:</span>
                          <span className="font-medium text-green-600">{facility.paygStatus}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">{facility.facilityType}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {facility.notes && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> {facility.notes}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
