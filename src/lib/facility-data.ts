export interface FacilityConfig {
  id: string
  name: string
  shortName: string
  location: string
  region: string
  facilityType: string
  installationStatus: 'completed' | 'assessment_done' | 'in_progress'
  systemSizeKw: number
  batteryCapacityKwh: number
  panelCount: number
  inverterModel: string
  installDate: string
  paymentModel: 'payg' | 'installment' | 'full_payment'
  monthlyConsumptionKwh: number
  monthlySolarProductionKwh: number
  creditBalance: number
  coordinates: { lat: number; lng: number }
  contactPerson: string
  contactPhone: string
  equipment: EquipmentItem[]
  // Live simulation seed values
  basePower: number
  baseSolarGen: number
  baseBatteryLevel: number
  dailyConsumption: number
  // Energy efficiency data
  eeatScore: number
  gridCostPerKwh: number
  solarCostPerKwh: number
  monthlyGridCost: number
  monthlySolarSavings: number
  co2AvoidedTons: number
  // Intelligent load optimization
  peakHours: string
  offPeakHours: string
  criticalLoadKw: number
  nonCriticalLoadKw: number
  loadOptimizationPotential: number // percentage
}

export interface EquipmentItem {
  name: string
  powerW: number
  hoursPerDay: number
  critical: boolean
  category: 'lighting' | 'refrigeration' | 'medical' | 'hvac' | 'ict' | 'other'
  ageYears: number
  efficiencyRating: 'A' | 'B' | 'C' | 'D' | 'E'
}

// SECRET DEMO TOKENS
export const DEMO_TOKENS: Record<string, string> = {
  'afx-st-therese-2026': 'st-therese',
  'afx-arafa-majumba-2026': 'arafa-majumba-sita',
}

