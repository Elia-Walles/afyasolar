import { FacilityDashboard } from "@/components/dashboard/facility-dashboard"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"

export default async function FacilityDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role !== "facility") {
    redirect("/auth/signin")
  }

  const facilityId = session.user.facilityId
  if (!facilityId) {
    redirect("/auth/signin")
  }

  return <FacilityDashboard facilityId={facilityId} />
}

