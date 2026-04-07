"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Wrench,
  Package,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Eye,
  XCircle,
  DollarSign,
} from "lucide-react"
import { useEquipment } from "@/hooks/use-equipment"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import { MaintenancePaymentDialog } from "@/components/maintenance/maintenance-payment-dialog"

interface MaintenancePlanRequest {
  id: string
  requestNumber: string
  status: string
  createdAt: string
  equipmentIds: string[]
}

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
  }
}

export function FacilityMaintenancePlanRequest() {
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set())
  const [equipmentLastMaintenanceDates, setEquipmentLastMaintenanceDates] = useState<Record<string, string>>({})
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false)
  const equipmentDropdownRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState("")
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaintenancePlanRequest | null>(null)
  const [showProposalDialog, setShowProposalDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null)
  const [paymentType, setPaymentType] = useState<'half' | 'full'>('full')

  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment()
  const queryClient = useQueryClient()

  // Fetch maintenance plan requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery<MaintenancePlanRequest[]>({
    queryKey: ['maintenance-plan-requests'],
    queryFn: async () => {
      const response = await fetch('/api/maintenance/plan-requests')
      if (!response.ok) throw new Error('Failed to fetch requests')
      const result = await response.json()
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
    enabled: !!selectedRequest && showProposalDialog,
  })

  // Create request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: { equipmentIds: string[]; notes?: string; equipmentLastMaintenanceDates?: Record<string, string> }) => {
      const response = await fetch('/api/maintenance/plan-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create request')
      }
      return response.json()
    },
      onSuccess: () => {
      toast.success('Maintenance plan request submitted successfully')
      queryClient.invalidateQueries({ queryKey: ['maintenance-plan-requests'] })
      setSelectedEquipmentIds(new Set())
      setEquipmentLastMaintenanceDates({})
      setNotes("")
      setShowRequestForm(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Review proposal mutation
  const reviewProposalMutation = useMutation({
    mutationFn: async ({ proposalId, action, rejectionReason }: { 
      proposalId: string
      action: 'approve' | 'reject'
      rejectionReason?: string 
    }) => {
      const response = await fetch(`/api/maintenance/plan-proposals/${proposalId}/facility-review`, {
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
      queryClient.invalidateQueries({ queryKey: ['maintenance-plan-requests'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-plan-proposal'] })
      queryClient.invalidateQueries({ queryKey: ['facility-maintenance-plan-proposals'] })
      setRejectionReason("")
      setProcessingAction(null)
      // Don't close dialog if approved - show payment button instead
      if (variables.action === 'reject') {
        setShowProposalDialog(false)
        setSelectedRequest(null)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
      setProcessingAction(null)
    },
  })

  const handleReviewProposal = (action: 'approve' | 'reject') => {
    if (!proposal) return
    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setProcessingAction(action)
    reviewProposalMutation.mutate({
      proposalId: proposal.id,
      action,
      rejectionReason: action === 'reject' ? rejectionReason : undefined,
    })
  }

  const getPaymentAmount = () => {
    if (!proposal) return 0
    const total = Number(proposal.totalCost)
    if (paymentType === 'half') {
      return total / 2
    }
    return total
  }

  // Toggle equipment selection
  const toggleEquipment = (equipmentId: string) => {
    setSelectedEquipmentIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(equipmentId)) {
        newSet.delete(equipmentId)
        // Remove last maintenance date when equipment is deselected
        setEquipmentLastMaintenanceDates(prevDates => {
          const newDates = { ...prevDates }
          delete newDates[equipmentId]
          return newDates
        })
      } else {
        newSet.add(equipmentId)
      }
      return newSet
    })
  }

  // Update last maintenance date for equipment
  const updateLastMaintenanceDate = (equipmentId: string, date: string) => {
    setEquipmentLastMaintenanceDates(prev => ({
      ...prev,
      [equipmentId]: date,
    }))
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (equipmentDropdownRef.current && !equipmentDropdownRef.current.contains(event.target as Node)) {
        setEquipmentDropdownOpen(false)
      }
    }

    if (equipmentDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [equipmentDropdownOpen])

  const selectedEquipment = Array.from(selectedEquipmentIds)
    .map(id => equipment.find(eq => eq.id === id))
    .filter(Boolean)

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
      technician_assigned: { label: "Technician Assigned", className: "bg-blue-100 text-blue-800" },
      evaluation_in_progress: { label: "Evaluation In Progress", className: "bg-purple-100 text-purple-800" },
      proposal_submitted: { label: "Proposal Submitted", className: "bg-indigo-100 text-indigo-800" },
      admin_approved: { label: "Admin Approved", className: "bg-green-100 text-green-800" },
      facility_approved: { label: "Approved", className: "bg-green-100 text-green-800" },
      facility_rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
      payment_pending: { label: "Payment Pending", className: "bg-amber-100 text-amber-800" },
      payment_confirmed: { label: "Payment Confirmed", className: "bg-emerald-100 text-emerald-800" },
      active: { label: "Active", className: "bg-green-100 text-green-800" },
      cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800" },
    }

    const variant = variants[status] || variants.pending
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const handleSubmit = () => {
    if (selectedEquipmentIds.size === 0) {
      toast.error('Please select at least one equipment')
      return
    }

    createRequestMutation.mutate({
      equipmentIds: Array.from(selectedEquipmentIds),
      notes: notes || undefined,
      equipmentLastMaintenanceDates: equipmentLastMaintenanceDates,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Maintenance Plan Requests</h2>
          <p className="text-muted-foreground">
            Request custom maintenance plans for your equipment
          </p>
        </div>
        <Button onClick={() => setShowRequestForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Request Form */}
      {showRequestForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Maintenance Plan Request</CardTitle>
            <CardDescription>
              Select equipment that needs maintenance plans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Equipment Selection */}
            <div className="space-y-2">
              <Label>Select Equipment *</Label>
              <div className="relative" ref={equipmentDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setEquipmentDropdownOpen(!equipmentDropdownOpen)}
                >
                  <span>
                    {selectedEquipmentIds.size === 0
                      ? "Select equipment..."
                      : `${selectedEquipmentIds.size} equipment selected`}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 ml-2 transition-transform",
                      equipmentDropdownOpen && "rotate-180"
                    )}
                  />
                </Button>

                {equipmentDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-96 overflow-y-auto">
                    {equipmentLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Loading equipment...
                      </div>
                    ) : equipment.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No equipment found
                      </div>
                    ) : (
                      <div className="p-2">
                        {equipment.map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => toggleEquipment(eq.id)}
                            className={cn(
                              "w-full text-left p-3 rounded-md hover:bg-gray-50 transition-colors mb-2 border",
                              selectedEquipmentIds.has(eq.id) && "bg-green-50 border-green-200"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Checkbox
                                    checked={selectedEquipmentIds.has(eq.id)}
                                    onCheckedChange={() => toggleEquipment(eq.id)}
                                    className="mt-0.5"
                                  />
                                  <span className="font-semibold">{eq.name}</span>
                                </div>
                                <div className="ml-6 text-xs text-gray-600 space-y-0.5">
                                  {eq.manufacturer && (
                                    <div><span className="font-medium">Brand:</span> {eq.manufacturer}</div>
                                  )}
                                  {eq.model && (
                                    <div><span className="font-medium">Model:</span> {eq.model}</div>
                                  )}
                                  {eq.serialNumber && (
                                    <div><span className="font-medium">Serial:</span> {eq.serialNumber}</div>
                                  )}
                                  {eq.locationInFacility && (
                                    <div><span className="font-medium">Location:</span> {eq.locationInFacility}</div>
                                  )}
                                  {eq.purchaseDate && (
                                    <div><span className="font-medium">Purchase Date:</span> {new Date(eq.purchaseDate).toLocaleDateString()}</div>
                                  )}
                                </div>
                              </div>
                              {selectedEquipmentIds.has(eq.id) && (
                                <Check className="h-5 w-5 text-green-600 ml-2" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Equipment List */}
            {selectedEquipment.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Equipment ({selectedEquipment.length})</Label>
                <div className="space-y-4">
                  {selectedEquipment.map((eq) => (
                    <div
                      key={eq!.id}
                      className="p-4 bg-gray-50 rounded-md border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{eq!.name}</div>
                          <div className="text-sm text-gray-600">
                            {eq!.manufacturer} {eq!.model && `- ${eq!.model}`}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEquipment(eq!.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`last-maintenance-${eq!.id}`} className="text-sm">
                          Last Maintenance Date <span className="text-gray-500">(Optional)</span>
                        </Label>
                        <Input
                          id={`last-maintenance-${eq!.id}`}
                          type="date"
                          value={equipmentLastMaintenanceDates[eq!.id] || ""}
                          onChange={(e) => updateLastMaintenanceDate(eq!.id, e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requirements or notes..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createRequestMutation.isPending || selectedEquipmentIds.size === 0}
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRequestForm(false)
                  setSelectedEquipmentIds(new Set())
                  setEquipmentLastMaintenanceDates({})
                  setNotes("")
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>My Requests</CardTitle>
          <CardDescription>View status of your maintenance plan requests</CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No maintenance plan requests yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request: MaintenancePlanRequest) => (
                <Card key={request.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">Request #{request.requestNumber}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Equipment: {request.equipmentIds.length} item(s)</p>
                          <p>Created: {new Date(request.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {(request.status === "admin_approved" || request.status === "proposal_submitted") && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowProposalDialog(true)
                            }}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Proposal
                          </Button>
                        )}
                        {(request.status === "payment_pending" || request.status === "facility_approved") && (
                          <Button
                            onClick={async () => {
                              setSelectedRequest(request)
                              // First open proposal dialog to load proposal, then payment will be available
                              setShowProposalDialog(true)
                            }}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                          >
                            <DollarSign className="h-4 w-4" />
                            Make Payment
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proposal Details Dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposal Details</DialogTitle>
            <DialogDescription>
              View the maintenance plan proposal for this request
            </DialogDescription>
          </DialogHeader>

          {proposalLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading proposal...</p>
            </div>
          ) : proposal ? (
            <div className="space-y-6">
              {/* Proposal Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Request Number</Label>
                  <p className="font-medium">#{proposal.request?.requestNumber || selectedRequest?.requestNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Technician</Label>
                  <p className="font-medium">
                    {proposal.technician?.firstName} {proposal.technician?.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Submitted</Label>
                  <p className="font-medium">
                    {format(new Date(proposal.submittedAt), "MMM dd, yyyy HH:mm")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Equipment Items</Label>
                  <p className="font-medium">{proposal.items.length} item(s)</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Total Cost</Label>
                  <p className="font-bold text-primary text-2xl">
                    {formatCurrency(Number(proposal.totalCost))}
                  </p>
                </div>
              </div>

              {/* Proposal Items */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Equipment Plans</h4>
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

              {/* Review Actions for Admin Approved Proposals */}
              {proposal.status === 'admin_approved' && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Rejection Reason (if rejecting)</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide reason for rejection..."
                      rows={3}
                      disabled={processingAction !== null}
                    />
                  </div>
                </div>
              )}

              {/* Payment Section for Facility Approved or Payment Pending Proposals */}
              {(proposal.status === 'facility_approved' || proposal.status === 'payment_pending' || selectedRequest?.status === 'payment_pending' || selectedRequest?.status === 'facility_approved') && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                  <div>
                    <p className="text-sm font-medium text-green-800 mb-1">
                      {proposal.status === 'payment_pending' || selectedRequest?.status === 'payment_pending' 
                        ? 'Payment Required' 
                        : 'Proposal Approved - Payment Required'}
                    </p>
                    <p className="text-xs text-green-700">
                      Total Amount: <span className="font-bold">{formatCurrency(Number(proposal.totalCost))}</span>
                    </p>
                  </div>
                  
                  {/* Payment Type Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-green-800">Select Payment Option:</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={paymentType === 'half' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentType('half')}
                        className={paymentType === 'half' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        Half ({formatCurrency(Number(proposal.totalCost) / 2)})
                      </Button>
                      <Button
                        type="button"
                        variant={paymentType === 'full' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentType('full')}
                        className={paymentType === 'full' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        Full ({formatCurrency(Number(proposal.totalCost))})
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setShowPaymentDialog(true)
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pay {paymentType === 'half' ? formatCurrency(Number(proposal.totalCost) / 2) : formatCurrency(Number(proposal.totalCost))}
                  </Button>
                </div>
              )}
            </div>
          ) : selectedRequest ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">
                {selectedRequest.status === 'admin_approved' || selectedRequest.status === 'proposal_submitted'
                  ? 'Proposal not found'
                  : 'No proposal available yet'}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            {proposal?.status === 'admin_approved' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProposalDialog(false)
                    setSelectedRequest(null)
                    setRejectionReason("")
                    setProcessingAction(null)
                  }}
                  disabled={processingAction !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReviewProposal('reject')}
                  disabled={processingAction !== null || !rejectionReason.trim()}
                  className="text-red-600"
                >
                  {processingAction === 'reject' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleReviewProposal('approve')}
                  disabled={processingAction !== null}
                >
                  {processingAction === 'approve' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve & Proceed to Payment
                    </>
                  )}
                </Button>
              </>
            ) : (proposal?.status === 'facility_approved' || proposal?.status === 'payment_pending' || selectedRequest?.status === 'payment_pending' || selectedRequest?.status === 'facility_approved') ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProposalDialog(false)
                    setSelectedRequest(null)
                    setRejectionReason("")
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowPaymentDialog(true)
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Make Payment
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setShowProposalDialog(false)
                  setSelectedRequest(null)
                  setRejectionReason("")
                }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {proposal && (
        <MaintenancePaymentDialog
          open={showPaymentDialog}
          onOpenChange={(open) => {
            setShowPaymentDialog(open)
            if (!open) {
              setPaymentType('full')
            }
          }}
          amount={getPaymentAmount()}
          paymentType="maintenance_plan"
          proposalId={proposal.id}
          title="Make Payment"
          description={`Payment for maintenance plan. ${paymentType === 'half' ? 'Half payment (50%)' : 'Full payment (100%)'}`}
          onPaymentComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['maintenance-plan-payments'] })
            queryClient.invalidateQueries({ queryKey: ['maintenance-plan-requests'] })
            queryClient.invalidateQueries({ queryKey: ['maintenance-plan-proposal'] })
            setShowPaymentDialog(false)
            setShowProposalDialog(false)
            setSelectedRequest(null)
            setPaymentType('full')
          }}
        />
      )}
    </div>
  )
}
