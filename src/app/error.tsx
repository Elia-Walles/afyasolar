"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, Home, LogIn, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-green-100">
            <AlertCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-900">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-600">
            A temporary error occurred. You can try again or sign in to continue.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => window.location.assign("/auth/signin")}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Go to sign in
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/")}
          >
            <Home className="h-4 w-4 mr-2" />
            Go home
          </Button>
          <Button variant="ghost" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
