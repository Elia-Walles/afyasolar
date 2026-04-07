'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const DEVICE_POOL: { name: string; category: string }[] = [
  { name: 'Vaccine fridge', category: 'Cold chain' },
  { name: 'Autoclave', category: 'Sterilization' },
  { name: 'Microscope', category: 'Lab' },
  { name: 'LED lighting', category: 'Lighting' },
  { name: 'Computer & printer', category: 'Office' },
  { name: 'Ceiling fans', category: 'HVAC' },
  { name: 'Ultrasound', category: 'Diagnostics' },
  { name: 'Dental unit', category: 'Dental' },
  { name: 'Blood bank fridge', category: 'Cold chain' },
  { name: 'Centrifuge', category: 'Lab' },
  { name: 'X-ray (small)', category: 'Diagnostics' },
  { name: 'Water pump', category: 'Auxiliary' },
]

const COLORS = ['#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c', '#ca8a04']

export interface FacilityForSimulation {
  id: string
  name: string
  facilityType: string
  energyConsumptionBefore: number
  energyConsumptionAfter: number
}

const SHARE_TEMPLATES = [
  [35, 25, 20, 12, 8],
  [30, 28, 22, 12, 8],
  [40, 22, 18, 12, 8],
  [28, 24, 20, 16, 12],
]

/** Simulated per-facility top consuming medical/equipment breakdown (consistent per facility id) */
export function getSimulatedDeviceConsumption(facility: FacilityForSimulation): { name: string; value: number; share: number }[] {
  const total = facility.energyConsumptionBefore
  if (total <= 0) return []
  const hash = (facility.id + facility.name + facility.facilityType).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const count = Math.min(5 + (hash % 3), DEVICE_POOL.length, 6)
  const template = SHARE_TEMPLATES[hash % SHARE_TEMPLATES.length]
  const shares = template.slice(0, count)
  const sum = shares.reduce((a, b) => a + b, 0)
  const normalized = shares.map((s) => Math.round((s * 100) / sum))
  const out: { name: string; value: number; share: number }[] = []
  for (let i = 0; i < count; i++) {
    const idx = (hash + i * 7) % DEVICE_POOL.length
    const device = DEVICE_POOL[idx]
    const share = normalized[i] ?? 0
    const value = Math.round((total * share) / 100)
    out.push({ name: device.name, value, share })
  }
  return out.sort((a, b) => b.value - a.value)
}

export function FacilityDetailSimulation({ facility }: { facility: FacilityForSimulation }) {
  const data = useMemo(() => getSimulatedDeviceConsumption(facility), [facility.id, facility.name, facility.facilityType, facility.energyConsumptionBefore])

  if (data.length === 0) return null

  const pieData = data.map((d) => ({ name: d.name, value: d.value }))

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">Simulated top consuming equipment (before solar)</h4>
      <p className="text-xs text-gray-500">Estimated breakdown by device type for this facility</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} kWh/month`, 'Consumption']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
              <XAxis type="number" unit=" kWh" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [`${value} kWh/month`, 'Consumption']} />
              <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} name="kWh/month" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="text-sm text-gray-600 space-y-1 border rounded-lg p-3 bg-gray-50/50">
        {data.map((d, i) => (
          <li key={d.name} className="flex justify-between">
            <span>{d.name}</span>
            <span className="font-medium text-gray-800">{d.value} kWh/mo ({d.share}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
