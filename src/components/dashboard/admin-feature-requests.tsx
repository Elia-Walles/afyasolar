"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sparkles,
  Search,
  Filter,
  Building2,
  Calendar,
  MessageSquare,
  Edit,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface FeatureRequest {
  id: string
  facilityId: string
  serviceName: string
  title: string
  description: string
  priority: string
  status: string
  adminNotes: string | null
  createdAt: Date | string
  updatedAt: Date | string
  facility?: {
    id: string
    name: string
    email: string
  }
}

const serviceDisplayNames: Record<string, string> = {
  "afya-solar": "Afya Solar",
}

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-300",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  high: "bg-red-100 text-red-700 border-red-300",
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  reviewing: "bg-blue-100 text-blue-700 border-blue-300",
  approved: "bg-green-100 text-green-700 border-green-300",
  in_progress: "bg-purple-100 text-purple-700 border-purple-300",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  rejected: "bg-red-100 text-red-700 border-red-300",
}

export function AdminFeatureRequests() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [serviceFilter, setServiceFilter] = useState<string>("all")
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [statusUpdate, setStatusUpdate] = useState<string>("")
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<{ requests: FeatureRequest[] }>({
    queryKey: ["feature-requests", statusFilter, serviceFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (serviceFilter !== "all") {
        params.append("serviceName", serviceFilter)
      }
      const response = await fetch(`/api/feature-requests?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch feature requests")
      }
      return response.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string
      status?: string
      adminNotes?: string
    }) => {
      const response = await fetch(`/api/feature-requests/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: data.status,
          adminNotes: data.adminNotes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update feature request")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] })
      toast.success("Feature request updated successfully")
      setSelectedRequest(null)
      setAdminNotes("")
      setStatusUpdate("")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update feature request")
    },
  })

  const requests = data?.requests || []
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      searchQuery === "" ||
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.facility?.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const handleUpdate = (requestId: string) => {
    if (!statusUpdate && !adminNotes.trim()) {
      toast.error("Please provide status update or admin notes")
      return
    }

    updateMutation.mutate({
      id: requestId,
      status: statusUpdate || undefined,
      adminNotes: adminNotes.trim() || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load feature requests</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-600" />
            Feature Requests
          </CardTitle>
          <CardDescription>
            Review and manage feature requests from facilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by title, description, or facility..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="afya-solar">Afya Solar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requests List */}
          {filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Card
                  key={request.id}
                  className={cn(
                    "border-l-4",
                    selectedRequest === request.id && "border-l-green-500"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-base text-gray-900 mb-1">
                              {request.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  priorityColors[request.priority] ||
                                    priorityColors.medium
                                )}
                              >
                                {request.priority.toUpperCase()} Priority
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  statusColors[request.status] ||
                                    statusColors.pending
                                )}
                              >
                                {request.status
                                  .replace("_", " ")
                                  .toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {serviceDisplayNames[request.serviceName] ||
                                  request.serviceName}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                          {request.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>
                              {request.facility?.name || "Unknown Facility"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {format(
                                new Date(request.createdAt),
                                "MMM d, yyyy 'at' h:mm a"
                              )}
                            </span>
                          </div>
                        </div>

                        {request.adminNotes && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-1">
                              Admin Notes:
                            </p>
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">
                              {request.adminNotes}
                            </p>
                          </div>
                        )}

                        {selectedRequest === request.id && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                Update Status
                              </label>
                              <Select
                                value={statusUpdate}
                                onValueChange={setStatusUpdate}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="reviewing">
                                    Reviewing
                                  </SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="in_progress">
                                    In Progress
                                  </SelectItem>
                                  <SelectItem value="completed">
                                    Completed
                                  </SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                Admin Notes
                              </label>
                              <Textarea
                                placeholder="Add notes about this feature request..."
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                                className="text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdate(request.id)}
                                disabled={updateMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {updateMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="mr-2 h-3 w-3" />
                                    Update
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRequest(null)
                                  setAdminNotes("")
                                  setStatusUpdate("")
                                }}
                                disabled={updateMutation.isPending}
                              >
                                <X className="mr-2 h-3 w-3" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedRequest !== request.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request.id)
                            setAdminNotes(request.adminNotes || "")
                            setStatusUpdate(request.status)
                          }}
                          className="flex-shrink-0"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Manage
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No feature requests found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
