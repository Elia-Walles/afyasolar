import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"

const MANAGEMENT_PANEL_EMAIL = 'services@ubuntuafyalink.co.tz'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard/facility")
  }

  if (session.user.email?.toLowerCase() === MANAGEMENT_PANEL_EMAIL) {
    redirect("/dashboard/management-panel")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
