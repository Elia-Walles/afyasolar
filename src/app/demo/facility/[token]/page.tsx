'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getFacilityByToken } from '@/lib/facility-data'
import { Battery, DollarSign, Leaf, Sun, Zap, AlertCircle } from 'lucide-react'

export default function FacilityDemoPage({ params }: { params: { token: string } }) {
  const facility = getFacilityByToken(params.token)

  const dailyGeneration = useMemo(() => {
    if (!facility) return 0
    return facility.monthlySolarProductionKwh / 30
  }, [facility])

  if (!facility) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Invalid facility token. Please check your access link.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{facility.name}</h1>
            <p className="text-emerald-100 mt-1">
              {facility.location} • {facility.facilityType}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-emerald-100">System Status</p>
            <Badge className="bg-emerald-400 text-emerald-900 mt-1">Operational</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Daily Generation</CardDescription>
                <Sun className="w-5 h-5 text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{dailyGeneration.toFixed(1)} kWh</p>
              <p className="text-xs text-emerald-400 mt-1">↑ 12% vs yesterday</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Battery Level</CardDescription>
                <Battery className="w-5 h-5 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">78%</p>
              <Progress value={78} className="mt-2 h-1.5" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Monthly Savings</CardDescription>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">TSh {(facility.monthlySolarSavings / 1000).toFixed(0)}k</p>
              <p className="text-xs text-emerald-400 mt-1">vs grid electricity</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">CO2 Avoided</CardDescription>
                <Leaf className="w-5 h-5 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{facility.co2AvoidedTons.toFixed(2)} tons</p>
              <p className="text-xs text-emerald-400 mt-1">Monthly</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="overview" className="text-slate-300 data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="efficiency" className="text-slate-300 data-[state=active]:text-white">
              Energy Efficiency
            </TabsTrigger>
            <TabsTrigger value="consumption" className="text-slate-300 data-[state=active]:text-white">
              Consumption
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-slate-300 data-[state=active]:text-white">
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">System Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-300">System Size</label>
                      <p className="text-lg font-bold text-white">{facility.systemSizeKw} kW</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Battery Capacity</label>
                      <p className="text-lg font-bold text-white">{facility.batteryCapacityKwh} kWh</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Solar Panels</label>
                      <p className="text-lg font-bold text-white">{facility.panelCount}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-300">Installation Date</label>
                      <p className="text-lg font-bold text-white">{facility.installDate}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Contact Person</label>
                      <p className="text-lg font-bold text-white">{facility.contactPerson}</p>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Phone</label>
                      <p className="text-lg font-bold text-white">{facility.contactPhone}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="efficiency">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Energy Efficiency Assessment</CardTitle>
                <CardDescription className="text-slate-400">EEAT Score: {facility.eeatScore}/100</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">Efficiency Rating</label>
                    <span className="text-lg font-bold text-white">{facility.eeatScore}%</span>
                  </div>
                  <Progress value={facility.eeatScore} className="h-2" />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <p className="text-sm text-slate-300 mb-2">Peak Hours</p>
                    <p className="font-bold text-white">{facility.peakHours}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <p className="text-sm text-slate-300 mb-2">Off-Peak Hours</p>
                    <p className="font-bold text-white">{facility.offPeakHours}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <p className="text-sm text-slate-300 mb-2">Critical Load</p>
                    <p className="font-bold text-white">{facility.criticalLoadKw} kW</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <p className="text-sm text-slate-300 mb-2">Non-Critical Load</p>
                    <p className="font-bold text-white">{facility.nonCriticalLoadKw} kW</p>
                  </div>
                </div>

                <Alert className="bg-emerald-900/20 border-emerald-700">
                  <AlertCircle className="h-4 w-4 text-emerald-400" />
                  <AlertDescription className="text-emerald-100">
                    {facility.loadOptimizationPotential}% load optimization potential available
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consumption">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Monthly Consumption & Savings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-red-900/20 to-red-900/10 rounded-lg p-6 border border-red-700/30">
                    <p className="text-sm text-slate-300 mb-2">Grid Cost (If no solar)</p>
                    <p className="text-3xl font-bold text-white">TSh {(facility.monthlyGridCost / 1000).toFixed(0)}k</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/10 rounded-lg p-6 border border-emerald-700/30">
                    <p className="text-sm text-slate-300 mb-2">Monthly Savings</p>
                    <p className="text-3xl font-bold text-emerald-400">TSh {(facility.monthlySolarSavings / 1000).toFixed(0)}k</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-300 mb-3">Monthly Generation vs Consumption</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Generation</span>
                        <Sun className="w-4 h-4 text-yellow-400" />
                      </div>
                      <p className="text-2xl font-bold text-white">{facility.monthlySolarProductionKwh} kWh</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Consumption</span>
                        <Zap className="w-4 h-4 text-blue-400" />
                      </div>
                      <p className="text-2xl font-bold text-white">{facility.monthlyConsumptionKwh} kWh</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Payment & Credit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-6">
                  <p className="text-sm text-slate-300 mb-2">Available Credit</p>
                  <p className="text-4xl font-bold text-emerald-400">TSh {facility.creditBalance.toLocaleString()}</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-white">Payment Model</h3>
                  <Badge variant={facility.paymentModel === 'payg' ? 'default' : 'secondary'}>
                    {facility.paymentModel.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Add Credit / Make Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

