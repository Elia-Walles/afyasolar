"use client"

import { Toaster } from "sonner"

/**
 * Toasts: readable width on small screens; top-center on mobile, top-right on sm+.
 */
export function ResponsiveAppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      visibleToasts={4}
      theme="system"
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group toast w-[min(100vw-1.5rem,24rem)] max-w-[min(100vw-1.5rem,24rem)] text-base sm:text-sm shadow-lg border border-border/60",
          title: "font-medium",
          description: "text-muted-foreground",
        },
      }}
      className="!pt-[max(0.75rem,env(safe-area-inset-top))] !px-[max(0.75rem,env(safe-area-inset-left))] sm:!left-auto sm:!right-4 sm:!top-4 sm:!px-0 sm:!pt-4"
    />
  )
}
