"use client"

import { cn } from '@/lib/utils'

interface StatusCalloutProps {
  title: string
  description: string
  intent?: 'info' | 'warning' | 'success'
}

export function StatusCallout({ title, description, intent = 'info' }: StatusCalloutProps) {
  const intentClass = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  }[intent]

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', intentClass)}>
      <p className="font-semibold">{title}</p>
      <p className="text-xs mt-1 opacity-90">{description}</p>
    </div>
  )
}

