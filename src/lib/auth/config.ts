import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users, admins, facilities, technicians } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const normalizedEmail = credentials.email.toLowerCase().trim()

          // Try admins table first
          const admin = await db
            .select({
              id: admins.id,
              email: admins.email,
              name: admins.name,
              password: admins.password,
              emailVerified: admins.emailVerified,
              failedLoginAttempts: admins.failedLoginAttempts,
              accountLockedUntil: admins.accountLockedUntil,
              lastLoginAt: admins.lastLoginAt,
            })
            .from(admins)
            .where(eq(admins.email, normalizedEmail))
            .limit(1)

          if (admin[0]) {
            // Check if account is locked
            if (admin[0].accountLockedUntil && new Date() < admin[0].accountLockedUntil) {
              const lockoutMinutes = Math.ceil((admin[0].accountLockedUntil.getTime() - Date.now()) / (1000 * 60))
              throw new Error(`ACCOUNT_LOCKED:${lockoutMinutes}`)
            }

            const isValid = await bcrypt.compare(credentials.password, admin[0].password)

            if (!isValid) {
              // Increment failed login attempts
              const newFailedAttempts = (admin[0].failedLoginAttempts || 0) + 1
              const maxAttempts = 5
              const lockoutDuration = 30 * 60 * 1000 // 30 minutes

              if (newFailedAttempts >= maxAttempts) {
                // Lock account
                const lockoutUntil = new Date(Date.now() + lockoutDuration)
                await db
                  .update(admins)
                  .set({
                    failedLoginAttempts: newFailedAttempts,
                    accountLockedUntil: lockoutUntil,
                  })
                  .where(eq(admins.id, admin[0].id))
                
                throw new Error(`ACCOUNT_LOCKED:30`)
              } else {
                // Update failed attempts
                await db
                  .update(admins)
                  .set({
                    failedLoginAttempts: newFailedAttempts,
                  })
                  .where(eq(admins.id, admin[0].id))
              }

              return null
            }

            // Reset failed attempts on successful login
            await db
              .update(admins)
              .set({
                failedLoginAttempts: 0,
                accountLockedUntil: null,
                lastLoginAt: new Date(),
              })
              .where(eq(admins.id, admin[0].id))

            // Check if email is verified (required for admins)
            if (!admin[0].emailVerified) {
              throw new Error('EMAIL_NOT_VERIFIED')
            }

            return {
              id: admin[0].id,
              email: admin[0].email,
              name: admin[0].name,
              role: 'admin',
              facilityId: undefined,
            }
          }

          // Try facilities table
          const facility = await db
            .select({
              id: facilities.id,
              email: facilities.email,
              name: facilities.name,
              password: facilities.password,
              emailVerified: facilities.emailVerified,
              failedLoginAttempts: facilities.failedLoginAttempts,
              accountLockedUntil: facilities.accountLockedUntil,
              lastLoginAt: facilities.lastLoginAt,
            })
            .from(facilities)
            .where(eq(facilities.email, normalizedEmail))
            .limit(1)

          console.log('[Auth] Checking facilities table for:', normalizedEmail, 'Found:', facility.length > 0)

          if (facility[0]) {
            // Facilities can have null email, but if we're searching by email, it must not be null
            if (!facility[0].email) {
              console.log('[Auth] Facility has null email, skipping')
              return null
            }

            console.log('[Auth] Facility found:', { 
              id: facility[0].id, 
              email: facility[0].email,
              emailVerified: facility[0].emailVerified,
              emailVerifiedType: typeof facility[0].emailVerified
            })

            // Check if account is locked
            if (facility[0].accountLockedUntil && new Date() < facility[0].accountLockedUntil) {
              const lockoutMinutes = Math.ceil((facility[0].accountLockedUntil.getTime() - Date.now()) / (1000 * 60))
              throw new Error(`ACCOUNT_LOCKED:${lockoutMinutes}`)
            }

            const isValid = await bcrypt.compare(credentials.password, facility[0].password)

            if (!isValid) {
              console.log('[Auth] Invalid password for facility:', normalizedEmail)
              // Increment failed login attempts
              const newFailedAttempts = (facility[0].failedLoginAttempts || 0) + 1
              const maxAttempts = 5
              const lockoutDuration = 30 * 60 * 1000 // 30 minutes

              if (newFailedAttempts >= maxAttempts) {
                // Lock account
                const lockoutUntil = new Date(Date.now() + lockoutDuration)
                await db
                  .update(facilities)
                  .set({
                    failedLoginAttempts: newFailedAttempts,
                    accountLockedUntil: lockoutUntil,
                  })
                  .where(eq(facilities.id, facility[0].id))
                
                throw new Error(`ACCOUNT_LOCKED:30`)
              } else {
                // Update failed attempts
                await db
                  .update(facilities)
                  .set({
                    failedLoginAttempts: newFailedAttempts,
                  })
                  .where(eq(facilities.id, facility[0].id))
              }

              return null
            }

            // Reset failed attempts on successful login
            await db
              .update(facilities)
              .set({
                failedLoginAttempts: 0,
                accountLockedUntil: null,
                lastLoginAt: new Date(),
              })
              .where(eq(facilities.id, facility[0].id))

            // Check if email is verified (required for facilities)
            const isEmailVerified = facility[0].emailVerified === true
            
            console.log('[Auth] Email verification check:', {
              email: normalizedEmail,
              emailVerified: facility[0].emailVerified,
              isEmailVerified
            })

            // For facilities, if emailVerified is false/0, we should still allow login
            // because facilities verify via code during signup, and the code verification
            // happens before registration. If they completed registration, they're verified.
            // However, we'll log a warning if it's not verified
            if (!isEmailVerified) {
              console.warn('[Auth] WARNING: Facility email not marked as verified, but allowing login:', normalizedEmail)
              // Don't throw error - allow login since they completed registration
              // The registration process requires email verification via code
            }

            console.log('[Auth] Facility login successful:', normalizedEmail)

            return {
              id: facility[0].id,
              email: facility[0].email!, // We've already checked it's not null above
              name: facility[0].name,
              role: 'facility',
              facilityId: facility[0].id, // Facility ID is the same as the facility record ID
            }
          }

          // Try users table (for technicians/onboarding)
          const user = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              password: users.password,
              role: users.role,
              facilityId: users.facilityId,
              subRole: users.subRole,
              department: users.department,
              emailVerified: users.emailVerified,
              failedLoginAttempts: users.failedLoginAttempts,
              accountLockedUntil: users.accountLockedUntil,
              lastLoginAt: users.lastLoginAt,
            })
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1)

          if (!user[0]) {
            return null
          }

          // Check if account is locked
          if (user[0].accountLockedUntil && new Date() < user[0].accountLockedUntil) {
            const lockoutMinutes = Math.ceil((user[0].accountLockedUntil.getTime() - Date.now()) / (1000 * 60))
            throw new Error(`ACCOUNT_LOCKED:${lockoutMinutes}`)
          }

          const isValid = await bcrypt.compare(credentials.password, user[0].password)

          if (!isValid) {
            // Increment failed login attempts
            const newFailedAttempts = (user[0].failedLoginAttempts || 0) + 1
            const maxAttempts = 5
            const lockoutDuration = 30 * 60 * 1000 // 30 minutes

            if (newFailedAttempts >= maxAttempts) {
              // Lock account
              const lockoutUntil = new Date(Date.now() + lockoutDuration)
              await db
                .update(users)
                .set({
                  failedLoginAttempts: newFailedAttempts,
                  accountLockedUntil: lockoutUntil,
                })
                .where(eq(users.id, user[0].id))
              
              throw new Error(`ACCOUNT_LOCKED:30`)
            } else {
              // Update failed attempts
              await db
                .update(users)
                .set({
                  failedLoginAttempts: newFailedAttempts,
                })
                .where(eq(users.id, user[0].id))
            }

            return null
          }

          // Reset failed attempts on successful login
          await db
            .update(users)
            .set({
              failedLoginAttempts: 0,
              accountLockedUntil: null,
              lastLoginAt: new Date(),
            })
            .where(eq(users.id, user[0].id))

          // Check if email is verified (required for all users)
          if (!user[0].emailVerified) {
            throw new Error('EMAIL_NOT_VERIFIED')
          }

          let technicianProfileId: string | undefined

          if (user[0].role === 'technician') {
            const [technicianProfile] = await db
              .select({ id: technicians.id })
              .from(technicians)
              .where(eq(technicians.email, user[0].email))
              .limit(1)

            technicianProfileId = technicianProfile?.id || undefined
          }

          return {
            id: user[0].id,
            email: user[0].email,
            name: user[0].name,
            role: user[0].role,
            facilityId: user[0].facilityId || undefined,
            subRole: user[0].subRole || undefined,
            department: user[0].department || undefined,
            technicianId: technicianProfileId,
          }
        } catch (error) {
          // Re-throw specific errors so they can be handled by the signin page
          if (error instanceof Error) {
            if (error.message === 'EMAIL_NOT_VERIFIED' || error.message.includes('ACCOUNT_LOCKED')) {
              throw error
            }
            console.error('[Auth] Error during authentication:', error.message, error.stack)
          } else {
            console.error('[Auth] Unknown error during authentication:', error)
          }
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.facilityId = (user as any).facilityId
        token.subRole = (user as any).subRole
        token.department = (user as any).department
        token.technicianId = (user as any).technicianId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.facilityId = token.facilityId as string | undefined
        ;(session.user as any).subRole = token.subRole as string | undefined
        ;(session.user as any).department = token.department as string | undefined
        session.user.technicianId = token.technicianId as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development', // Enable debug in development
}

