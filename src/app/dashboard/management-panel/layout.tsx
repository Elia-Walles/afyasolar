import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { ManagementPanelSidebar } from '@/components/management-panel/management-panel-sidebar'

const MANAGEMENT_PANEL_EMAIL = 'services@ubuntuafyalink.co.tz'

export default async function ManagementPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  const email = session.user?.email?.toLowerCase()
  if (email !== MANAGEMENT_PANEL_EMAIL) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      <ManagementPanelSidebar />
      <main className="min-h-screen overflow-auto scroll-smooth [scrollbar-gutter:stable] lg:ml-64 transition-[margin] duration-200">
        <div className="p-4 lg:p-6 pt-16 lg:pt-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
