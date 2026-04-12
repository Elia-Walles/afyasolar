'use client'

import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/components/theme-provider'
import { useState } from 'react'
import { GlobalAsyncStatus } from '@/components/global-async-status'
import { NavigationProgress } from '@/components/navigation-progress'
import { ResponsiveAppToaster } from '@/components/responsive-app-toaster'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <NavigationProgress />
          <GlobalAsyncStatus />
          {children}
          <ResponsiveAppToaster />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

