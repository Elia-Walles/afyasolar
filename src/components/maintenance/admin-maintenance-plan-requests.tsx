"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Wrench,
  Package,
  CheckCircle2,
  Clock,
  Eye,
  UserPlus,
  Loader2,
  Search,
  XCircle,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { StatusHistoryTimeline } from "@/components/maintenance/status-history-timeline"
import { useRouter } from "next/navigation"

interface MaintenancePlanRequest {
  id: string
  requestNumber: string
  facilityId: string
  status: string
  assignedTechnicianId: string | null
  assignedAt: Date | null
  createdAt: string
  equipmentIds: string[]
  facility?: {
    id: string
    name: string
  }
  technician?: {
    id: string
    firstName: string
    lastName: string
  }
}

interface Proposal {
  id: string
  requestId: string
  technicianId: string
  totalCost: string
  proposalNotes?: string
  status: string
  submittedAt: string
  items: Array<{
    id: string
    equipmentId: string
    maintenanceType: string
    scheduleType: string
    visitsPerYear?: number
    pricePerService?: string
    pricePerYear?: string
    totalCost: string
    durationMonths?: number
    includesParts: boolean
    includesEmergencySupport: boolean
    responseTimeHours?: number
    description?: string
    equipment?: {
      id: string
      name: string
      manufacturer?: string | null
      model?: string | null
      serialNumber?: string | null
      locationInFacility?: string | null
    } | null
  }>
  technician?: {
    id: string
    firstName: string
    lastName: string
  }
}

