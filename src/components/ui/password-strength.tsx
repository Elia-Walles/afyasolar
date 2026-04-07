"use client"

import { getPasswordStrength } from "@/lib/password-validation"
import { Progress } from "@/components/ui/progress"

interface PasswordStrengthIndicatorProps {
  password: string
  userInputs?: string[]
  className?: string
}

export function PasswordStrengthIndicator({ password, userInputs = [], className }: PasswordStrengthIndicatorProps) {
  if (!password) return null

  const strength = getPasswordStrength(password, userInputs)

  const progressValue = (strength.score / 4) * 100
  const colorClass = strength.color === 'green' ? 'bg-green-600' :
    strength.color === 'blue' ? 'bg-blue-600' :
    strength.color === 'yellow' ? 'bg-yellow-600' :
    strength.color === 'orange' ? 'bg-orange-600' :
    'bg-red-600'
  
  const textColorClass = strength.color === 'green' ? 'text-green-600' :
    strength.color === 'blue' ? 'text-blue-600' :
    strength.color === 'yellow' ? 'text-yellow-600' :
    strength.color === 'orange' ? 'text-orange-600' :
    'text-red-600'

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">Strength:</span>
        <span className={`font-medium ${textColorClass}`}>
          {strength.label}
        </span>
      </div>
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${colorClass}`}
          style={{ width: `${progressValue}%` }}
        />
      </div>
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
          {strength.feedback.slice(0, 2).map((suggestion, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-green-600 mt-0.5">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

