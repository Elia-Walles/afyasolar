"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Gift,
  Search,
  Filter,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Referral {
  id: string
  referrerFacilityId: string
  referredFacilityId: string
  referralCode: string
  status: string
  benefitApproved: boolean
  benefitApprovedBy: string | null
  benefitApprovedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  referrer?: {
    id: string
    name: string
    email: string
  }
  referred?: {
    id: string
    name: string
    email: string
  }
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  registered: "bg-blue-100 text-blue-700 border-blue-300",
  benefit_applied: "bg-green-100 text-green-700 border-green-300",
  expired: "bg-gray-100 text-gray-700 border-gray-300",
}

export function AdminReferrals() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<{ referrals: Referral[] }>({
    queryKey: ["admin-referrals", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      const response = await fetch(`/api/admin/referrals?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch referrals")
      }
      return response.json()
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (referralId: string) => {
      const response = await fetch(`/api/admin/referrals/${referralId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to approve referral benefit")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-referrals"] })
      toast.success("Referral benefit approved successfully")
      setApproveDialogOpen(false)
      setSelectedReferral(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to approve referral benefit")
    },
  })

  const referrals = data?.referrals || []
  const filteredReferrals = referrals.filter((ref) => {
    const matchesSearch =
      searchQuery === "" ||
      ref.referralCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referrer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referred?.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const handleApprove = (referral: Referral) => {
    setSelectedReferral(referral)
    setApproveDialogOpen(true)
  }

  const confirmApprove = () => {
    if (selectedReferral) {
      approveMutation.mutate(selectedReferral.id)
    }
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
            <p className="text-red-600">Failed to load referrals</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === "pending").length,
    registered: referrals.filter((r) => r.status === "registered").length,
    approved: referrals.filter((r) => r.benefitApproved).length,
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600" />
            Referral Program Management
          </CardTitle>
          <CardDescription>
            Manage facility referrals and approve benefits for referred facilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total Referrals</p>
              <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Registered</p>
              <p className="text-2xl font-bold text-green-900">{stats.registered}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-600 font-medium">Approved</p>
              <p className="text-2xl font-bold text-emerald-900">{stats.approved}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by referral code, referrer, or referred facility..."
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
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="benefit_applied">Benefit Applied</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Referrals List */}
          {filteredReferrals.length > 0 ? (
            <div className="space-y-4">
              {filteredReferrals.map((referral) => (
                <Card
                  key={referral.id}
                  className={cn(
                    "border-l-4",
                    referral.benefitApproved
                      ? "border-l-green-500"
                      : referral.status === "registered"
                      ? "border-l-blue-500"
                      : "border-l-yellow-500"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-mono",
                                  "bg-gray-100 text-gray-700 border-gray-300"
                                )}
                              >
                                Code: {referral.referralCode}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  statusColors[referral.status] || statusColors.pending
                                )}
                              >
                                {referral.status.replace("_", " ").toUpperCase()}
                              </Badge>
                              {referral.benefitApproved && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-100 text-green-700 border-green-300"
                                >
                                  Benefit Approved
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-500">Referrer Facility</p>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <p className="text-sm font-medium text-gray-900">
                                {referral.referrer?.name || "Unknown"}
                              </p>
                            </div>
                            {referral.referrer?.email && (
                              <p className="text-xs text-gray-600 ml-6">
                                {referral.referrer.email}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-gray-500">Referred Facility</p>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <p className="text-sm font-medium text-gray-900">
                                {referral.referred?.name || "Not yet registered"}
                              </p>
                            </div>
                            {referral.referred?.email && (
                              <p className="text-xs text-gray-600 ml-6">
                                {referral.referred.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              Referred: {format(new Date(referral.createdAt), "MMM d, yyyy")}
                            </span>
                          </div>
                          {referral.benefitApprovedAt && (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              <span>
                                Approved: {format(new Date(referral.benefitApprovedAt), "MMM d, yyyy")}
                              </span>
                            </div>
                          )}
                        </div>

                        {referral.status === "registered" && !referral.benefitApproved && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs font-semibold text-yellow-800 mb-1">
                              Benefit Available
                            </p>
                            <p className="text-xs text-yellow-700">
                              This facility registered via referral. Approve to grant them free Afya
                              Booking for the next month.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {referral.status === "registered" && !referral.benefitApproved && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(referral)}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve Benefit
                          </Button>
                        )}
                        {referral.benefitApproved && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-100 text-green-700 border-green-300 w-full justify-center"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Benefit Approved
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No referrals found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Referral Benefit</DialogTitle>
            <DialogDescription>
              Approve the referral benefit for this facility. They will receive free Afya Booking
              for the next month.
            </DialogDescription>
          </DialogHeader>
          {selectedReferral && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <p className="text-sm font-semibold">Referrer Facility:</p>
                <p className="text-sm text-gray-700">{selectedReferral.referrer?.name}</p>
                <p className="text-sm font-semibold mt-2">Referred Facility:</p>
                <p className="text-sm text-gray-700">{selectedReferral.referred?.name}</p>
                <p className="text-sm font-semibold mt-2">Referral Code:</p>
                <p className="text-sm font-mono text-gray-700">{selectedReferral.referralCode}</p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Benefit:</strong> Free Afya Booking access for the next month (upon
                  approval)
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Benefit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
