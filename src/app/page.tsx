import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"

const FACILITY_SOLAR_ROUTE = "/services/afya-solar"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    const role = session.user.role
    const email = session.user.email?.toLowerCase()
    console.log("[Landing] Session detected on /", {
      userId: session.user.id,
      role,
      facilityId: session.user.facilityId,
    })

    if (email === "services@ubuntuafyalink.co.tz") {
      redirect("/dashboard/management-panel")
    }
    if (role === "facility") {
      redirect(FACILITY_SOLAR_ROUTE)
    }
    if (role === "admin") {
      redirect("/dashboard/admin")
    }
    if (role === "technician") {
      redirect("/dashboard/technician")
    }
    if (role === "investor") {
      redirect("/dashboard/investor")
    }
  }

  console.log("[Landing] No session on /, redirecting to /auth/signin")
  redirect("/auth/signin")
}
