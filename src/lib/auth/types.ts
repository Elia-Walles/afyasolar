import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      facilityId?: string
      technicianId?: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    facilityId?: string
    technicianId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    facilityId?: string
    technicianId?: string
  }
}

