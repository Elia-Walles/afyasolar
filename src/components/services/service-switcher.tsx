"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const SOLAR_ROUTE = "/services/afya-solar"

/** Afya Solar only: no multi-service hub; quick link to the solar dashboard. */
export function ServiceSwitcher() {
  const pathname = usePathname()
  const onSolar = pathname?.startsWith(SOLAR_ROUTE)

  return (
    <Button
      variant="outline"
      asChild
      className={cn(
        "flex items-center gap-2 border-green-200 text-green-800 hover:bg-green-50",
        onSolar && "border-green-400 bg-green-50/80"
      )}
    >
      <Link href={SOLAR_ROUTE}>
        <Sun className="w-4 h-4 text-green-600" />
        <span className="hidden sm:inline">Afya Solar</span>
      </Link>
    </Button>
  )
}
