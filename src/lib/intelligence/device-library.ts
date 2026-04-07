/** Medical / facility device templates for Afya Solar Intelligence — typical wattage bands (user-editable after add). */

export type DeviceCategoryId =
  | "lighting"
  | "refrigeration"
  | "cooling"
  | "diagnostics"
  | "ict"
  | "pumps"
  | "sterilization"
  | "maternity"
  | "other"

export const DEVICE_CATEGORY_LABELS: Record<DeviceCategoryId, string> = {
  lighting: "Lighting",
  refrigeration: "Refrigeration",
  cooling: "Cooling",
  diagnostics: "Diagnostics",
  ict: "ICT",
  pumps: "Pumps",
  sterilization: "Sterilization",
  maternity: "Maternity / procedures",
  other: "Other",
}

export type CriticalityId = "critical" | "essential" | "non-essential"

export const CRITICALITY_LABELS: Record<CriticalityId, string> = {
  critical: "Critical (life-saving / cold chain)",
  essential: "Essential",
  "non-essential": "Non-essential",
}

export interface DeviceTemplate {
  id: string
  name: string
  category: DeviceCategoryId
  defaultWattage: number
  defaultHoursPerDay: number
  defaultQuantity: number
  suggestedCriticality: CriticalityId
  backupRecommended: boolean
}

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  { id: "led-tube", name: "LED tube / panel (typical)", category: "lighting", defaultWattage: 18, defaultHoursPerDay: 12, defaultQuantity: 20, suggestedCriticality: "non-essential", backupRecommended: false },
  { id: "fluorescent", name: "Fluorescent fitting (legacy)", category: "lighting", defaultWattage: 36, defaultHoursPerDay: 14, defaultQuantity: 10, suggestedCriticality: "non-essential", backupRecommended: false },
  { id: "vaccine-fridge", name: "Vaccine refrigerator", category: "refrigeration", defaultWattage: 150, defaultHoursPerDay: 24, defaultQuantity: 1, suggestedCriticality: "critical", backupRecommended: true },
  { id: "blood-fridge", name: "Blood bank refrigerator", category: "refrigeration", defaultWattage: 200, defaultHoursPerDay: 24, defaultQuantity: 1, suggestedCriticality: "critical", backupRecommended: true },
  { id: "room-fridge", name: "Room refrigerator (staff)", category: "refrigeration", defaultWattage: 100, defaultHoursPerDay: 24, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: false },
  { id: "split-ac", name: "Split air conditioner", category: "cooling", defaultWattage: 2400, defaultHoursPerDay: 10, defaultQuantity: 2, suggestedCriticality: "essential", backupRecommended: false },
  { id: "fan", name: "Ceiling / pedestal fan", category: "cooling", defaultWattage: 75, defaultHoursPerDay: 16, defaultQuantity: 6, suggestedCriticality: "non-essential", backupRecommended: false },
  { id: "ultrasound", name: "Ultrasound machine", category: "diagnostics", defaultWattage: 500, defaultHoursPerDay: 6, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: true },
  { id: "xray-small", name: "X-ray (small / portable)", category: "diagnostics", defaultWattage: 1500, defaultHoursPerDay: 4, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: true },
  { id: "lab-centrifuge", name: "Laboratory centrifuge", category: "diagnostics", defaultWattage: 400, defaultHoursPerDay: 4, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: false },
  { id: "microscope", name: "Microscope (LED)", category: "diagnostics", defaultWattage: 20, defaultHoursPerDay: 5, defaultQuantity: 2, suggestedCriticality: "essential", backupRecommended: false },
  { id: "pc-workstation", name: "PC workstation", category: "ict", defaultWattage: 150, defaultHoursPerDay: 10, defaultQuantity: 5, suggestedCriticality: "essential", backupRecommended: false },
  { id: "server-small", name: "Server / NAS (small)", category: "ict", defaultWattage: 200, defaultHoursPerDay: 24, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: true },
  { id: "router-ups", name: "Router + small UPS load", category: "ict", defaultWattage: 50, defaultHoursPerDay: 24, defaultQuantity: 2, suggestedCriticality: "essential", backupRecommended: true },
  { id: "water-pump", name: "Water pump (submersible / booster)", category: "pumps", defaultWattage: 1100, defaultHoursPerDay: 8, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: false },
  { id: "oxygen-conc", name: "Oxygen concentrator", category: "maternity", defaultWattage: 400, defaultHoursPerDay: 18, defaultQuantity: 2, suggestedCriticality: "critical", backupRecommended: true },
  { id: "infant-warmer", name: "Infant warmer", category: "maternity", defaultWattage: 600, defaultHoursPerDay: 12, defaultQuantity: 1, suggestedCriticality: "critical", backupRecommended: true },
  { id: "autoclave", name: "Autoclave / sterilizer", category: "sterilization", defaultWattage: 3000, defaultHoursPerDay: 3, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: false },
  { id: "dental-compressor", name: "Dental compressor", category: "other", defaultWattage: 1500, defaultHoursPerDay: 6, defaultQuantity: 1, suggestedCriticality: "essential", backupRecommended: false },
]

/** Curated bundles for quick facility setup */
export const DEVICE_BUNDLES: { id: string; label: string; templateIds: string[] }[] = [
  {
    id: "dispensary-basic",
    label: "Dispensary — basic",
    templateIds: ["led-tube", "vaccine-fridge", "pc-workstation", "router-ups", "water-pump"],
  },
  {
    id: "health-center-core",
    label: "Health center — core clinical",
    templateIds: ["led-tube", "vaccine-fridge", "blood-fridge", "ultrasound", "oxygen-conc", "autoclave", "water-pump", "pc-workstation"],
  },
  {
    id: "cold-chain-focus",
    label: "Cold chain focus",
    templateIds: ["vaccine-fridge", "blood-fridge", "room-fridge", "router-ups"],
  },
]

export function getTemplateById(id: string): DeviceTemplate | undefined {
  return DEVICE_TEMPLATES.find((t) => t.id === id)
}
