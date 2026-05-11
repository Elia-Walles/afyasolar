'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

/**
 * Afya Solar uses a single light theme (white + green). We force the theme
 * to "light" so the OS preference cannot switch the app into dark mode and
 * no stale "dark" value from localStorage can take effect.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      enableColorScheme={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

