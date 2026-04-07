import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { AdminDashboard } from "@/components/dashboard/admin-dashboard"

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard/facility")
  }

  return <AdminDashboard initialSection="overview" />
}

