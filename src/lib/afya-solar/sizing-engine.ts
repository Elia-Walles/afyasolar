export type FacilityType = 'on_grid' | 'hybrid' | 'off_grid'

export type BatteryChemistry = 'lifepo4' | 'lead_acid'

export interface DeviceLoadRow {
  device_name: string
  wattage_w: number
  quantity: number
  hours_per_day: number
  is_critical: boolean
  is_motor?: boolean
  motor_type?: 'compressor' | 'pump' | 'generic'
}

export interface FacilityDataInput {
  facility_type: FacilityType
  avg_outage_hours_per_day: number
  tanesco_monthly_bill_tzs: number
  diesel_litres_per_day: number
  diesel_price_tzs_per_litre?: number
}

export interface SolarSiteDataInput {
  peak_sun_hours_worst_month: number
  system_dc_voltage?: number
  battery_chemistry: BatteryChemistry
  autonomy_days?: number
}

export interface SystemParametersInput {
  panel_watt_rating?: number
  growth_margin?: number
  inverter_efficiency?: number
  battery_efficiency?: number
}

export interface PricingRow {
  system_size_kw: number
  cash_price_tzs: number
  install_upfront_tzs: number
  install_monthly_tzs: number
  install_term_months: number
  eaas_monthly_tzs: number | null
  eaas_term_months: number | null
}

export interface LoadAnalysisResult {
  E_day_total: number
  E_day_critical: number
  P_run_total: number
  P_run_critical: number
  E_day_total_adj: number
  E_day_critical_adj: number
  P_run_total_adj: number
  P_run_critical_adj: number
}

export interface BatterySizingResult {
  eta_total: number
  E_battery_required: number
  E_battery_nameplate: number
  battery_Ah: number
  E_outage_critical?: number
  E_autonomy?: number
}

export interface PvArrayResult {
  derate_factor: number
  E_pv_target: number
  P_pv_kw: number
  panels_required: number
  P_pv_actual_kw: number
  solar_energy_daily: number
}

export interface InverterSizingResult {
  P_peak: number
  P_peak_critical: number
  inverter_continuous_w: number
  inverter_continuous_kw: number
  surge_required_w: number
}

export interface MpptResult {
  P_pv_watts: number
  I_mppt: number
}

export interface BaselineCostResult {
  diesel_cost_monthly: number
  baseline_cost_monthly: number
}

export interface AfterSolarCostResult {
  solar_offset: number
  grid_reduction: number
  diesel_reduction: number
  grid_after_monthly: number
  diesel_after_monthly: number
  total_after_solar_monthly: number
}

export interface SavingsResult {
  gross_monthly_savings: number
}

export interface FinancingComparisonResult {
  selected_pricing: PricingRow | null
  cash_payback_months: number | null
  installment_net_savings_monthly: number | null
  installment_breakeven_months: number | null
  eaas_net_savings_monthly: number | null
}

export interface FullSizingResult {
  load: LoadAnalysisResult
  battery: BatterySizingResult
  pv: PvArrayResult
  inverter: InverterSizingResult
  mppt: MpptResult
  baseline: BaselineCostResult
  afterSolar: AfterSolarCostResult
  savings: SavingsResult
  financing: FinancingComparisonResult
}

const DEFAULTS = {
  diesel_price_tzs_per_litre: 3000,
  system_dc_voltage: 48,
  panel_watt_rating: 620,
  growth_margin: 0.15,
  inverter_efficiency: 0.92,
  battery_efficiency: 0.95,
} as const

const DERATE_FACTORS: Record<FacilityType, number> = {
  on_grid: 0.8,
  hybrid: 0.75,
  off_grid: 0.7,
}

const BATTERY_DOD: Record<BatteryChemistry, number> = {
  lifepo4: 0.85,
  lead_acid: 0.5,
}

export function runLoadAnalysis(
  devices: DeviceLoadRow[],
  growthMargin: number,
): LoadAnalysisResult {
  let E_day_total = 0
  let E_day_critical = 0
  let P_run_total = 0
  let P_run_critical = 0

  for (const d of devices) {
    const P_device = d.wattage_w * d.quantity
    const E_device = (P_device * d.hours_per_day) / 1000

    P_run_total += P_device
    E_day_total += E_device

    if (d.is_critical) {
      P_run_critical += P_device
      E_day_critical += E_device
    }
  }

  const E_day_total_adj = E_day_total * (1 + growthMargin)
  const E_day_critical_adj = E_day_critical * (1 + growthMargin)
  const P_run_total_adj = P_run_total * (1 + growthMargin)
  const P_run_critical_adj = P_run_critical * (1 + growthMargin)

  return {
    E_day_total,
    E_day_critical,
    P_run_total,
    P_run_critical,
    E_day_total_adj,
    E_day_critical_adj,
    P_run_total_adj,
    P_run_critical_adj,
  }
}

