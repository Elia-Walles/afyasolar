import { ManagementPanelSitesContent } from '@/components/management-panel/management-panel-sites'

export default function ManagementPanelSitesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Installation Sites</h1>
      <p className="text-gray-600 mb-6">All sites where the system has been installed and is operational.</p>
      <ManagementPanelSitesContent />
    </div>
  )
}
