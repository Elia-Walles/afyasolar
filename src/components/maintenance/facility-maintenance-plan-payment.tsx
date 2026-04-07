"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DollarSign,
  CheckCircle2,
  Loader2,
  Package,
  CreditCard,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils"
import { MaintenancePaymentDialog } from "@/components/maintenance/maintenance-payment-dialog"

interface Proposal {
  id: string
  requestId: string
  totalCost: string
  status: string
  request?: {
    id: string
    requestNumber: string
  }
}

interface Payment {
  id: string
  proposalId: string
  paymentType: 'half' | 'full'
  amount: string
  totalAmount: string
  paymentStatus: string
  paidAt: string
}

export function FacilityMaintenancePlanPayment() {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [proposalPaymentTypes, setProposalPaymentTypes] = useState<Record<string, 'half' | 'full'>>({})

  const queryClient = useQueryClient()

  // Fetch approved proposals awaiting payment
  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ['facility-maintenance-plan-proposals', 'facility_approved'],
    queryFn: async () => {
      const response = await fetch('/api/maintenance/plan-proposals?status=facility_approved')
      if (!response.ok) throw new Error('Failed to fetch proposals')
      const result = await response.json()
      return result.data || []
    },
  })

  // Fetch existing payments
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['maintenance-plan-payments'],
    queryFn: async () => {
      const response = await fetch('/api/maintenance/plan-payments')
      if (!response.ok) return []
      const result = await response.json()
      return result.data || []
    },
  })


  const getPaymentAmount = (proposal: Proposal, paymentType: 'half' | 'full') => {
    const total = Number(proposal.totalCost)
    const existingPayments = payments.filter(p => p.proposalId === proposal.id && p.paymentStatus === 'confirmed')
    const paid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const remaining = total - paid
    
    if (paymentType === 'half') {
      return remaining / 2
    }
    return remaining
  }

  const getPaymentTypeForProposal = (proposalId: string): 'half' | 'full' => {
    return proposalPaymentTypes[proposalId] || 'full'
  }

  const setPaymentTypeForProposal = (proposalId: string, type: 'half' | 'full') => {
    setProposalPaymentTypes(prev => ({ ...prev, [proposalId]: type }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Maintenance Plan Payments</h2>
        <p className="text-muted-foreground">
          Make payments for approved maintenance plans
        </p>
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
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No proposals awaiting payment</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const existingPayments = payments.filter(p => p.proposalId === proposal.id)
            const totalPaid = existingPayments
              .filter(p => p.paymentStatus === 'confirmed')
              .reduce((sum, p) => sum + Number(p.amount), 0)
            const totalAmount = Number(proposal.totalCost)
            const remaining = totalAmount - totalPaid
            const isFullyPaid = remaining <= 0

            return (
              <Card key={proposal.id} className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              Request #{proposal.request?.requestNumber || 'N/A'}
                            </h3>
                            {isFullyPaid ? (
                              <Badge className="bg-green-100 text-green-800">Fully Paid</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800">Payment Pending</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Total Cost: {formatCurrency(totalAmount)}
                          </p>
                          {totalPaid > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Paid: {formatCurrency(totalPaid)} | Remaining: {formatCurrency(remaining)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isFullyPaid && (() => {
                      const proposalPaymentType = getPaymentTypeForProposal(proposal.id)
                      return (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button
                              variant={proposalPaymentType === 'half' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setPaymentTypeForProposal(proposal.id, 'half')}
                            >
                              Half ({formatCurrency(remaining / 2)})
                            </Button>
                            <Button
                              variant={proposalPaymentType === 'full' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setPaymentTypeForProposal(proposal.id, 'full')}
                            >
                              Full ({formatCurrency(remaining)})
                            </Button>
                          </div>
                          <Button
                            onClick={() => {
                              setSelectedProposal(proposal)
                              setShowPaymentDialog(true)
                            }}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay {proposalPaymentType === 'half' ? formatCurrency(remaining / 2) : formatCurrency(remaining)}
                          </Button>
                        </div>
                      )
                    })()}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Payment Dialog */}
      {selectedProposal && (() => {
        const proposalPaymentType = getPaymentTypeForProposal(selectedProposal.id)
        return (
          <MaintenancePaymentDialog
            open={showPaymentDialog}
            onOpenChange={(open) => {
              setShowPaymentDialog(open)
              if (!open) {
                setSelectedProposal(null)
              }
            }}
            amount={getPaymentAmount(selectedProposal, proposalPaymentType)}
            paymentType="maintenance_plan"
            proposalId={selectedProposal.id}
            title="Make Payment"
            description={`Payment for maintenance plan. ${proposalPaymentType === 'half' ? 'Half payment (50%)' : 'Full payment (100%)'}`}
            onPaymentComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['maintenance-plan-payments'] })
              queryClient.invalidateQueries({ queryKey: ['facility-maintenance-plan-proposals'] })
              setSelectedProposal(null)
            }}
          />
        )
      })()}
    </div>
  )
}
