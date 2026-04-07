import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { ManagementPanelSettings } from '@/components/management-panel/management-panel-settings'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-6">Manage your account and panel preferences.</p>
      <ManagementPanelSettings user={session?.user} />
    </div>
  )
}
