"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Clock, User, FileText } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getStatusDescription } from "@/lib/maintenance-plan/status-validation"

interface StatusHistoryEntry {
  id: string
  entityType: 'request' | 'proposal' | 'payment'
  previousStatus: string | null
  newStatus: string
  changedBy: string
  changedByRole: 'admin' | 'facility' | 'technician'
  changedByName: string | null
  reason: string | null
  metadata: Record<string, any> | null // Already parsed by API
  createdAt: string
}

interface StatusHistoryTimelineProps {
  requestId: string
  className?: string
}

export function StatusHistoryTimeline({ requestId, className }: StatusHistoryTimelineProps) {
  const { data: history = [], isLoading } = useQuery<StatusHistoryEntry[]>({
    queryKey: ['maintenance-plan-history', requestId],
    queryFn: async () => {
      const response = await fetch(`/api/maintenance/plan-requests/${requestId}/history`)
      if (!response.ok) throw new Error('Failed to fetch history')
      const result = await response.json()
      return result.data || []
    },
  })

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800'
      case 'facility':
        return 'bg-blue-100 text-blue-800'
      case 'technician':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    if (status.includes('approved') || status === 'active' || status === 'confirmed') {
      return 'text-green-600'
    }
    if (status.includes('rejected') || status === 'cancelled' || status === 'failed') {
      return 'text-red-600'
    }
    if (status.includes('pending') || status.includes('submitted')) {
      return 'text-yellow-600'
    }
    return 'text-gray-600'
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Loading history...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No status history available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => {
            const metadata = entry.metadata // Already parsed by API
            const isLast = index === history.length - 1

            return (
              <div key={entry.id} className="relative flex gap-4">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" />
                )}

                {/* Icon */}
                <div className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white",
                  entry.entityType === 'request' && "border-blue-500",
                  entry.entityType === 'proposal' && "border-green-500",
                  entry.entityType === 'payment' && "border-purple-500"
                )}>
                  {entry.entityType === 'request' && <FileText className="h-4 w-4 text-blue-500" />}
                  {entry.entityType === 'proposal' && <FileText className="h-4 w-4 text-green-500" />}
                  {entry.entityType === 'payment' && <FileText className="h-4 w-4 text-purple-500" />}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("font-medium capitalize", getStatusColor(entry.newStatus))}>
                          {entry.newStatus.replace(/_/g, ' ')}
                        </span>
                        {entry.previousStatus && (
                          <>
                            <span className="text-muted-foreground">←</span>
                            <span className="text-sm text-muted-foreground capitalize">
                              {entry.previousStatus.replace(/_/g, ' ')}
                            </span>
                          </>
                        )}
                        <Badge className={cn("text-xs", getRoleBadgeColor(entry.changedByRole))}>
                          {entry.changedByRole}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {entry.entityType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getStatusDescription(entry.entityType, entry.newStatus)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "MMM dd, yyyy")}
                      <br />
                      {format(new Date(entry.createdAt), "HH:mm")}
                    </div>
                  </div>

                  {/* Changed by */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Changed by: <span className="font-medium">{entry.changedByName || 'Unknown'}</span>
                    </span>
                  </div>

                  {/* Reason */}
                  {entry.reason && (
                    <div className="text-sm text-muted-foreground bg-gray-50 p-2 rounded-md">
                      <span className="font-medium">Reason: </span>
                      {entry.reason}
                    </div>
                  )}

                  {/* Metadata */}
                  {metadata && Object.keys(metadata).length > 0 && (
                    <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded-md">
                      <details>
                        <summary className="cursor-pointer font-medium">Details</summary>
                        <pre className="mt-2 text-xs overflow-x-auto">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