export function sizeBattery(
  facilityData: FacilityDataInput,
  siteData: SolarSiteDataInput,
  params: SystemParametersInput,
  load: LoadAnalysisResult,
): BatterySizingResult {
  const inverterEff = params.inverter_efficiency ?? DEFAULTS.inverter_efficiency
  const batteryEff = params.battery_efficiency ?? DEFAULTS.battery_efficiency
  const eta_total = inverterEff * batteryEff
  const batteryDod = BATTERY_DOD[siteData.battery_chemistry]
  const systemVoltage = siteData.system_dc_voltage ?? DEFAULTS.system_dc_voltage

  let E_battery_required = 0
  let E_outage_critical: number | undefined
  let E_autonomy: number | undefined

  if (facilityData.facility_type === 'on_grid' || facilityData.facility_type === 'hybrid') {
    const outageFraction = Math.max(
      0,
      Math.min(24, facilityData.avg_outage_hours_per_day || 0),
    ) / 24
    E_outage_critical = load.E_day_critical_adj * outageFraction
    E_battery_required = E_outage_critical / eta_total
  } else {
    // off_grid
    const autonomyDays = siteData.autonomy_days ?? 1
    E_autonomy = load.E_day_total_adj * autonomyDays
    E_battery_required = E_autonomy / eta_total
  }

  const E_battery_nameplate = E_battery_required / batteryDod
  const battery_Ah = (E_battery_nameplate * 1000) / systemVoltage

  return {
    eta_total,
    E_battery_required,
    E_battery_nameplate,
    battery_Ah,
    E_outage_critical,
    E_autonomy,
  }
}

export function sizePvArray(
  facilityData: FacilityDataInput,
  siteData: SolarSiteDataInput,
  params: SystemParametersInput,
  load: LoadAnalysisResult,
): PvArrayResult {
  const derate = DERATE_FACTORS[facilityData.facility_type]
  const E_pv_target = load.E_day_total_adj
  const peakSun = siteData.peak_sun_hours_worst_month
  const panelW = params.panel_watt_rating ?? DEFAULTS.panel_watt_rating

  const P_pv_kw = E_pv_target / (peakSun * derate)
  const panels_required = Math.ceil((P_pv_kw * 1000) / panelW)
  const P_pv_actual_kw = (panels_required * panelW) / 1000
  const solar_energy_daily = P_pv_actual_kw * peakSun * derate

  return {
    derate_factor: derate,
    E_pv_target,
    P_pv_kw,
    panels_required,
    P_pv_actual_kw,
    solar_energy_daily,
  }
}

export function sizeInverter(
  devices: DeviceLoadRow[],
  load: LoadAnalysisResult,
): InverterSizingResult {
  const inverterHeadroom = 1.25

  const P_peak = load.P_run_total_adj
  const P_peak_critical = load.P_run_critical_adj

  let maxSurge = 0

  for (const d of devices) {
    if (!d.is_motor) continue
    const running = d.wattage_w * d.quantity
    let surgeMultiplier = 3
    if (d.motor_type === 'pump') surgeMultiplier = 4
    if (d.motor_type === 'compressor') surgeMultiplier = 3
    const surge = running * surgeMultiplier
    if (surge > maxSurge) maxSurge = surge
  }

  const inverter_continuous_w = inverterHeadroom * (P_peak_critical || P_peak)
  const inverter_continuous_kw = inverter_continuous_w / 1000

  return {
    P_peak,
    P_peak_critical,
    inverter_continuous_w,
    inverter_continuous_kw,
    surge_required_w: maxSurge,
  }
}

export function sizeMppt(
  pv: PvArrayResult,
  siteData: SolarSiteDataInput,
): MpptResult {
  const systemVoltage = siteData.system_dc_voltage ?? DEFAULTS.system_dc_voltage
  const P_pv_watts = pv.P_pv_actual_kw * 1000
  const I_mppt = 1.25 * (P_pv_watts / systemVoltage)
  return { P_pv_watts, I_mppt }
}

export function calculateBaselineCosts(
  facilityData: FacilityDataInput,
): BaselineCostResult {
  const dieselPrice =
    facilityData.diesel_price_tzs_per_litre ?? DEFAULTS.diesel_price_tzs_per_litre
  const diesel_cost_monthly =
    facilityData.diesel_litres_per_day * dieselPrice * 30
  const baseline_cost_monthly =
    facilityData.tanesco_monthly_bill_tzs + diesel_cost_monthly
  return { diesel_cost_monthly, baseline_cost_monthly }
}

