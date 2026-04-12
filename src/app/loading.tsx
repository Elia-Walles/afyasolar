import { Loader2 } from "lucide-react"

/** Default loading UI for App Router segments (instant feedback on navigation). */
export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] w-full flex-col items-center justify-center gap-3 px-4 py-16">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground text-center max-w-sm">Loading…</p>
    </div>
  )
}
