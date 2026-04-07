import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { db } from '@/lib/db'
import {
  afyaSolarPackages,
  afyaSolarPlans,
  afyaSolarPlanPricing,
  afyaSolarDesignReports,
} from '@/lib/db/afya-solar-schema'
import {
  runFullSizing,
  type DeviceLoadRow,
  type FacilityDataInput,
  type SolarSiteDataInput,
  type SystemParametersInput,
  type PricingRow,
} from '@/lib/afya-solar/sizing-engine'
import { sendAfyaSolarDesignReportEmail } from '@/lib/email'
import { facilities } from '@/lib/db/schema'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const deviceSchema = z.object({
  device_name: z.string(),
  wattage_w: z.number().nonnegative(),
  quantity: z.number().int().nonnegative(),
  hours_per_day: z.number().nonnegative(),
  is_critical: z.boolean(),
  is_motor: z.boolean().optional(),
  motor_type: z.enum(['compressor', 'pump', 'generic']).optional(),
})

const facilitySchema = z.object({
  facility_type: z.enum(['on_grid', 'hybrid', 'off_grid']),
  avg_outage_hours_per_day: z.number().nonnegative(),
  tanesco_monthly_bill_tzs: z.number().nonnegative(),
  diesel_litres_per_day: z.number().nonnegative(),
  diesel_price_tzs_per_litre: z.number().nonnegative().optional(),
})

const siteSchema = z.object({
  peak_sun_hours_worst_month: z.number().positive(),
  system_dc_voltage: z.number().positive().optional(),
  battery_chemistry: z.enum(['lifepo4', 'lead_acid']),
  autonomy_days: z.number().positive().optional(),
})

const paramsSchema = z.object({
  panel_watt_rating: z.number().positive().optional(),
  growth_margin: z.number().nonnegative().optional(),
  inverter_efficiency: z.number().positive().max(1).optional(),
  battery_efficiency: z.number().positive().max(1).optional(),
})

const bodySchema = z.object({
  DEVICE_LOAD_TABLE: z.array(deviceSchema),
  FACILITY_DATA: facilitySchema,
  SOLAR_SITE_DATA: siteSchema,
  SYSTEM_PARAMETERS: paramsSchema.optional(),
  // Optional: if present, restrict pricing to specific package IDs
  packageIds: z.array(z.number().int().positive()).optional(),
  facilityId: z.string().uuid().optional(),
  facilityName: z.string().optional(),
  // Optional client-side context (for richer reporting, not used by engine)
  CLIENT_CONTEXT: z
    .object({
      solarOffset: z.number().optional(),
      meuSummary: z.any().optional(),
    })
    .optional(),
})

