import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"

export default async function FacilityDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role === "facility") {
    redirect("/services/afya-solar")
  }

  if (session.user.role === "admin") {
    redirect("/dashboard/admin")
  }
  if (session.user.role === "technician") {
    redirect("/dashboard/technician")
  }
  if (session.user.role === "investor") {
    redirect("/dashboard/investor")
  }

  redirect("/")
}

