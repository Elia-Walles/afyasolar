'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarChart3, DollarSign, Home, Plug, Zap } from 'lucide-react'

const MICROGRID_CONSUMERS = {
  'afx-worker-house-001': {
    id: 'worker-house-001',
    name: 'Staff House - Dr. Emmanuel',
    type: 'staff_housing',
    parentFacility: 'Arafa Majumba Sita Health Center',
    parentFacilityId: 'arafa-majumba-sita',
    meterId: 'MG-0056',
    meterSerial: 'SN-MG-0056-2025',
    tariffPerKwh: 450,
    monthlyUsage: 45,
    monthlyCost: 20250,
    balance: 12500,
    phone: '+255 712 445 678',
    address: 'Staff Quarters, Arafa Majumba',
    registeredAt: '2025-09-10',
    status: 'active',
    appliances: [
      { name: 'LED Lighting', power: 100, usage: 5 },
      { name: 'Refrigerator', power: 150, usage: 8 },
      { name: 'Water Pump', power: 500, usage: 4 },
      { name: 'Ceiling Fans', power: 200, usage: 6 },
      { name: 'TV/Entertainment', power: 150, usage: 3 },
    ],
    dailyUsage: 1.5,
    dailyCost: 675,
  },
  'afx-pharmacy-microgrid-001': {
    id: 'pharmacy-001',
    name: 'Arafa Pharmacy - Microenterprise',
    type: 'nearby_business',
    parentFacility: 'Arafa Majumba Sita Health Center',
    parentFacilityId: 'arafa-majumba-sita',
    meterId: 'MG-0057',
    meterSerial: 'SN-MG-0057-2025',
    tariffPerKwh: 500,
    monthlyUsage: 120,
    monthlyCost: 60000,
    balance: 35000,
    phone: '+255 712 556 789',
    address: 'Arafa Shopping Complex, Dar es Salaam',
    registeredAt: '2025-08-15',
    status: 'active',
    appliances: [
      { name: 'Refrigeration Unit', power: 800, usage: 8 },
      { name: 'LED Lighting', power: 300, usage: 10 },
      { name: 'Air Conditioning', power: 2000, usage: 6 },
      { name: 'POS System', power: 200, usage: 12 },
      { name: 'Water Heater', power: 1500, usage: 2 },
    ],
    dailyUsage: 4.0,
    dailyCost: 2000,
  },
}

