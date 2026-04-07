"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  Package,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

interface ProposalItem {
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
}

interface Proposal {
  id: string
  requestId: string
  technicianId: string
  totalCost: string
  proposalNotes?: string
  status: string
  submittedAt: string
  items: ProposalItem[]
  technician?: {
    id: string
    firstName: string
    lastName: string
  }
  request?: {
    id: string
    requestNumber: string
    facility?: {
      id: string
      name: string
    }
  }
}

export function AdminProposalApproval() {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")

  const queryClient = useQueryClient()

  // Fetch proposals awaiting approval
  const { data: proposals = [], isLoading, refetch } = useQuery<Proposal[]>({
    queryKey: ['admin-maintenance-plan-proposals', 'submitted'],
    queryFn: async () => {
      const response = await fetch('/api/maintenance/plan-proposals?status=submitted')
      if (!response.ok) throw new Error('Failed to fetch proposals')
      const result = await response.json()
      return result.data || []
    },
    refetchInterval: 30000, // Refetch every 30 seconds to get new proposals
  })

  // Approve/Reject mutation
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
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-plan-proposals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-plan-requests'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-plan-requests'] })
      setShowDetailsDialog(false)
      setSelectedProposal(null)
      setRejectionReason("")
      refetch() // Refetch to update the list
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleReview = (action: 'approve' | 'reject') => {
    if (!selectedProposal) return
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    reviewProposalMutation.mutate({
      proposalId: selectedProposal.id,
      action,
      rejectionReason: action === 'reject' ? rejectionReason : undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Proposal Approvals</h2>
          <p className="text-muted-foreground">
            Review and approve maintenance plan proposals submitted by technicians
          </p>
        </div>
        {proposals.length > 0 && (
          <Badge className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1">
            {proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'} pending
          </Badge>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">Loading proposals...</div>
          </CardContent>
        </Card>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No proposals awaiting approval</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            Proposal for Request #{proposal.request?.requestNumber || 'N/A'}
                          </h3>
                          <Badge className="bg-indigo-100 text-indigo-800">Submitted</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Facility: {proposal.request?.facility?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Technician: {proposal.technician?.firstName} {proposal.technician?.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="ml-11">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Equipment Items: </span>
                        <span className="font-medium">{proposal.items.length}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Total Cost: </span>
                        <span className="font-bold text-primary">
                          {formatCurrency(Number(proposal.totalCost))}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted: {format(new Date(proposal.submittedAt), "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedProposal(proposal)
                        setShowDetailsDialog(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Proposal</DialogTitle>
            <DialogDescription>
              Review the maintenance plan proposal and approve or reject
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-6">
              {/* Proposal Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Request Number</Label>
                  <p className="font-medium">#{selectedProposal.request?.requestNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Facility</Label>
                  <p className="font-medium">{selectedProposal.request?.facility?.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Technician</Label>
                  <p className="font-medium">
                    {selectedProposal.technician?.firstName} {selectedProposal.technician?.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Cost</Label>
                  <p className="font-bold text-primary text-lg">
                    {formatCurrency(Number(selectedProposal.totalCost))}
                  </p>
                </div>
              </div>

              {/* Proposal Items */}
              <div className="space-y-4">
                <h4 className="font-semibold">Equipment Plans</h4>
                {selectedProposal.items.map((item, index) => (
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
                          <h6 className="font-semibold text-sm mb-2">Maintenance Plan Details</h6>
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
                        </div>
                        {item.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <p className="text-sm">{item.description}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedProposal.proposalNotes && (
                <div>
                  <Label>Technician Notes</Label>
                  <p className="text-sm p-3 bg-gray-50 rounded-md">{selectedProposal.proposalNotes}</p>
                </div>
              )}

              {/* Rejection Reason */}
              <div className="space-y-2">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejection..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleReview('reject')}
                  disabled={reviewProposalMutation.isPending || !rejectionReason.trim()}
                  className="text-red-600"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleReview('approve')}
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
                      Approve
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
