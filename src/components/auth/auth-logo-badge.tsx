import Image from "next/image"
import { cn } from "@/lib/utils"

interface AuthLogoBadgeProps {
  size?: number
  className?: string
  priority?: boolean
}

export function AuthLogoBadge({
  size = 88,
  className,
  priority = false,
}: AuthLogoBadgeProps) {
  const dimension = `${size}px`

  return (
    <div
      className={cn(
        "relative mx-auto rounded-full border-2 border-emerald-200 bg-white shadow-lg overflow-hidden",
        className,
      )}
      style={{ width: dimension, height: dimension }}
    >
      <Image
        src="/images/services/logo.png"
        alt="Ubuntu Afya Link logo"
        fill
        className="object-contain p-2.5"
        priority={priority}
      />
    </div>
  )
}

