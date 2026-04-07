"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24, background: "#f9fafb", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111", marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
            A temporary error occurred. Please sign in again to continue.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <a
              href="/auth/signin"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "#059669",
                color: "white",
                textDecoration: "none",
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              Go to sign in
            </a>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