export const FACILITIES: FacilityConfig[] = [
  {
    id: 'st-therese',
    name: 'St. Therese of Allesson',
    shortName: 'St. Therese',
    location: 'Kisarawe, Pwani',
    region: 'Pwani',
    facilityType: 'Dispensary',
    installationStatus: 'completed',
    systemSizeKw: 2,
    batteryCapacityKwh: 5,
    panelCount: 6,
    inverterModel: 'Victron MultiPlus-II 2kVA',
    installDate: '2025-08-15',
    paymentModel: 'payg',
    monthlyConsumptionKwh: 180,
    monthlySolarProductionKwh: 210,
    creditBalance: 32500,
    coordinates: { lat: -7.1238, lng: 38.8274 },
    contactPerson: 'Sr. Maria Consolata',
    contactPhone: '+255 712 345 678',
    basePower: 0.8,
    baseSolarGen: 1.6,
    baseBatteryLevel: 78,
    dailyConsumption: 6.0,
    eeatScore: 68,
    gridCostPerKwh: 630,
    solarCostPerKwh: 380,
    monthlyGridCost: 113400,
    monthlySolarSavings: 45000,
    co2AvoidedTons: 0.42,
    peakHours: '08:00-14:00',
    offPeakHours: '20:00-06:00',
    criticalLoadKw: 0.6,
    nonCriticalLoadKw: 0.4,
    loadOptimizationPotential: 22,
    equipment: [
      { name: 'LED Lighting (Main)', powerW: 120, hoursPerDay: 12, critical: true, category: 'lighting', ageYears: 1, efficiencyRating: 'A' },
      { name: 'LED Lighting (Exterior)', powerW: 60, hoursPerDay: 10, critical: false, category: 'lighting', ageYears: 1, efficiencyRating: 'A' },
      { name: 'Vaccine Refrigerator', powerW: 80, hoursPerDay: 24, critical: true, category: 'refrigeration', ageYears: 2, efficiencyRating: 'A' },
      { name: 'Blood Sample Fridge', powerW: 65, hoursPerDay: 24, critical: true, category: 'refrigeration', ageYears: 3, efficiencyRating: 'B' },
      { name: 'Ceiling Fans (x3)', powerW: 210, hoursPerDay: 8, critical: false, category: 'hvac', ageYears: 4, efficiencyRating: 'B' },
      { name: 'Desktop Computer', powerW: 150, hoursPerDay: 8, critical: false, category: 'ict', ageYears: 3, efficiencyRating: 'B' },
      { name: 'Phone Charger Station', powerW: 30, hoursPerDay: 6, critical: false, category: 'ict', ageYears: 1, efficiencyRating: 'A' },
      { name: 'Examination Light', powerW: 40, hoursPerDay: 6, critical: true, category: 'medical', ageYears: 2, efficiencyRating: 'A' },
      { name: 'Autoclave (Small)', powerW: 800, hoursPerDay: 1.5, critical: true, category: 'medical', ageYears: 5, efficiencyRating: 'C' },
      { name: 'Water Pump', powerW: 370, hoursPerDay: 2, critical: false, category: 'other', ageYears: 3, efficiencyRating: 'B' },
    ],
  },
  {
    id: 'arafa-majumba-sita',
    name: 'Arafa Majumba Sita Health Center',
    shortName: 'Arafa Majumba Sita',
    location: 'Dar es Salaam',
    region: 'Dar es Salaam',
    facilityType: 'Health Center',
    installationStatus: 'completed',
    systemSizeKw: 10,
    batteryCapacityKwh: 20,
    panelCount: 24,
    inverterModel: 'Victron Quattro 10kVA',
    installDate: '2025-06-20',
    paymentModel: 'installment',
    monthlyConsumptionKwh: 850,
    monthlySolarProductionKwh: 1050,
    creditBalance: 185000,
    coordinates: { lat: -6.7924, lng: 39.2083 },
    contactPerson: 'Dr. Amina Rashid',
    contactPhone: '+255 754 987 654',
    basePower: 4.2,
    baseSolarGen: 7.8,
    baseBatteryLevel: 82,
    dailyConsumption: 28.3,
    eeatScore: 74,
    gridCostPerKwh: 630,
    solarCostPerKwh: 350,
    monthlyGridCost: 535500,
    monthlySolarSavings: 238000,
    co2AvoidedTons: 2.1,
    peakHours: '07:00-16:00',
    offPeakHours: '22:00-05:00',
    criticalLoadKw: 3.5,
    nonCriticalLoadKw: 2.8,
    loadOptimizationPotential: 18,
    equipment: [
      { name: 'LED Lighting (Wards)', powerW: 480, hoursPerDay: 14, critical: true, category: 'lighting', ageYears: 1, efficiencyRating: 'A' },
      { name: 'LED Lighting (Corridors/Exterior)', powerW: 240, hoursPerDay: 12, critical: false, category: 'lighting', ageYears: 1, efficiencyRating: 'A' },
      { name: 'Vaccine Cold Chain (Walk-in)', powerW: 350, hoursPerDay: 24, critical: true, category: 'refrigeration', ageYears: 2, efficiencyRating: 'A' },
      { name: 'Blood Bank Refrigerator', powerW: 180, hoursPerDay: 24, critical: true, category: 'refrigeration', ageYears: 3, efficiencyRating: 'B' },
      { name: 'Pharmaceutical Fridge', powerW: 120, hoursPerDay: 24, critical: true, category: 'refrigeration', ageYears: 2, efficiencyRating: 'A' },
      { name: 'Oxygen Concentrator (x2)', powerW: 680, hoursPerDay: 12, critical: true, category: 'medical', ageYears: 2, efficiencyRating: 'B' },
      { name: 'Autoclave (Large)', powerW: 2200, hoursPerDay: 2, critical: true, category: 'medical', ageYears: 4, efficiencyRating: 'C' },
      { name: 'Ultrasound Machine', powerW: 300, hoursPerDay: 4, critical: false, category: 'medical', ageYears: 3, efficiencyRating: 'B' },
      { name: 'X-Ray Machine (Portable)', powerW: 1500, hoursPerDay: 1.5, critical: false, category: 'medical', ageYears: 2, efficiencyRating: 'B' },
      { name: 'Centrifuge', powerW: 200, hoursPerDay: 3, critical: false, category: 'medical', ageYears: 4, efficiencyRating: 'C' },
      { name: 'Air Conditioning (Theatre)', powerW: 1800, hoursPerDay: 6, critical: true, category: 'hvac', ageYears: 3, efficiencyRating: 'B' },
      { name: 'Ceiling Fans (x8)', powerW: 560, hoursPerDay: 10, critical: false, category: 'hvac', ageYears: 4, efficiencyRating: 'B' },
      { name: 'Computers & Printers (x5)', powerW: 600, hoursPerDay: 9, critical: false, category: 'ict', ageYears: 2, efficiencyRating: 'B' },
      { name: 'Network Equipment', powerW: 80, hoursPerDay: 24, critical: false, category: 'ict', ageYears: 2, efficiencyRating: 'A' },
      { name: 'Water Pump System', powerW: 750, hoursPerDay: 3, critical: false, category: 'other', ageYears: 3, efficiencyRating: 'B' },
      { name: 'Laundry Machine', powerW: 1200, hoursPerDay: 2, critical: false, category: 'other', ageYears: 5, efficiencyRating: 'C' },
    ],
  },
]

export function getFacilityById(id: string): FacilityConfig | undefined {
  return FACILITIES.find((f) => f.id === id)
}

export function getFacilityByToken(token: string): FacilityConfig | undefined {
  const facilityId = DEMO_TOKENS[token]
  if (!facilityId) return undefined
  return getFacilityById(facilityId)
}

