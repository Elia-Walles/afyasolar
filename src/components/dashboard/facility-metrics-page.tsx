"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useFacility } from "@/hooks/use-facilities"
import { useEnergyData } from "@/hooks/use-energy-data"
import { useDevices } from "@/hooks/use-devices"
import { formatCurrency } from "@/lib/utils"
import { 
  ArrowLeft, 
  Zap, 
  Sun, 
  Battery, 
  BarChart3, 
  DollarSign, 
  Building2, 
  MapPin, 
  Phone, 
  CreditCard,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Plug
} from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface FacilityMetricsPageProps {
  facilityId: string
}

export function FacilityMetricsPage({ facilityId }: FacilityMetricsPageProps) {
  const { data: facility, isLoading: facilityLoading } = useFacility(facilityId)
  const { data: energyData, isLoading: energyLoading } = useEnergyData(undefined, facilityId)
  const { data: devices, isLoading: devicesLoading } = useDevices(facilityId)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')

  const metrics = useMemo(() => {
    if (!energyData || energyData.length === 0) {
      return {
        totalConsumption: 0,
        avgPower: 0,
        maxPower: 0,
        totalSolarGeneration: 0,
        avgBatteryLevel: 0,
        gridConsumption: 0,
        solarPercentage: 0,
        costSavings: 0,
      }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    let filteredData = energyData
    if (timeRange === 'today') {
      filteredData = energyData.filter(d => new Date(d.timestamp) >= today)
    } else if (timeRange === 'week') {
      filteredData = energyData.filter(d => new Date(d.timestamp) >= weekAgo)
    } else if (timeRange === 'month') {
      filteredData = energyData.filter(d => new Date(d.timestamp) >= monthAgo)
    }

    const totalConsumption = filteredData.reduce((sum, d) => sum + Number(d.energy), 0)
    const avgPower = filteredData.length > 0 
      ? filteredData.reduce((sum, d) => sum + Number(d.power), 0) / filteredData.length 
      : 0
    const maxPower = Math.max(...filteredData.map(d => Number(d.power)), 0)
    const totalSolarGeneration = filteredData.reduce((sum, d) => sum + (Number(d.solarGeneration) || 0), 0)
    const batteryLevels = filteredData.filter(d => d.batteryLevel).map(d => Number(d.batteryLevel))
    const avgBatteryLevel = batteryLevels.length > 0
      ? batteryLevels.reduce((sum, b) => sum + b, 0) / batteryLevels.length
      : 0

    const gridConsumption = totalConsumption - totalSolarGeneration
    const solarPercentage = totalConsumption > 0 ? (totalSolarGeneration / totalConsumption) * 100 : 0
    
    const ratePerKwh = 357.14285
    const gridCost = gridConsumption * ratePerKwh
    const costSavings = gridCost - (gridCost * (1 - solarPercentage / 100))
    
    return {
      totalConsumption,
      avgPower,
      maxPower,
      totalSolarGeneration,
      avgBatteryLevel,
      gridConsumption,
      solarPercentage,
      costSavings,
    }
  }, [energyData, timeRange])

  if (facilityLoading || energyLoading || devicesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading facility metrics...</p>
        </div>
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4 font-medium">Facility not found</p>
            <Button asChild>
              <Link href="/dashboard/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Management Panel
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const creditBalance = Number(facility.creditBalance || 0)
  const isLowCredit = creditBalance < 10000

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" asChild className="mt-1">
              <Link href="/dashboard/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{facility.name}</h1>
                <Badge 
                  variant={facility.status === 'active' ? 'default' : 'secondary'}
                  className={cn(
                    "text-xs font-semibold",
                    facility.status === 'active' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-200 text-gray-700'
                  )}
                >
                  {facility.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>{facility.city}, {facility.region}</span>
                </div>
                {facility.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    <span>{facility.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Facility Information Card */}
        <Card className="border-2 border-green-100 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-600" />
              Facility Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credit Balance</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <p className={cn(
                    "text-lg font-bold",
                    isLowCredit ? "text-yellow-600" : "text-gray-900"
                  )}>
                    {formatCurrency(creditBalance)}
                  </p>
                </div>
                {isLowCredit && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                    Low Credit
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Model</p>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-green-600" />
                  <p className="text-lg font-semibold text-gray-900 capitalize">{facility.paymentModel || 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</p>
                <p className="text-sm text-gray-700 line-clamp-2">{facility.address || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Devices</p>
                <div className="flex items-center gap-2">
                  <Plug className="w-4 h-4 text-green-600" />
                  <p className="text-lg font-semibold text-gray-900">{devices?.length || 0} Active</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Range Selector */}
        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Time Range</p>
              <div className="flex gap-2">
                {(['today', 'week', 'month'] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    onClick={() => setTimeRange(range)}
                    size="sm"
                    className={cn(
                      timeRange === range 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'hover:bg-gray-50'
                    )}
                  >
                    {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Metrics - Large Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Total Consumption</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.totalConsumption.toFixed(2)}</div>
              <p className="text-xs font-medium text-gray-600">kWh</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Solar Generation</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                <Sun className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.totalSolarGeneration.toFixed(2)}</div>
              <p className="text-xs font-medium text-gray-600">
                kWh • <span className="text-yellow-700 font-semibold">{metrics.solarPercentage.toFixed(1)}%</span> of total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Credit Balance</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">{formatCurrency(creditBalance)}</div>
              <p className="text-xs font-medium text-gray-600">Available balance</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Cost Savings</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-1">{formatCurrency(metrics.costSavings)}</div>
              <p className="text-xs font-medium text-gray-600">From solar generation</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Average Power</CardTitle>
              <BarChart3 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.avgPower.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">Watts</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Peak Power</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.maxPower.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">Watts</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Average Battery</CardTitle>
              <Battery className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.avgBatteryLevel.toFixed(0)}%</div>
              <p className="text-xs text-gray-600 mt-1">Battery level</p>
            </CardContent>
          </Card>
        </div>

        {/* Devices Section */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="w-5 h-5 text-green-600" />
                  Devices
                </CardTitle>
                <CardDescription className="mt-1">Smart meters and energy monitors</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                {devices?.length || 0} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {devices && devices.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        device.status === 'active' 
                          ? "bg-green-100 text-green-600" 
                          : "bg-gray-100 text-gray-600"
                      )}>
                        <Plug className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{device.serialNumber}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-gray-600">{device.type}</p>
                          <span className="text-gray-400">•</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              device.status === 'active'
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            )}
                          >
                            {device.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {device.status === 'active' && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Plug className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No devices found</p>
                <p className="text-sm text-gray-500 mt-1">Devices will appear here once connected</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Energy Data */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  Recent Energy Data
                </CardTitle>
                <CardDescription className="mt-1">Latest energy consumption readings</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                {energyData?.length || 0} Records
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {energyData && energyData.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {energyData.slice(0, 50).map((data) => (
                      <div
                        key={data.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{Number(data.power).toFixed(2)} W</p>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {new Date(data.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-sm font-medium">
                            {Number(data.energy).toFixed(2)} kWh
                          </Badge>
                          {data.solarGeneration && Number(data.solarGeneration) > 0 && (
                            <div className="flex items-center gap-1 text-xs text-yellow-600">
                              <Sun className="w-3 h-3" />
                              <span>{Number(data.solarGeneration).toFixed(2)} kWh</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No energy data available</p>
                <p className="text-sm text-gray-500 mt-1">Energy readings will appear here once devices start reporting</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