export default function MicrogridConsumerPage({ params }: { params: { token: string } }) {
  const consumer = MICROGRID_CONSUMERS[params.token as keyof typeof MICROGRID_CONSUMERS]

  if (!consumer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Invalid microgrid consumer token. Please check your access link.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isBusiness = consumer.type === 'nearby_business'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div
        className={`bg-gradient-to-r ${isBusiness ? 'from-blue-600 to-blue-700' : 'from-indigo-600 to-indigo-700'} text-white p-6`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {isBusiness ? <Plug className="w-6 h-6" /> : <Home className="w-6 h-6" />}
              <h1 className="text-3xl font-bold">{consumer.name}</h1>
            </div>
            <p className={`${isBusiness ? 'text-blue-100' : 'text-indigo-100'} mt-1`}>
              {consumer.address} • Powered by {consumer.parentFacility}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-75">Connection Status</p>
            <Badge className={`mt-1 ${isBusiness ? 'bg-blue-400 text-blue-900' : 'bg-indigo-400 text-indigo-900'}`}>
              {consumer.status === 'active' ? '✓ Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Today's Usage</CardDescription>
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{consumer.dailyUsage.toFixed(1)} kWh</p>
              <p className="text-xs text-yellow-400 mt-1">TSh {consumer.dailyCost.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Monthly Usage</CardDescription>
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">{consumer.monthlyUsage} kWh</p>
              <p className="text-xs text-blue-400 mt-1">Avg {(consumer.monthlyUsage / 30).toFixed(1)} kWh/day</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Available Balance</CardDescription>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">TSh {consumer.balance.toLocaleString()}</p>
              <p className="text-xs text-green-400 mt-1">Days remaining: {Math.floor(consumer.balance / consumer.dailyCost)}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-slate-300">Tariff Rate</CardDescription>
                <Plug className="w-5 h-5 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-white">TSh {consumer.tariffPerKwh}</p>
              <p className="text-xs text-purple-400 mt-1">per kWh</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="overview" className="text-slate-300 data-[state=active]:text-white">Overview</TabsTrigger>
            <TabsTrigger value="appliances" className="text-slate-300 data-[state=active]:text-white">Appliances</TabsTrigger>
            <TabsTrigger value="consumption" className="text-slate-300 data-[state=active]:text-white">Usage History</TabsTrigger>
            <TabsTrigger value="billing" className="text-slate-300 data-[state=active]:text-white">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Connection Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400">Meter ID</label>
                    <p className="text-lg font-bold text-white">{consumer.meterId}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Meter Serial</label>
                    <p className="text-lg font-bold text-white font-mono">{consumer.meterSerial}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Connection Date</label>
                    <p className="text-lg font-bold text-white">{consumer.registeredAt}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Contact</label>
                    <p className="text-lg font-bold text-white">{consumer.phone}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Parent Facility</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400">Facility Name</label>
                    <p className="text-lg font-bold text-white">{consumer.parentFacility}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Power Source</label>
                    <p className="text-lg font-bold text-white">Solar Microgrid (10kW)</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400">Grid Status</label>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-2">
                      Online & Supplying Power
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="appliances">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Active Appliances</CardTitle>
                <CardDescription className="text-slate-400">Device power consumption breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {consumer.appliances.map((appliance, idx) => (
                    <div key={idx} className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-white">{appliance.name}</p>
                          <p className="text-xs text-slate-400">
                            {appliance.power}W × {appliance.usage}h/day
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{(appliance.power * appliance.usage / 1000).toFixed(2)} kWh/day</p>
                          <p className="text-xs text-slate-400">
                            TSh {((appliance.power * appliance.usage / 1000) * consumer.tariffPerKwh).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Progress value={(appliance.power / 2000) * 100} className="h-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consumption">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Usage Trends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-blue-900/20 border-blue-700">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-100">
                    Your usage is {consumer.monthlyUsage > 100 ? 'high' : 'moderate'} compared to similar {consumer.type === 'nearby_business' ? 'businesses' : 'residences'} on this microgrid.
                  </AlertDescription>
                </Alert>

                <div className="bg-slate-700/50 rounded-lg p-6">
                  <p className="text-sm text-slate-300 mb-4">Last 7 Days Average</p>
                  <p className="text-4xl font-bold text-white">{(consumer.monthlyUsage / 30 * 7).toFixed(1)} kWh</p>
                  <p className="text-sm text-slate-400 mt-2">≈ {(consumer.dailyUsage * 7).toFixed(1)} kWh for this week</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Current Bill</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">Monthly Usage</span>
                      <span className="text-white font-bold">{consumer.monthlyUsage} kWh</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">Rate</span>
                      <span className="text-white font-bold">TSh {consumer.tariffPerKwh}/kWh</span>
                    </div>
                    <div className="border-t border-slate-600 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-emerald-400 font-bold">Total Due</span>
                        <span className="text-2xl font-bold text-emerald-400">TSh {consumer.monthlyCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Account Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/10 rounded-lg p-6 border border-emerald-700/30">
                    <p className="text-sm text-slate-300 mb-2">Available Credit</p>
                    <p className="text-4xl font-bold text-emerald-400">TSh {consumer.balance.toLocaleString()}</p>
                    <p className="text-xs text-emerald-300 mt-3">
                      Sufficient for {Math.floor(consumer.balance / consumer.dailyCost)} more days
                    </p>
                  </div>

                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Add Credit / Top Up
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

