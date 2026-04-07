import type { SizingSummary, MeuSummary } from "@/components/solar/afya-solar-sizing-tool"

export type RecommendationPriority = "high" | "medium" | "low"
export type ActionHorizon = "immediate" | "medium" | "capital"

export interface IntelligenceRecommendation {
  id: string
  title: string
  issue: string
  whyItMatters: string
  action: string
  priority: RecommendationPriority
  horizon: ActionHorizon
  expectedImpact: string
  moduleSource: "energy" | "operations" | "integrated"
}

export interface SectionScores {
  reliability: number
  wastage: number
  thermal: number
  behavior: number
}

function push(
  list: IntelligenceRecommendation[],
  rec: Omit<IntelligenceRecommendation, "id"> & { id?: string }
) {
  list.push({
    id: rec.id ?? `rec-${list.length + 1}`,
    ...rec,
  } as IntelligenceRecommendation)
}

export function buildIntelligenceRecommendations(
  sizing: SizingSummary | null,
  meu: MeuSummary | null,
  bmi: { score: number | null; bmiPercent: number | null } | null,
  sections: SectionScores | null
): IntelligenceRecommendation[] {
  const out: IntelligenceRecommendation[] = []

  if (meu && meu.totalDailyLoad > 0) {
    const top = meu.topDevices[0]
    if (top && top.shareOfTotal >= 35) {
      push(out, {
        title: "Address dominant load",
        issue: `${top.name} accounts for about ${top.shareOfTotal.toFixed(0)}% of daily kWh.`,
        whyItMatters: "Concentrated load drives inverter and battery sizing; small changes here have outsized impact.",
        action: "Review runtime schedules, efficiency rating, and whether the load should be on critical backup.",
        priority: "high",
        horizon: "medium",
        expectedImpact: "Potential reduction in required solar kW and battery kWh.",
        moduleSource: "energy",
      })
    }

    const critPct =
      meu.totalDailyLoad > 0
        ? ((meu.criticalityBreakdown.critical + meu.criticalityBreakdown.essential) / meu.totalDailyLoad) * 100
        : 0
    if (critPct > 70) {
      push(out, {
        title: "High critical load share",
        issue: "A large share of daily energy is tagged critical or essential.",
        whyItMatters: "Backup and battery autonomy must cover these loads during outages.",
        action: "Validate criticality tags; shift non-urgent loads off critical circuits where safe.",
        priority: "high",
        horizon: "immediate",
        expectedImpact: "Lower backup energy requirement and diesel use during outages.",
        moduleSource: "integrated",
      })
    }
  }

  if (sizing) {
    if (sizing.annualSavings > 0 && sizing.solarArraySize > 0) {
      push(out, {
        title: "Solar sizing alignment",
        issue: `Indicative array size is ~${sizing.solarArraySize.toFixed(1)} kW with estimated annual savings ${Math.round(sizing.annualSavings).toLocaleString()} TZS.`,
        whyItMatters: "Right-sizing avoids over- or under-investment relative to your demand.",
        action: "Cross-check with Afya Solar package catalogue or request custom design if above largest package.",
        priority: "medium",
        horizon: "capital",
        expectedImpact: "Improved payback and reliability when matched to measured load.",
        moduleSource: "energy",
      })
    }
  }

  if (bmi != null && bmi.score !== null && bmi.score < 24) {
    push(out, {
      title: "Strengthen operational energy management",
      issue: `BMI from the operational checklist is ${bmi.score}/40 (${bmi.bmiPercent ?? 0}%).`,
      whyItMatters: "Behavior and maintenance often determine real savings after hardware is installed.",
      action: "Prioritise staff training, LED retrofits, and assigning an energy focal person.",
      priority: "medium",
      horizon: "medium",
      expectedImpact: "Higher realised savings and fewer equipment failures.",
      moduleSource: "operations",
    })
  }

  if (sections) {
    if (sections.reliability > 0 && sections.reliability <= 6) {
      push(out, {
        title: "Power reliability gap",
        issue: "Power reliability & backup scores are low relative to best practice.",
        whyItMatters: "Clinical services depend on predictable electricity during outages.",
        action: "Map critical loads, improve backup coverage, and document outage response.",
        priority: "high",
        horizon: "immediate",
        expectedImpact: "Reduced service disruption and cold-chain risk.",
        moduleSource: "operations",
      })
    }
    if (sections.wastage > 0 && sections.wastage <= 6) {
      push(out, {
        title: "Energy wastage opportunity",
        issue: "Lighting and idle-load practices score below target.",
        whyItMatters: "Wastage increases cost without improving care quality.",
        action: "Adopt LED targets, switch-off SOPs, and review long-running equipment.",
        priority: "medium",
        horizon: "immediate",
        expectedImpact: "Lower baseline kWh before solar is sized.",
        moduleSource: "operations",
      })
    }
  }

  if (out.length === 0) {
    push(out, {
      title: "Complete your assessment",
      issue: "Not enough data yet for targeted recommendations.",
      whyItMatters: "The intelligence layer needs devices, costs, and operational scores.",
      action: "Finish Devices & loads, run the design engine, and complete the operational checklist.",
      priority: "low",
      horizon: "immediate",
      expectedImpact: "Unlocks ranked actions and charts.",
      moduleSource: "integrated",
    })
  }

  return out
}
