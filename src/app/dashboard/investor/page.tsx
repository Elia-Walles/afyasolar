import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SimulatedDashboard from '@/components/investor/simulated-dashboard'

export default async function InvestorDashboardPage() {
  const session = await getServerSession(authOptions)

  // Check if user is authenticated and has investor role
  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'investor') {
    redirect('/auth/signin')
  }

  return <SimulatedDashboard />
}
