import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { TechnicianDashboard } from "@/components/dashboard/technician-dashboard"
import { resolveTechnicianId } from "@/lib/auth/technician"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function TechnicianDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role !== "technician") {
    redirect("/dashboard/facility")
  }

  const technicianProfileId = await resolveTechnicianId(session.user)
  if (!technicianProfileId) {
    redirect("/dashboard")
  }

  return <TechnicianDashboard technicianId={technicianProfileId} />
}

