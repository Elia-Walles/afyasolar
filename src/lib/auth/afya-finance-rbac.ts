export const AFYA_FINANCE_READONLY_SUBROLES = new Set<string>([
  'chief-executive-officer',
  'finance-and-administration-officer',
])

export function isAfyaFinanceReadOnlySubRole(subRole?: string | null) {
  // All users can now record sales - no read-only restrictions
  return false
}

