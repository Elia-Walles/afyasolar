/** Normalize unknown errors into a user-safe string for toasts and UI. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error == null) return fallback
  if (typeof error === "string") return error.trim() || fallback
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m
  }
  return fallback
}
