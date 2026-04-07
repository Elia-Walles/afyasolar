"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface SubscriptionCountdownProps {
  expiryDate: string | Date | null | undefined
  billingCycle?: "monthly" | "yearly" | null
  className?: string
}

export function SubscriptionCountdown({ 
  expiryDate, 
  billingCycle,
  className 
}: SubscriptionCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    milliseconds: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (!expiryDate) {
      setTimeRemaining(null)
      return
    }

    const calculateTimeRemaining = () => {
      const expiry = new Date(expiryDate)
      const now = new Date()
      const diff = expiry.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          milliseconds: 0,
          total: 0,
        })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      const milliseconds = Math.floor((diff % 1000) / 10) // Show centiseconds (0-99)

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        milliseconds,
        total: diff,
      })
    }

    // Calculate immediately
    calculateTimeRemaining()

    // Update every 100ms for smooth milliseconds countdown
    const interval = setInterval(calculateTimeRemaining, 100)

    return () => clearInterval(interval)
  }, [expiryDate])

  if (!expiryDate || !timeRemaining) {
    return null
  }

  const isExpired = timeRemaining.total <= 0
  const isExpiringSoon = timeRemaining.days <= 7 && timeRemaining.days > 0
  const isExpiringVerySoon = timeRemaining.days <= 3 && timeRemaining.days > 0
  const isExpiringToday = timeRemaining.days === 0 && timeRemaining.total > 0

  // Determine color based on time remaining
  let bgColor = "bg-green-50"
  let textColor = "text-green-700"
  let borderColor = "border-green-200"
  let iconColor = "text-green-600"

  if (isExpired) {
    bgColor = "bg-red-50"
    textColor = "text-red-700"
    borderColor = "border-red-200"
    iconColor = "text-red-600"
  } else if (isExpiringToday) {
    bgColor = "bg-red-100"
    textColor = "text-red-800"
    borderColor = "border-red-300"
    iconColor = "text-red-700"
  } else if (isExpiringVerySoon) {
    bgColor = "bg-orange-50"
    textColor = "text-orange-700"
    borderColor = "border-orange-200"
    iconColor = "text-orange-600"
  } else if (isExpiringSoon) {
    bgColor = "bg-yellow-50"
    textColor = "text-yellow-700"
    borderColor = "border-yellow-200"
    iconColor = "text-yellow-600"
  }

  const formatTime = () => {
    if (isExpired) {
      return "Expired"
    }

    const ms = String(timeRemaining.milliseconds).padStart(2, '0')
    
    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`
    } else if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s.${ms}`
    } else if (timeRemaining.minutes > 0) {
      return `${timeRemaining.minutes}m ${timeRemaining.seconds}s.${ms}`
    } else {
      return `${timeRemaining.seconds}s.${ms}`
    }
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border",
        bgColor,
        textColor,
        borderColor,
        className
      )}
    >
      <Clock className={cn("h-4 w-4", iconColor)} />
      <div className="flex flex-col">
        <span className="text-xs font-medium leading-tight">
          {billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription
        </span>
        <span className="text-xs font-mono leading-tight tabular-nums">
          {formatTime()}
        </span>
      </div>
    </div>
  )
}

