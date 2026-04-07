import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"
import { TechnicianSettings } from "../../../../components/dashboard/technician-settings"
import { resolveTechnicianId } from "@/lib/auth/technician"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function TechnicianSettingsPage() {
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

  return <TechnicianSettings technicianId={technicianProfileId} />
}