export function AdminMaintenancePlanRequests() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<MaintenancePlanRequest | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("")
  const [technicians, setTechnicians] = useState<Array<{ id: string; firstName: string; lastName: string }>>([])
  const [rejectionReason, setRejectionReason] = useState("")

  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-maintenance-plan-requests', statusFilter],
    queryFn: async () => {
      const url = statusFilter !== 'all' 
        ? `/api/maintenance/plan-requests?status=${statusFilter}`
        : '/api/maintenance/plan-requests'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch requests')
      const result = await response.json()
      return result.data || []
    },
  })

  // Fetch technicians
  useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      const response = await fetch('/api/technicians')
      if (!response.ok) return []
      const result = await response.json()
      setTechnicians(result.data || [])
      return result.data || []
    },
  })

  // Fetch proposal for selected request
  const { data: proposal, isLoading: proposalLoading } = useQuery<Proposal | null>({
    queryKey: ['maintenance-plan-proposal', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return null
      const response = await fetch(`/api/maintenance/plan-proposals?requestId=${selectedRequest.id}`)
      if (!response.ok) return null
      const result = await response.json()
      return result.data?.[0] || null
    },
    enabled: !!selectedRequest && showDetailsDialog,
  })

  // Assign technician mutation
  const assignTechnicianMutation = useMutation({
    mutationFn: async ({ requestId, technicianId }: { requestId: string; technicianId: string }) => {
      const response = await fetch(`/api/maintenance/plan-requests/${requestId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign technician')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Technician assigned successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-plan-requests'] })
      setShowAssignDialog(false)
      setSelectedRequest(null)
      setSelectedTechnicianId("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Approve/Reject proposal mutation
  const reviewProposalMutation = useMutation({
    mutationFn: async ({ proposalId, action, rejectionReason }: { 
      proposalId: string
      action: 'approve' | 'reject'
      rejectionReason?: string 
    }) => {
      const response = await fetch(`/api/maintenance/plan-proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to review proposal')
      }
      return response.json()
    },
    onSuccess: (_, variables) => {
      toast.success(`Proposal ${variables.action === 'approve' ? 'approved' : 'rejected'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-plan-requests'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-plan-proposal'] })
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-plan-proposals'] })
      setRejectionReason("")
      if (variables.action === 'approve') {
        setShowDetailsDialog(false)
        setSelectedRequest(null)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleReviewProposal = (action: 'approve' | 'reject') => {
    if (!proposal) return
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    reviewProposalMutation.mutate({
      proposalId: proposal.id,
      action,
      rejectionReason: action === 'reject' ? rejectionReason : undefined,
    })
  }

  const filteredRequests = requests.filter((req: MaintenancePlanRequest) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      req.requestNumber.toLowerCase().includes(query) ||
      req.facility?.name?.toLowerCase().includes(query) ||
      req.technician?.firstName?.toLowerCase().includes(query) ||
      req.technician?.lastName?.toLowerCase().includes(query)
    )
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending Assignment", className: "bg-yellow-100 text-yellow-800" },
      technician_assigned: { label: "Technician Assigned", className: "bg-blue-100 text-blue-800" },
      evaluation_in_progress: { label: "Evaluation In Progress", className: "bg-purple-100 text-purple-800" },
      proposal_submitted: { label: "Proposal Submitted", className: "bg-indigo-100 text-indigo-800" },
      admin_approved: { label: "Admin Approved", className: "bg-green-100 text-green-800" },
      facility_approved: { label: "Facility Approved", className: "bg-green-100 text-green-800" },
      facility_rejected: { label: "Facility Rejected", className: "bg-red-100 text-red-800" },
      payment_pending: { label: "Payment Pending", className: "bg-amber-100 text-amber-800" },
      payment_confirmed: { label: "Payment Confirmed", className: "bg-emerald-100 text-emerald-800" },
      active: { label: "Active", className: "bg-green-100 text-green-800" },
      cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800" },
    }

    const variant = variants[status] || variants.pending
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const handleAssignTechnician = () => {
    if (!selectedRequest || !selectedTechnicianId) return
    assignTechnicianMutation.mutate({
      requestId: selectedRequest.id,
      technicianId: selectedTechnicianId,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Maintenance Plan Requests</h2>
          <p className="text-muted-foreground">
            Manage facility maintenance plan requests and assign technicians
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by request number, facility, or technician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="technician_assigned">Technician Assigned</SelectItem>
                <SelectItem value="evaluation_in_progress">Evaluation In Progress</SelectItem>
                <SelectItem value="proposal_submitted">Proposal Submitted</SelectItem>
                <SelectItem value="admin_approved">Admin Approved</SelectItem>
                <SelectItem value="facility_approved">Facility Approved</SelectItem>
                <SelectItem value="payment_pending">Payment Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No maintenance plan requests found
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request: MaintenancePlanRequest) => (
            <Card
              key={request.id}
              className={cn(
                "hover:shadow-md transition-shadow",
                request.status === "pending" && "border-yellow-300 border-2"
              )}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              Request #{request.requestNumber}
                            </h3>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Facility: {request.facility?.name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.createdAt), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Equipment:</span>
                        <span className="font-medium">{request.equipmentIds.length} item(s)</span>
                      </div>
                      {request.technician && (
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Technician:</span>
                          <span className="font-medium">
                            {request.technician.firstName} {request.technician.lastName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request)
                        setShowDetailsDialog(true)
                      }}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    {request.status === "proposal_submitted" && (
                      <Button
                        variant="default"
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowDetailsDialog(true)
                        }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        View Proposal
                      </Button>
                    )}
                    {request.status === "pending" && (
                      <Button
                        onClick={() => {
                          setSelectedRequest(request)
                          setSelectedTechnicianId(request.assignedTechnicianId || "")
                          setShowAssignDialog(true)
                        }}
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Assign Technician
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Technician Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
            <DialogDescription>
              Assign a technician to evaluate this maintenance plan request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <Label>Request</Label>
                <p className="text-sm font-medium">#{selectedRequest.requestNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedRequest.equipmentIds.length} equipment item(s)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Select Technician *</Label>
                <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.firstName} {tech.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false)
                setSelectedRequest(null)
                setSelectedTechnicianId("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignTechnician}
              disabled={!selectedTechnicianId || assignTechnicianMutation.isPending}
            >
              {assignTechnicianMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              View maintenance plan request details and proposal
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Request Number</Label>
                  <p className="font-medium">#{selectedRequest.requestNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Facility</Label>
                  <p className="font-medium">{selectedRequest.facility?.name || 'Unknown'}</p>
                </div>
                {selectedRequest.technician && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Assigned Technician</Label>
                    <p className="font-medium">
                      {selectedRequest.technician.firstName} {selectedRequest.technician.lastName}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Equipment Count</Label>
                  <p className="font-medium">{selectedRequest.equipmentIds.length} item(s)</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="font-medium">{format(new Date(selectedRequest.createdAt), "MMM dd, yyyy HH:mm")}</p>
                </div>
              </div>

              {/* Proposal Section */}
              {proposalLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading proposal...</p>
                </div>
              ) : proposal ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Proposal Details</h3>
                    <Badge className={cn(
                      proposal.status === 'submitted' && "bg-indigo-100 text-indigo-800",
                      proposal.status === 'admin_approved' && "bg-green-100 text-green-800",
                      proposal.status === 'admin_rejected' && "bg-red-100 text-red-800"
                    )}>
                      {proposal.status === 'submitted' && 'Submitted'}
                      {proposal.status === 'admin_approved' && 'Approved'}
                      {proposal.status === 'admin_rejected' && 'Rejected'}
                    </Badge>
                  </div>

                  <div className="p-4 bg-primary/5 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Cost</Label>
                        <p className="font-bold text-primary text-xl">
                          {formatCurrency(Number(proposal.totalCost))}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Submitted</Label>
                        <p className="font-medium">
                          {format(new Date(proposal.submittedAt), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Proposal Items */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Equipment Plans</h4>
                    {proposal.items.map((item, index) => (
                      <Card key={item.id || index}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div>
                              <h5 className="font-medium text-lg">{item.equipment?.name || 'Equipment'}</h5>
                              <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                {item.equipment?.manufacturer && (
                                  <p><span className="font-medium">Brand:</span> {item.equipment.manufacturer}</p>
                                )}
                                {item.equipment?.model && (
                                  <p><span className="font-medium">Model:</span> {item.equipment.model}</p>
                                )}
                                {item.equipment?.serialNumber && (
                                  <p><span className="font-medium">Serial Number:</span> {item.equipment.serialNumber}</p>
                                )}
                                {item.equipment?.locationInFacility && (
                                  <p><span className="font-medium">Location:</span> {item.equipment.locationInFacility}</p>
                                )}
                              </div>
                            </div>
                            <div className="border-t pt-3 mt-3">
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Type: </span>
                                  <span className="font-medium capitalize">{item.maintenanceType}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Schedule: </span>
                                  <span className="font-medium capitalize">{item.scheduleType.replace('_', ' ')}</span>
                                </div>
                                {item.visitsPerYear && (
                                  <div>
                                    <span className="text-muted-foreground">Visits/Year: </span>
                                    <span className="font-medium">{item.visitsPerYear}</span>
                                  </div>
                                )}
                                {item.durationMonths && (
                                  <div>
                                    <span className="text-muted-foreground">Duration: </span>
                                    <span className="font-medium">{item.durationMonths} months</span>
                                  </div>
                                )}
                                {item.pricePerYear && (
                                  <div>
                                    <span className="text-muted-foreground">Price/Year: </span>
                                    <span className="font-medium">{formatCurrency(Number(item.pricePerYear))}</span>
                                  </div>
                                )}
                                {item.pricePerService && (
                                  <div>
                                    <span className="text-muted-foreground">Price/Service: </span>
                                    <span className="font-medium">{formatCurrency(Number(item.pricePerService))}</span>
                                  </div>
                                )}
                                {item.responseTimeHours && (
                                  <div>
                                    <span className="text-muted-foreground">Response Time: </span>
                                    <span className="font-medium">{item.responseTimeHours} hours</span>
                                  </div>
                                )}
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Total Cost: </span>
                                  <span className="font-bold text-primary text-lg">
                                    {formatCurrency(Number(item.totalCost))}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {item.includesParts && (
                                  <Badge variant="outline" className="text-xs">Includes Parts</Badge>
                                )}
                                {item.includesEmergencySupport && (
                                  <Badge variant="outline" className="text-xs">Emergency Support</Badge>
                                )}
                              </div>
                              {item.description && (
                                <div className="mt-3">
                                  <Label className="text-xs text-muted-foreground">Description</Label>
                                  <p className="text-sm mt-1">{item.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {proposal.proposalNotes && (
                    <div>
                      <Label>Technician Notes</Label>
                      <p className="text-sm p-3 bg-gray-50 rounded-md mt-1">{proposal.proposalNotes}</p>
                    </div>
                  )}

                  {proposal.status === 'submitted' && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>Rejection Reason (if rejecting)</Label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Provide reason for rejection..."
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 text-red-600"
                          onClick={() => handleReviewProposal('reject')}
                          disabled={reviewProposalMutation.isPending || !rejectionReason.trim()}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject Proposal
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => handleReviewProposal('approve')}
                          disabled={reviewProposalMutation.isPending}
                        >
                          {reviewProposalMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve Proposal
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedRequest.status === 'proposal_submitted' ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-muted-foreground">Proposal not found</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {selectedRequest.status === 'pending' 
                      ? 'Waiting for technician assignment'
                      : selectedRequest.status === 'technician_assigned' || selectedRequest.status === 'evaluation_in_progress'
                      ? 'Technician is evaluating the request'
                      : 'No proposal submitted yet'}
                  </p>
                </div>
              )}

              {/* Status History Timeline */}
              <StatusHistoryTimeline requestId={selectedRequest.id} />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDetailsDialog(false)
                setSelectedRequest(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