async function loadPricingTable(packageIds?: number[]): Promise<PricingRow[]> {
  const conditions = [eq(afyaSolarPackages.isActive, 1)]

  if (packageIds && packageIds.length > 0) {
    // simple IN emulation via or chain is overkill; rely on ratedKw only when ids not provided
  }

  const rows = await db
    .select({
      systemSizeKw: afyaSolarPackages.ratedKw,
      planTypeCode: afyaSolarPlans.planTypeCode,
      cashPrice: afyaSolarPlanPricing.cashPrice,
      installmentDurationMonths: afyaSolarPlanPricing.installmentDurationMonths,
      defaultUpfrontPercent: afyaSolarPlanPricing.defaultUpfrontPercent,
      defaultMonthlyAmount: afyaSolarPlanPricing.defaultMonthlyAmount,
      eaasMonthlyFee: afyaSolarPlanPricing.eaasMonthlyFee,
    })
    .from(afyaSolarPackages)
    .leftJoin(
      afyaSolarPlans,
      eq(afyaSolarPackages.id, afyaSolarPlans.packageId),
    )
    .leftJoin(
      afyaSolarPlanPricing,
      eq(afyaSolarPlans.id, afyaSolarPlanPricing.planId),
    )
    .where(and(...conditions))

  const bySize: Record<number, Partial<PricingRow>> = {}

  for (const row of rows) {
    if (!row.systemSizeKw) continue
    const size = Number(row.systemSizeKw)
    if (!Number.isFinite(size)) continue
    if (!bySize[size]) {
      bySize[size] = {
        system_size_kw: size,
        cash_price_tzs: 0,
        install_upfront_tzs: 0,
        install_monthly_tzs: 0,
        install_term_months: 0,
        eaas_monthly_tzs: null,
        eaas_term_months: null,
      }
    }
    const entry = bySize[size]

    if (row.planTypeCode === 'CASH' && row.cashPrice != null) {
      entry.cash_price_tzs = Number(row.cashPrice)
    }

    if (
      row.planTypeCode === 'INSTALLMENT' &&
      row.installmentDurationMonths != null &&
      row.defaultMonthlyAmount != null &&
      row.defaultUpfrontPercent != null &&
      row.cashPrice != null
    ) {
      const cash = Number(row.cashPrice)
      const upfrontPercent = Number(row.defaultUpfrontPercent)
      entry.install_term_months = Number(row.installmentDurationMonths)
      entry.install_monthly_tzs = Number(row.defaultMonthlyAmount)
      entry.install_upfront_tzs = Math.round((upfrontPercent / 100) * cash)
    }

    if (row.planTypeCode === 'EAAS' && row.eaasMonthlyFee != null) {
      entry.eaas_monthly_tzs = Number(row.eaasMonthlyFee)
      // Align with 6‑year (72 month) minimum term by default
      entry.eaas_term_months = 72
    }
  }

  return Object.values(bySize) as PricingRow[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = bodySchema.parse(json)

    const devices: DeviceLoadRow[] = parsed.DEVICE_LOAD_TABLE
    const facility: FacilityDataInput = parsed.FACILITY_DATA
    const site: SolarSiteDataInput = parsed.SOLAR_SITE_DATA
    const params: SystemParametersInput = parsed.SYSTEM_PARAMETERS ?? {}

    const pricingTable = await loadPricingTable(parsed.packageIds)

    const result = runFullSizing(
      devices,
      facility,
      site,
      params,
      pricingTable,
    )

    // Persist a summarized report for admins if we have at least some facility context
    if (parsed.facilityId || parsed.facilityName) {
      try {
        // If facilityName was not provided in the payload but we have an ID, look it up from DB
        let effectiveFacilityName = parsed.facilityName ?? null
        let effectiveFacilityEmail: string | null = null
        if (!effectiveFacilityName && parsed.facilityId) {
          try {
            const [facilityRow] = await db
              .select({ name: facilities.name, email: facilities.email })
              .from(facilities)
              .where(eq(facilities.id, parsed.facilityId))
              .limit(1)
            if (facilityRow?.name) {
              effectiveFacilityName = facilityRow.name
            }
            if (facilityRow?.email) {
              effectiveFacilityEmail = facilityRow.email
            }
          } catch (lookupErr) {
            console.error(
              'Error looking up facility name for Afya Solar design report email:',
              lookupErr,
            )
          }
        }

        const selectedPricing = result.financing.selected_pricing
        const insertResult = await db.insert(afyaSolarDesignReports).values({
          facilityId: parsed.facilityId ?? null,
          facilityName: effectiveFacilityName,
          pvSizeKw: result.pv.P_pv_actual_kw,
          batteryKwh: result.battery.E_battery_nameplate,
          grossMonthlySavings: result.savings.gross_monthly_savings,
          totalDailyEnergyKwh: result.load.E_day_total,
          criticalEnergyKwh: result.load.E_day_critical,
          adjustedDailyEnergyKwh: result.load.E_day_total_adj,
          numPanels: result.pv.panels_required,
          batteryAh: result.battery.battery_Ah,
          inverterKw: result.inverter.inverter_continuous_kw,
          mpptCurrentA: result.mppt.I_mppt,
          baselineGridMonthly: facility.tanesco_monthly_bill_tzs,
          baselineDieselMonthly: result.baseline.diesel_cost_monthly,
          baselineTotalMonthly: result.baseline.baseline_cost_monthly,
          afterGridMonthly: result.afterSolar.grid_after_monthly,
          afterDieselMonthly: result.afterSolar.diesel_after_monthly,
          afterTotalMonthly: result.afterSolar.total_after_solar_monthly,
          cashPriceTzs: selectedPricing?.cash_price_tzs ?? null,
          cashPaybackMonths: result.financing.cash_payback_months ?? null,
          installmentUpfrontTzs: selectedPricing?.install_upfront_tzs ?? null,
          installmentMonthlyTzs: selectedPricing?.install_monthly_tzs ?? null,
          installmentTermMonths: selectedPricing?.install_term_months ?? null,
          installmentNetSavingsTzs: result.financing.installment_net_savings_monthly ?? null,
          installmentBreakevenMonths: result.financing.installment_breakeven_months ?? null,
          eaasMonthlyTzs: selectedPricing?.eaas_monthly_tzs ?? null,
          eaasTermMonths: selectedPricing?.eaas_term_months ?? null,
          eaasNetSavingsTzs: result.financing.eaas_net_savings_monthly ?? null,
          meuTotalDailyLoadKwh: parsed.CLIENT_CONTEXT?.meuSummary?.totalDailyLoad ?? null,
          payloadJson: JSON.stringify({
            input: {
              devices,
              facility,
              site,
              params,
            },
            result,
            clientContext: parsed.CLIENT_CONTEXT ?? null,
          }),
        })

        // Use the inserted report ID if available (Drizzle returns insertId for MySQL)
        const insertedId =
          (Array.isArray((insertResult as any)) && (insertResult as any)[0]?.insertId) ||
          (insertResult as any).insertId ||
          undefined

        // Fire-and-forget email notification to company email with key summary details
        if (insertedId) {
          void sendAfyaSolarDesignReportEmail({
            facilityName: effectiveFacilityName,
            facilityId: parsed.facilityId ?? null,
            facilityEmail: effectiveFacilityEmail,
            reportId: insertedId,
            summary: {
              pvSizeKw: result.pv.P_pv_actual_kw ?? null,
              batteryKwh: result.battery.E_battery_nameplate ?? null,
              grossMonthlySavings: result.savings.gross_monthly_savings ?? null,
              totalDailyEnergyKwh: result.load.E_day_total ?? null,
              adjustedDailyEnergyKwh: result.load.E_day_total_adj ?? null,
              numPanels: result.pv.panels_required ?? null,
            },
            meuSummary: (parsed.CLIENT_CONTEXT?.meuSummary as any) ?? null,
            costs: {
              baselineGridMonthly: facility.tanesco_monthly_bill_tzs ?? null,
              baselineDieselMonthly: result.baseline.diesel_cost_monthly ?? null,
              baselineTotalMonthly: result.baseline.baseline_cost_monthly ?? null,
              afterGridMonthly: result.afterSolar.grid_after_monthly ?? null,
              afterDieselMonthly: result.afterSolar.diesel_after_monthly ?? null,
              afterTotalMonthly: result.afterSolar.total_after_solar_monthly ?? null,
              grossMonthlySavings: result.savings.gross_monthly_savings ?? null,
            },
            financing: {
              cashPriceTzs: selectedPricing?.cash_price_tzs ?? null,
              cashPaybackMonths: result.financing.cash_payback_months ?? null,
              installmentUpfrontTzs: selectedPricing?.install_upfront_tzs ?? null,
              installmentMonthlyTzs: selectedPricing?.install_monthly_tzs ?? null,
              installmentTermMonths: selectedPricing?.install_term_months ?? null,
              installmentNetSavingsTzs:
                result.financing.installment_net_savings_monthly ?? null,
              installmentBreakevenMonths:
                result.financing.installment_breakeven_months ?? null,
              eaasMonthlyTzs: selectedPricing?.eaas_monthly_tzs ?? null,
              eaasTermMonths: selectedPricing?.eaas_term_months ?? null,
              eaasNetSavingsTzs: result.financing.eaas_net_savings_monthly ?? null,
            },
          })
        }
      } catch (err) {
        // Don't break the main flow if reporting persistence fails
        console.error('Error saving Afya Solar design report:', err)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        // 1. LOAD ANALYSIS
        load_analysis: {
          total_daily_energy_kwh: result.load.E_day_total,
          critical_energy_kwh: result.load.E_day_critical,
          total_daily_energy_adjusted_kwh: result.load.E_day_total_adj,
          critical_energy_adjusted_kwh: result.load.E_day_critical_adj,
        },
        // 2. SYSTEM DESIGN
        system_design: {
          pv_system_size_kw: result.pv.P_pv_actual_kw,
          number_of_620w_panels: result.pv.panels_required,
          battery_capacity_kwh: result.battery.E_battery_nameplate,
          battery_ah_at_system_voltage: result.battery.battery_Ah,
          recommended_inverter_kw: result.inverter.inverter_continuous_kw,
          mppt_current_a: result.mppt.I_mppt,
        },
        // 3. SOLAR PRODUCTION
        solar_production: {
          estimated_daily_solar_generation_kwh: result.pv.solar_energy_daily,
        },
        // 4. CURRENT ENERGY COST
        current_energy_cost: {
          grid_cost_monthly_tzs: facility.tanesco_monthly_bill_tzs,
          diesel_cost_monthly_tzs: result.baseline.diesel_cost_monthly,
          total_baseline_cost_monthly_tzs:
            result.baseline.baseline_cost_monthly,
        },
        // 5. AFTER SOLAR
        after_solar_cost: {
          grid_cost_after_monthly_tzs: result.afterSolar.grid_after_monthly,
          diesel_cost_after_monthly_tzs: result.afterSolar.diesel_after_monthly,
          total_cost_after_solar_monthly_tzs:
            result.afterSolar.total_after_solar_monthly,
        },
        // 6. MONTHLY SAVINGS
        monthly_savings: {
          gross_monthly_savings_tzs: result.savings.gross_monthly_savings,
        },
        // 7. FINANCING COMPARISON
        financing_comparison: result.financing,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 },
      )
    }
    console.error('Error in Afya Solar design/quote API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