export function calculateAfterSolarCosts(
  facilityData: FacilityDataInput,
  siteData: SolarSiteDataInput,
  load: LoadAnalysisResult,
  battery: BatterySizingResult,
  pv: PvArrayResult,
): AfterSolarCostResult {
  const { diesel_cost_monthly } = calculateBaselineCosts(facilityData)

  const solar_offset = pv.solar_energy_daily / (load.E_day_total_adj || 1)

  let grid_reduction = 0
  if (facilityData.facility_type === 'on_grid') {
    grid_reduction = Math.min(0.9, solar_offset * 0.75)
  } else if (facilityData.facility_type === 'hybrid') {
    grid_reduction = Math.min(0.9, solar_offset * 0.7)
  } else {
    grid_reduction = 1
  }

  let diesel_reduction = 0
  if (
    facilityData.facility_type === 'on_grid' ||
    facilityData.facility_type === 'hybrid'
  ) {
    const E_outage = battery.E_outage_critical ?? 0
    const coverage =
      E_outage > 0 ? battery.E_battery_required / E_outage : 0
    diesel_reduction = Math.min(0.95, coverage * 0.85)
  } else {
    diesel_reduction = 1
  }

  const grid_after_monthly =
    facilityData.tanesco_monthly_bill_tzs * (1 - grid_reduction)
  const diesel_after_monthly = diesel_cost_monthly * (1 - diesel_reduction)
  const total_after_solar_monthly =
    grid_after_monthly + diesel_after_monthly

  return {
    solar_offset,
    grid_reduction,
    diesel_reduction,
    grid_after_monthly,
    diesel_after_monthly,
    total_after_solar_monthly,
  }
}

export function calculateSavings(
  facilityData: FacilityDataInput,
  afterSolar: AfterSolarCostResult,
): SavingsResult {
  const { baseline_cost_monthly } = calculateBaselineCosts(facilityData)
  const gross_monthly_savings =
    baseline_cost_monthly - afterSolar.total_after_solar_monthly
  return { gross_monthly_savings }
}

export function compareFinancingOptions(
  pv: PvArrayResult,
  pricingTable: PricingRow[],
  savings: SavingsResult,
): FinancingComparisonResult {
  if (!pricingTable.length || pv.P_pv_actual_kw <= 0) {
    return {
      selected_pricing: null,
      cash_payback_months: null,
      installment_net_savings_monthly: null,
      installment_breakeven_months: null,
      eaas_net_savings_monthly: null,
    }
  }

  const sorted = [...pricingTable].sort(
    (a, b) => a.system_size_kw - b.system_size_kw,
  )

  const selected =
    sorted.find((row) => row.system_size_kw >= pv.P_pv_actual_kw) ??
    sorted[sorted.length - 1]

  const gross = Math.max(0, savings.gross_monthly_savings)

  let cash_payback_months: number | null = null
  if (gross > 0) {
    cash_payback_months = selected.cash_price_tzs / gross
  }

  let installment_net_savings_monthly: number | null = null
  let installment_breakeven_months: number | null = null

  if (selected.install_monthly_tzs > 0 && gross > 0) {
    installment_net_savings_monthly =
      gross - selected.install_monthly_tzs

    const upfront = selected.install_upfront_tzs
    const monthly = selected.install_monthly_tzs

    if (monthly > 0) {
      const m = upfront / (gross - monthly)
      installment_breakeven_months = m > 0 ? m : null
    }
  }

  let eaas_net_savings_monthly: number | null = null
  if (selected.eaas_monthly_tzs != null) {
    eaas_net_savings_monthly =
      gross - selected.eaas_monthly_tzs
  }

  return {
    selected_pricing: selected,
    cash_payback_months,
    installment_net_savings_monthly,
    installment_breakeven_months,
    eaas_net_savings_monthly,
  }
}

export function runFullSizing(
  devices: DeviceLoadRow[],
  facilityData: FacilityDataInput,
  siteData: SolarSiteDataInput,
  systemParams: SystemParametersInput,
  pricingTable: PricingRow[],
): FullSizingResult {
  const growthMargin = systemParams.growth_margin ?? DEFAULTS.growth_margin

  const load = runLoadAnalysis(devices, growthMargin)
  const battery = sizeBattery(facilityData, siteData, systemParams, load)
  const pv = sizePvArray(facilityData, siteData, systemParams, load)
  const inverter = sizeInverter(devices, load)
  const mppt = sizeMppt(pv, siteData)
  const baseline = calculateBaselineCosts(facilityData)
  const afterSolar = calculateAfterSolarCosts(
    facilityData,
    siteData,
    load,
    battery,
    pv,
  )
  const savings = calculateSavings(facilityData, afterSolar)
  const financing = compareFinancingOptions(pv, pricingTable, savings)

  return {
    load,
    battery,
    pv,
    inverter,
    mppt,
    baseline,
    afterSolar,
    savings,
    financing,
  }
}

