"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const SIGNIN_URL = "/auth/signin"

interface LogoutButtonProps {
  variant?: "default" | "outline" | "ghost" | "destructive" | "link" | "secondary"
  className?: string
  showIcon?: boolean
  title?: string
  showTextOnMobile?: boolean
}

export function LogoutButton({ 
  variant = "outline", 
  className = "",
  showIcon = true,
  title,
  showTextOnMobile = false,
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await signOut({ redirect: false, callbackUrl: SIGNIN_URL })
    } catch (error) {
      console.error("Logout error:", error)
    }
    // Full page redirect to avoid client-side transition that can trigger
    // "Rendered fewer hooks than expected" (React #300) when session becomes null
    window.location.assign(SIGNIN_URL)
  }

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoading}
      title={title}
      className={cn(
        // Default green hover styles that can be overridden
        "[&:hover]:bg-green-50 [&:hover]:text-green-700",
        className
      )}
    >
      {showIcon && <LogOut className="w-4 h-4 sm:mr-2" />}
      <span className={cn(
        showTextOnMobile ? "inline" : "hidden sm:inline"
      )}>{isLoading ? "Logging out..." : "Logout"}</span>
    </Button>
  )
}

