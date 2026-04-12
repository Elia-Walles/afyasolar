"use client"

import { useIsFetching, useIsMutating } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

/**
 * Thin top bar when any React Query request or mutation is in flight (background + foreground).
 */
export function GlobalAsyncStatus() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const active = fetching + mutating > 0

  return (
    <div
      role="progressbar"
      aria-hidden={!active}
      aria-valuetext={active ? "Loading" : undefined}
      className={cn(
        "pointer-events-none fixed top-0 left-0 right-0 z-[98] h-[3px] overflow-hidden transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="h-full w-full animate-pulse bg-gradient-to-r from-primary/30 via-primary to-primary/30 bg-[length:200%_100%] motion-reduce:animate-none" />
    </div>
  )
}
