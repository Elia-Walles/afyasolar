import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Providers } from "@/components/providers"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { SessionGuard } from "@/components/auth/session-guard"
import { PushNotificationPrompt } from "@/components/push-notification-prompt"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: "Afya Solar | Healthcare facility solar dashboards",
  description: "Afya Solar: solar energy systems, monitoring, and facility energy dashboards for healthcare facilities in Tanzania.",
  generator: "Afya Solar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Afya Solar",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Afya Solar",
  },
  icons: {
    icon: [
      { url: "/images/services/logo.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [
      { url: "/images/services/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/images/services/logo.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} min-h-dvh overflow-x-hidden antialiased touch-manipulation`}
        suppressHydrationWarning
      >
        <Providers>
          <SessionGuard>
            {children}
          </SessionGuard>
          <InstallPrompt />
          <PushNotificationPrompt />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}

