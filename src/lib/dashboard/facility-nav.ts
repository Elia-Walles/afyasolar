import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Gift,
  Plug,
  Zap,
  Gauge,
  CloudSun,
  Receipt,
  Bell,
  Leaf,
  CreditCard,
} from "lucide-react"

/** Sections available in the facility Afya Solar dashboard shell */
export type NavSection =
  | "overview"
  | "package-selection"
  | "devices"
  | "energy"
  | "energy-efficiency"
  | "climate-resilience"
  | "bills-payment"
  | "notifications"
  | "carbon-credits"
  | "subscription"
  | "settings"

export const FACILITY_NAV_ITEMS: { id: NavSection; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "package-selection", label: "Package Selection", icon: Gift },
  { id: "devices", label: "Devices", icon: Plug },
  { id: "energy", label: "Energy", icon: Zap },
  { id: "energy-efficiency", label: "Energy Efficiency", icon: Gauge },
  { id: "climate-resilience", label: "Climate Resilience", icon: CloudSun },
  { id: "bills-payment", label: "Bills & Payment", icon: Receipt },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "carbon-credits", label: "Carbon Credits", icon: Leaf },
  { id: "subscription", label: "Subscription", icon: CreditCard },
]

const ADMIN_HIDDEN_SECTIONS: NavSection[] = ["energy-efficiency", "climate-resilience"]

export function getFacilityNavItems(options: { adminMode: boolean }) {
  if (!options.adminMode) return FACILITY_NAV_ITEMS
  return FACILITY_NAV_ITEMS.filter((item) => !ADMIN_HIDDEN_SECTIONS.includes(item.id))
}

/** AfyaLink assessment tool (facilities perform assessments there; admins view snapshots in portfolio). */
export function getAfyaLinkAssessmentUrl() {
  const url = process.env.NEXT_PUBLIC_AFYALINK_ASSESSMENT_URL?.trim()
  return url && url.length > 0 ? url : null
}
