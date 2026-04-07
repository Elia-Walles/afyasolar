'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle } from 'lucide-react'

const SESSION_TAB_KEY = 'afya-link-tab-user-id'
const SESSION_TAB_EMAIL_KEY = 'afya-link-tab-user-email'

/**
 * SessionGuard Component
 * 
 * Detects when a different user logs in on another tab and warns the current user.
 * This helps prevent confusion when multiple users try to use the same browser.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [showSessionChange, setShowSessionChange] = useState(false)
  const [previousUser, setPreviousUser] = useState<string | null>(null)
  const [newUser, setNewUser] = useState<string | null>(null)

  // Store the current user in sessionStorage when they log in
  const storeCurrentUser = useCallback(() => {
    if (session?.user?.id) {
      const storedUserId = sessionStorage.getItem(SESSION_TAB_KEY)
      const storedEmail = sessionStorage.getItem(SESSION_TAB_EMAIL_KEY)
      
      // If there was a different user stored in this tab
      if (storedUserId && storedUserId !== session.user.id) {
        setPreviousUser(storedEmail || storedUserId)
        setNewUser(session.user.email || session.user.id)
        setShowSessionChange(true)
      }
      
      // Store the new user
      sessionStorage.setItem(SESSION_TAB_KEY, session.user.id)
      sessionStorage.setItem(SESSION_TAB_EMAIL_KEY, session.user.email || '')
    }
  }, [session?.user?.id, session?.user?.email])

  // Check session on mount and when session changes
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      storeCurrentUser()
    }
    
    // Clear stored user when logged out
    if (status === 'unauthenticated') {
      sessionStorage.removeItem(SESSION_TAB_KEY)
      sessionStorage.removeItem(SESSION_TAB_EMAIL_KEY)
    }
  }, [status, session?.user?.id, storeCurrentUser])

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // This fires when another tab changes localStorage
      // We use this to detect cross-tab session changes
      if (e.key === 'nextauth.message') {
        // NextAuth broadcasts session changes
        // Re-check our session
        const storedUserId = sessionStorage.getItem(SESSION_TAB_KEY)
        if (storedUserId && session?.user?.id && storedUserId !== session.user.id) {
          setPreviousUser(sessionStorage.getItem(SESSION_TAB_EMAIL_KEY) || storedUserId)
          setNewUser(session.user.email || session.user.id)
          setShowSessionChange(true)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [session?.user?.id, session?.user?.email])

  // Periodically check if session matches what this tab expects
  useEffect(() => {
    if (status !== 'authenticated') return

    const checkSession = () => {
      const storedUserId = sessionStorage.getItem(SESSION_TAB_KEY)
      if (storedUserId && session?.user?.id && storedUserId !== session.user.id) {
        setPreviousUser(sessionStorage.getItem(SESSION_TAB_EMAIL_KEY) || storedUserId)
        setNewUser(session.user.email || session.user.id)
        setShowSessionChange(true)
      }
    }

    // Check every 5 seconds
    const interval = setInterval(checkSession, 5000)
    
    // Also check on visibility change (when user switches back to this tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [status, session?.user?.id, session?.user?.email])

  const handleContinueAsNewUser = () => {
    // Update stored user to the new one
    if (session?.user?.id) {
      sessionStorage.setItem(SESSION_TAB_KEY, session.user.id)
      sessionStorage.setItem(SESSION_TAB_EMAIL_KEY, session.user.email || '')
    }
    setShowSessionChange(false)
  }

  const handleReLogin = () => {
    setShowSessionChange(false)
    // Clear session storage and redirect to login
    sessionStorage.removeItem(SESSION_TAB_KEY)
    sessionStorage.removeItem(SESSION_TAB_EMAIL_KEY)
    router.push('/auth/signin')
  }

  // Skip guard UI on public pages (auth, booking, feedback). All hooks must run above.
  const isPublicPage =
    !pathname ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/booking/') ||
    pathname.startsWith('/feedback') ||
    pathname.startsWith('/appointment/change')

  return (
    <>
      {children}
      {!isPublicPage && (
      <AlertDialog open={showSessionChange} onOpenChange={setShowSessionChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <AlertDialogTitle>Session Changed</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              <p>
                Another user has logged in on this browser. Your session has changed.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Previous user:</span>
                  <span className="font-medium text-gray-700">{previousUser}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current user:</span>
                  <span className="font-medium text-green-700">{newUser}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                💡 Tip: Use incognito/private windows or different browser profiles to login with multiple accounts simultaneously.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleReLogin} className="w-full sm:w-auto">
              Login as Different User
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleContinueAsNewUser}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              Continue as {newUser?.split('@')[0]}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
    </>
  )
}

