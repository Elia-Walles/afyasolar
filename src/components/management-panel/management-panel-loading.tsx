'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Full-page loading spinner with message */
export function ManagementPanelLoadingSpinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center animate-in fade-in duration-300">
      <div className="text-center">
        <div
          className="w-12 h-12 border-[3px] border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"
          aria-hidden
        />
        <p className="text-sm font-medium text-gray-600">{message}</p>
        <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
      </div>
    </div>
  )
}

/** Skeleton placeholder bar */
function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-md bg-gray-200/80 animate-pulse', className)}
      aria-hidden
    />
  )
}

/** Dashboard-style skeleton: stat cards + chart + list */
export function ManagementPanelDashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto scroll-smooth animate-in fade-in duration-300">
      <div className="mb-6">
        <SkeletonBar className="h-7 w-40 mb-2" />
        <SkeletonBar className="h-4 w-72 mb-2" />
        <SkeletonBar className="h-3 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <SkeletonBar className="h-4 w-24 mb-3" />
            <SkeletonBar className="h-8 w-16 mb-2" />
            <SkeletonBar className="h-3 w-28" />
          </div>
        ))}
      </div>
      <Card className="rounded-xl border shadow-sm overflow-hidden mb-6">
        <CardHeader className="bg-gray-50/50 border-b">
          <SkeletonBar className="h-5 w-44 mb-2" />
          <SkeletonBar className="h-4 w-64" />
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[260px] w-full rounded-lg bg-gray-100/80 animate-pulse" />
        </CardContent>
      </Card>
      <Card className="rounded-xl border shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b">
          <SkeletonBar className="h-5 w-52 mb-2" />
          <SkeletonBar className="h-4 w-48" />
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-white">
                <SkeletonBar className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <SkeletonBar className="h-4 w-3/4 mb-2" />
                  <SkeletonBar className="h-3 w-1/2" />
                </div>
                <SkeletonBar className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Generic list/card page skeleton */
export function ManagementPanelPageSkeleton({
  titleWidth = 'w-48',
  rows = 6,
}: { titleWidth?: string; rows?: number }) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <SkeletonBar className={cn('h-7 mb-2', titleWidth)} />
        <SkeletonBar className="h-4 w-64" />
      </div>
      <Card className="rounded-xl border shadow-sm overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex justify-end mb-4">
            <SkeletonBar className="h-9 w-24 rounded-lg" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-white">
                <SkeletonBar className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <SkeletonBar className="h-4 w-2/3 mb-2" />
                  <SkeletonBar className="h-3 w-1/2" />
                </div>
                <SkeletonBar className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Table-style skeleton (e.g. payment history) */
export function ManagementPanelTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <SkeletonBar className="h-7 w-44 mb-2" />
          <SkeletonBar className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <SkeletonBar className="h-9 w-24 rounded-lg" />
          <SkeletonBar className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <Card className="rounded-xl border shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-gray-50/30">
          <SkeletonBar className="h-5 w-36 mb-1" />
          <SkeletonBar className="h-4 w-48" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['a', 'b', 'c', 'd', 'e'].map((i) => (
                    <th key={i} className="pb-3 pl-4 pr-3 text-left">
                      <SkeletonBar className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 pl-4"><SkeletonBar className="h-4 w-40" /></td>
                    <td className="py-3"><SkeletonBar className="h-4 w-24" /></td>
                    <td className="py-3"><SkeletonBar className="h-4 w-24" /></td>
                    <td className="py-3"><SkeletonBar className="h-4 w-28" /></td>
                    <td className="py-3 pr-4"><SkeletonBar className="h-5 w-20 rounded-full" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Consistent error state with retry */
export function ManagementPanelErrorState({
  title,
  message,
  onRetry,
  className,
}: {
  title: string
  message: string
  onRetry: () => void
  className?: string
}) {
  return (
    <div className={cn('min-h-[40vh] flex items-center justify-center p-6 animate-in fade-in duration-300', className)}>
      <Card className="max-w-md w-full border-amber-200 bg-amber-50/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4 text-amber-800">
            <div className="rounded-full bg-amber-100 p-2.5 shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-amber-700 mt-1">{message}</p>
            </div>
          </div>
          <Button onClick={onRetry} className="w-full mt-5 gap-2" size="sm">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
