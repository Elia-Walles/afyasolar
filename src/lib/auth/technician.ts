import { db } from '@/lib/db'
import { technicians } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface TechnicianSessionUser {
  technicianId?: string
  email: string
  id: string
}

export async function resolveTechnicianId(user: TechnicianSessionUser): Promise<string | null> {
  if (user.technicianId) {
    return user.technicianId
  }

  const [technician] = await db
    .select({ id: technicians.id })
    .from(technicians)
    .where(eq(technicians.email, user.email))
    .limit(1)

  return technician?.id || null
}

