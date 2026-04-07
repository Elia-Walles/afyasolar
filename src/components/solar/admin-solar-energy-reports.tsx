import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Download, Calendar, Zap, TrendingUp, BarChart3 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface EnergyReport {
  facilityId: string
  facilityName: string
  period: string
  energyGenerated: number
  energyConsumed: number
  efficiency: number
  costSavings: number
  co2Saved: number
}

export function AdminSolarEnergyReports() {
  const [timeRange, setTimeRange] = useState('monthly')
  const [facilityFilter, setFacilityFilter] = useState('all')

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['solar-energy-reports', timeRange, facilityFilter],
    queryFn: async (): Promise<EnergyReport[]> => [
      {
        facilityId: '1',
        facilityName: 'Kigali Central Hospital',
        period: '2024-01',
        energyGenerated: 1240,
        energyConsumed: 980,
        efficiency: 94.5,
        costSavings: 1240,
        co2Saved: 890
      }
    ]
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Solar Energy Reports</h2>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Generated</p>
                <p className="text-2xl font-bold">5,420 kWh</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Consumed</p>
                <p className="text-2xl font-bold">4,280 kWh</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Cost Savings</p>
                <p className="text-2xl font-bold">$5,420</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">CO₂ Saved</p>
                <p className="text-2xl font-bold">3,860 kg</p>
              </div>
              <FileText className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Energy Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.facilityId} className="border rounded p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{report.facilityName}</h3>
                    <p className="text-sm text-muted-foreground">{report.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{report.energyGenerated} kWh</p>
                    <p className="text-sm text-muted-foreground">Generated</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminSolarEnergyReports
