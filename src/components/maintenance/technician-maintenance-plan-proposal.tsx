"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  Calculator,
  X,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"

interface ProposalItem {
  equipmentId: string
  maintenanceType: 'preventive' | 'corrective' | 'inspection' | 'calibration' | 'full_service'
  scheduleType: 'per_year' | 'per_service' | 'monthly' | 'quarterly' | 'custom'
  visitsPerYear?: number
  pricePerService?: number
  pricePerYear?: number
  totalCost: number
  durationMonths?: number
  startDate?: string
  endDate?: string
  includesParts: boolean
  includesEmergencySupport: boolean
  responseTimeHours?: number
  description?: string
  notes?: string
}

interface MaintenancePlanRequest {
  id: string
  requestNumber: string
  facilityId: string
  status: string
  equipmentIds: string[]
  facility?: {
    id: string
    name: string
  }
  equipment?: Array<{
    id: string
    name: string
    manufacturer?: string
    model?: string
    serialNumber?: string
  }>
}

export function TechnicianMaintenancePlanProposal() {
  const [selectedRequest, setSelectedRequest] = useState<MaintenancePlanRequest | null>(null)
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([])
  const [proposalNotes, setProposalNotes] = useState("")

  const queryClient = useQueryClient()

  // Fetch proposals to check which requests already have proposals
  const { data: existingProposals = [] } = useQuery({
    queryKey: ['technician-proposals'],
    queryFn: async () => {
      const response = await fetch('/api/maintenance/plan-proposals')
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })

  // Create a set of request IDs that already have proposals
  const requestsWithProposals = useMemo(() => {
    return new Set(existingProposals.map((p: any) => p.requestId))
  }, [existingProposals])

  // Fetch assigned requests (technicians see all requests assigned to them, regardless of status)
  const { data: requests = [], isLoading } = useQuery<MaintenancePlanRequest[]>({
    queryKey: ['technician-maintenance-plan-requests'],
    queryFn: async () => {
      // Don't filter by status - let the API filter by assigned technician ID
      const response = await fetch('/api/maintenance/plan-requests')
      if (!response.ok) throw new Error('Failed to fetch requests')
      const result = await response.json()
      // Filter to show only requests that are assigned and don't have proposals yet
      return (result.data || []).filter((req: MaintenancePlanRequest) => 
        ['technician_assigned', 'evaluation_in_progress'].includes(req.status) &&
        !requestsWithProposals.has(req.id)
      )
    },
  })

  // Fetch equipment details for selected request
  const { data: equipment = [], isLoading: equipmentLoading } = useQuery({
    queryKey: ['maintenance-plan-request-equipment', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return []
      const response = await fetch(`/api/maintenance/plan-requests/${selectedRequest.id}/equipment`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch equipment' }))
        throw new Error(error.error || 'Failed to fetch equipment')
      }
      const result = await response.json()
      return result.data || []
    },
    enabled: !!selectedRequest && !!selectedRequest.id,
  })

  // Initialize proposal items when request is selected
  useEffect(() => {
    if (selectedRequest && equipment.length > 0) {
      const items: ProposalItem[] = equipment.map((eq: any) => ({
        equipmentId: eq.id,
        maintenanceType: 'preventive',
        scheduleType: 'per_year',
        visitsPerYear: 4,
        pricePerYear: 0,
        totalCost: 0,
        durationMonths: 12,
        includesParts: false,
        includesEmergencySupport: false,
      }))
      setProposalItems(items)
    } else if (!selectedRequest) {
      // Clear proposal items when no request is selected
      setProposalItems([])
    }
  }, [selectedRequest, equipment])

  // Calculate total cost
  const totalCost = useMemo(() => {
    return proposalItems.reduce((sum, item) => sum + (item.totalCost || 0), 0)
  }, [proposalItems])

  // Update proposal item
  const updateProposalItem = (index: number, updates: Partial<ProposalItem>) => {
    setProposalItems(prev => {
      const newItems = [...prev]
      const item = { ...newItems[index], ...updates }
      
      // Recalculate total cost based on schedule type
      if (item.scheduleType === 'per_year' && item.pricePerYear) {
        item.totalCost = item.pricePerYear * (item.durationMonths || 12) / 12
      } else if (item.scheduleType === 'per_service' && item.pricePerService && item.visitsPerYear) {
        item.totalCost = item.pricePerService * item.visitsPerYear * ((item.durationMonths || 12) / 12)
      } else if (item.scheduleType === 'monthly' && item.pricePerYear) {
        item.totalCost = item.pricePerYear * ((item.durationMonths || 12) / 12)
      } else if (item.scheduleType === 'quarterly' && item.pricePerYear) {
        item.totalCost = item.pricePerYear * ((item.durationMonths || 12) / 12) / 4
      }
      
      newItems[index] = item
      return newItems
    })
  }

  // Submit proposal mutation
  const submitProposalMutation = useMutation({
    mutationFn: async (data: { requestId: string; items: ProposalItem[]; proposalNotes?: string }) => {
      const response = await fetch('/api/maintenance/plan-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit proposal')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Proposal submitted successfully')
      queryClient.invalidateQueries({ queryKey: ['technician-maintenance-plan-requests'] })
      queryClient.invalidateQueries({ queryKey: ['technician-proposals'] })
      setSelectedRequest(null)
      setProposalItems([])
      setProposalNotes("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = () => {
    if (!selectedRequest) return
    if (proposalItems.length === 0) {
      toast.error('Please add at least one equipment plan')
      return
    }
    if (totalCost === 0) {
      toast.error('Please set prices for all equipment')
      return
    }

    submitProposalMutation.mutate({
      requestId: selectedRequest.id,
      items: proposalItems,
      proposalNotes: proposalNotes || undefined,
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 px-2 sm:px-0">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Maintenance Plan Proposals</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Create maintenance plans for assigned requests
        </p>
      </div>

      {/* Assigned Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Requests</CardTitle>
          <CardDescription>Select a request to create a proposal</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No assigned requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <Card
                  key={request.id}
                  className={cn(
                    "hover:shadow-md transition-all",
                    selectedRequest?.id === request.id && "border-primary border-2"
                  )}
                >
                  <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-sm sm:text-base">Request #{request.requestNumber}</h3>
                          <Badge className="text-xs">Assigned</Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          Facility: {request.facility?.name || 'Unknown'}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Equipment: {request.equipmentIds.length} item(s)
                        </p>
                      </div>
                      <div className="flex-shrink-0 w-full sm:w-auto">
                        {selectedRequest?.id === request.id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setSelectedRequest(null)
                              setProposalItems([])
                              setProposalNotes("")
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setSelectedRequest(request)
                              setProposalItems([])
                              setProposalNotes("")
                            }}
                          >
                            <Wrench className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Prepare Maintenance Plan</span>
                            <span className="sm:hidden">Prepare Plan</span>
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

      {/* Loading Equipment */}
      {selectedRequest && equipmentLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading equipment details...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Equipment Found */}
      {selectedRequest && !equipmentLoading && equipment.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No equipment found for this request</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal Form */}
      {selectedRequest && equipment.length > 0 && proposalItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Proposal for Request #{selectedRequest.requestNumber}</CardTitle>
            <CardDescription>
              Define maintenance plans for each equipment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {proposalItems.map((item, index) => {
              const eq = equipment.find((e: any) => e.id === item.equipmentId)
              return (
                <Card key={item.equipmentId} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm sm:text-base">{eq?.name || 'Equipment'}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {eq?.manufacturer} {eq?.model && `- ${eq.model}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Maintenance Type *</Label>
                        <Select
                          value={item.maintenanceType}
                          onValueChange={(value) => updateProposalItem(index, { maintenanceType: value as any })}
                        >
                          <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="preventive">Preventive</SelectItem>
                            <SelectItem value="corrective">Corrective</SelectItem>
                            <SelectItem value="inspection">Inspection</SelectItem>
                            <SelectItem value="calibration">Calibration</SelectItem>
                            <SelectItem value="full_service">Full Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Schedule Type *</Label>
                        <Select
                          value={item.scheduleType}
                          onValueChange={(value) => updateProposalItem(index, { scheduleType: value as any })}
                        >
                          <SelectTrigger className="text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_year">Per Year</SelectItem>
                            <SelectItem value="per_service">Per Service</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {item.scheduleType === 'per_year' && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Price Per Year (TZS) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="text-xs sm:text-sm"
                              value={item.pricePerYear || ""}
                              onChange={(e) => updateProposalItem(index, { 
                                pricePerYear: parseFloat(e.target.value) || 0 
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Duration (Months) *</Label>
                            <Input
                              type="number"
                              min="1"
                              className="text-xs sm:text-sm"
                              value={item.durationMonths || 12}
                              onChange={(e) => updateProposalItem(index, { 
                                durationMonths: parseInt(e.target.value) || 12 
                              })}
                            />
                          </div>
                        </>
                      )}

                      {item.scheduleType === 'per_service' && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Price Per Service (TZS) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="text-xs sm:text-sm"
                              value={item.pricePerService || ""}
                              onChange={(e) => updateProposalItem(index, { 
                                pricePerService: parseFloat(e.target.value) || 0 
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Visits Per Year *</Label>
                            <Input
                              type="number"
                              min="1"
                              className="text-xs sm:text-sm"
                              value={item.visitsPerYear || ""}
                              onChange={(e) => updateProposalItem(index, { 
                                visitsPerYear: parseInt(e.target.value) || 0 
                              })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs sm:text-sm">Duration (Months) *</Label>
                            <Input
                              type="number"
                              min="1"
                              className="text-xs sm:text-sm"
                              value={item.durationMonths || 12}
                              onChange={(e) => updateProposalItem(index, { 
                                durationMonths: parseInt(e.target.value) || 12 
                              })}
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Response Time (Hours)</Label>
                        <Input
                          type="number"
                          min="1"
                          className="text-xs sm:text-sm"
                          value={item.responseTimeHours || ""}
                          onChange={(e) => updateProposalItem(index, { 
                            responseTimeHours: parseInt(e.target.value) || undefined 
                          })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.includesParts}
                          onChange={(e) => updateProposalItem(index, { includesParts: e.target.checked })}
                          className="rounded w-4 h-4"
                        />
                        <Label className="text-xs sm:text-sm">Includes Parts</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.includesEmergencySupport}
                          onChange={(e) => updateProposalItem(index, { includesEmergencySupport: e.target.checked })}
                          className="rounded w-4 h-4"
                        />
                        <Label className="text-xs sm:text-sm">Emergency Support</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Description</Label>
                      <Textarea
                        value={item.description || ""}
                        onChange={(e) => updateProposalItem(index, { description: e.target.value })}
                        placeholder="Describe the maintenance plan..."
                        rows={2}
                        className="text-xs sm:text-sm"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-primary/5 rounded-md">
                      <span className="text-xs sm:text-sm font-medium">Total Cost:</span>
                      <span className="text-base sm:text-lg font-bold text-primary">
                        {formatCurrency(item.totalCost || 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Proposal Notes */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">Proposal Notes (Optional)</Label>
              <Textarea
                value={proposalNotes}
                onChange={(e) => setProposalNotes(e.target.value)}
                placeholder="Additional notes about this proposal..."
                rows={3}
                className="text-xs sm:text-sm"
              />
            </div>

            {/* Total Cost */}
            <Card className="bg-primary/5 border-primary">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Proposal Cost</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary">
                      {formatCurrency(totalCost)}
                    </p>
                  </div>
                  <Calculator className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleSubmit}
                disabled={submitProposalMutation.isPending || totalCost === 0}
                className="flex-1 w-full sm:w-auto"
                size="sm"
              >
                {submitProposalMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Proposal
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSelectedRequest(null)
                  setProposalItems([])
                  setProposalNotes("")
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
