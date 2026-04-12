"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Brief indeterminate bar on client-side route changes (App Router).
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<"idle" | "run">("idle")
  const prev = useRef<string | null>(null)

  useEffect(() => {
    if (prev.current === null) {
      prev.current = pathname
      return
    }
    if (prev.current === pathname) return
    prev.current = pathname
    setPhase("run")
    const t = window.setTimeout(() => setPhase("idle"), 450)
    return () => window.clearTimeout(t)
  }, [pathname])

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed top-0 left-0 right-0 z-[97] h-[3px] overflow-hidden transition-opacity duration-150",
        phase === "run" ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="h-full w-full animate-pulse bg-gradient-to-r from-accent/40 via-accent to-accent/40 bg-[length:200%_100%] motion-reduce:animate-none" />
    </div>
  )
}
