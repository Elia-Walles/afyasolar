import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/config"

/**
 * Afya Solar only: there is no services hub. /services always sends users to the solar product.
 */
export default async function ServicesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user.role === "admin") {
    redirect("/dashboard/admin")
  }
  if (session.user.role === "technician") {
    redirect("/dashboard/technician")
  }

  redirect("/services/afya-solar")
}