// Generate simulated hourly data for charts
export function generateHourlyData(facility: FacilityConfig) {
  const hours = []
  const now = new Date()
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    const h = hour.getHours()
    const isDaytime = h >= 6 && h <= 18
    const isPeak = h >= 8 && h <= 16

    // Solar generation follows sun curve
    let solarGen = 0
    if (isDaytime) {
      const solarPeak = facility.systemSizeKw * 0.85
      const hourFromNoon = Math.abs(h - 12)
      solarGen = solarPeak * Math.max(0, 1 - (hourFromNoon / 7) ** 2) * (0.85 + Math.random() * 0.3)
    }

    // Consumption varies by time
    let consumption = facility.basePower * 0.4
    if (h >= 7 && h <= 18) {
      consumption = facility.basePower * (0.7 + Math.random() * 0.6)
    }
    if (isPeak) {
      consumption *= 1.2
    }
    if (h >= 22 || h <= 5) {
      consumption = facility.criticalLoadKw * (0.8 + Math.random() * 0.4)
    }

    // Battery level varies
    const batteryDelta = solarGen > consumption ? 2 : -1.5
    const battery = Math.min(100, Math.max(20, facility.baseBatteryLevel + batteryDelta * (Math.random() - 0.3)))

    hours.push({
      time: `${h.toString().padStart(2, '0')}:00`,
      hour: h,
      solarGeneration: +solarGen.toFixed(2),
      consumption: +consumption.toFixed(2),
      batteryLevel: +battery.toFixed(0),
      gridImport: Math.max(0, +(consumption - solarGen).toFixed(2)),
      gridExport: Math.max(0, +(solarGen - consumption).toFixed(2)),
    })
  }
  return hours
}

// Generate 30-day daily data
export function generateDailyData(facility: FacilityConfig) {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const baseConsumption = facility.dailyConsumption
    const dailyConsumption = baseConsumption * (isWeekend ? 0.75 : 1) * (0.85 + Math.random() * 0.3)
    const dailySolar = (facility.monthlySolarProductionKwh / 30) * (0.7 + Math.random() * 0.6)
    const dailySavings = (dailySolar * (facility.gridCostPerKwh - facility.solarCostPerKwh)) / 1000

    days.push({
      date: date.toISOString().split('T')[0],
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      consumption: +dailyConsumption.toFixed(1),
      solarProduction: +dailySolar.toFixed(1),
      gridUsage: +Math.max(0, dailyConsumption - dailySolar).toFixed(1),
      savings: +dailySavings.toFixed(0),
      efficiency: +Math.min(100, (dailySolar / dailyConsumption) * 100).toFixed(0),
    })
  }
  return days
}

// Generate load schedule optimization data
export function generateLoadOptimization(facility: FacilityConfig) {
  const schedule = facility.equipment.map((eq) => {
    const dailyKwh = (eq.powerW * eq.hoursPerDay) / 1000
    const canShift = !eq.critical && eq.hoursPerDay < 12
    const shiftSavings = canShift ? dailyKwh * 0.15 * facility.gridCostPerKwh : 0

    return {
      ...eq,
      dailyKwh: +dailyKwh.toFixed(2),
      monthlyKwh: +(dailyKwh * 30).toFixed(1),
      monthlyCost: +(dailyKwh * 30 * facility.solarCostPerKwh).toFixed(0),
      canShiftToOffPeak: canShift,
      potentialSavings: +shiftSavings.toFixed(0),
      recommendedSchedule: canShift ? facility.offPeakHours : '24/7 or as needed',
      optimizationNote: canShift
        ? `Shift to ${facility.offPeakHours} for solar-only operation`
        : eq.critical
          ? 'Critical load - maintain current schedule'
          : 'Already optimized',
    }
  })

  const totalDailyKwh = schedule.reduce((sum, s) => sum + s.dailyKwh, 0)
  const totalPotentialSavings = schedule.reduce((sum, s) => sum + s.potentialSavings, 0)
  const shiftableLoad = schedule.filter((s) => s.canShiftToOffPeak)

  return {
    schedule,
    totalDailyKwh: +totalDailyKwh.toFixed(1),
    totalMonthlyKwh: +(totalDailyKwh * 30).toFixed(0),
    totalPotentialDailySavings: +totalPotentialSavings.toFixed(0),
    totalPotentialMonthlySavings: +(totalPotentialSavings * 30).toFixed(0),
    shiftableLoadCount: shiftableLoad.length,
    criticalLoadKw: facility.criticalLoadKw,
    nonCriticalLoadKw: facility.nonCriticalLoadKw,
    optimizationScore: 100 - facility.loadOptimizationPotential,
  }
}

