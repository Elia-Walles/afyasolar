"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Eye,
  User,
  Phone,
  Wallet,
  Building2,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useAdminWithdrawals, useUpdateWithdrawal } from "@/hooks/use-admin-withdrawals"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function AdminTransactions() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [adminNotes, setAdminNotes] = useState("")
  const [actionStatus, setActionStatus] = useState<string>("")

  const { data, isLoading, refetch } = useAdminWithdrawals(statusFilter)
  const updateWithdrawal = useUpdateWithdrawal()

  const withdrawals = data?.data || []
  const pendingCount = data?.counts?.pending || 0

  // Filter by search query
  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      w.technician?.name?.toLowerCase().includes(query) ||
      w.technician?.email?.toLowerCase().includes(query) ||
      w.technician?.phone?.toLowerCase().includes(query) ||
      w.id.toLowerCase().includes(query) ||
      w.withdrawalMethod?.toLowerCase().includes(query)
    )
  })

  const handleViewDetails = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal)
    setAdminNotes(withdrawal.adminNotes || "")
    setActionStatus("")
    setShowDetailsDialog(true)
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedWithdrawal) return

    try {
      await updateWithdrawal.mutateAsync({
        id: selectedWithdrawal.id,
        status,
        adminNotes: adminNotes || undefined,
      })
      setShowDetailsDialog(false)
      setSelectedWithdrawal(null)
      setAdminNotes("")
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
      processing: { label: "Processing", className: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
      completed: { label: "Completed", className: "bg-green-100 text-green-800 hover:bg-green-200" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-800 hover:bg-red-200" },
      cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800 hover:bg-gray-200" },
    }

    const variant = variants[status] || variants.pending

    return (
      <Badge className={variant.className}>
        {variant.label}
      </Badge>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "processing":
        return <AlertCircle className="h-4 w-4" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />
      case "rejected":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transaction Management</h2>
          <p className="text-muted-foreground">
            Manage technician withdrawal requests and transactions
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by technician name, email, phone, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          </CardContent>
        </Card>
      ) : filteredWithdrawals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal) => (
            <Card
              key={withdrawal.id}
              className={cn(
                "hover:shadow-md transition-shadow",
                withdrawal.status === "pending" && "border-yellow-300 border-2"
              )}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {withdrawal.technician?.name || "Unknown Technician"}
                            </h3>
                            {getStatusBadge(withdrawal.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            ID: {withdrawal.id.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(Number(withdrawal.amount))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(withdrawal.createdAt), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Method:</span>
                        <span className="font-medium capitalize">
                          {withdrawal.withdrawalMethod || "Not specified"}
                        </span>
                      </div>
                      {withdrawal.accountDetails?.accountNumber && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Account:</span>
                          <span className="font-medium">
                            {withdrawal.accountDetails.accountNumber}
                          </span>
                        </div>
                      )}
                      {withdrawal.accountDetails?.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium">
                            {withdrawal.accountDetails.phoneNumber}
                          </span>
                        </div>
                      )}
                      {withdrawal.accountDetails?.subscriberName && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Subscriber:</span>
                          <span className="font-medium">
                            {withdrawal.accountDetails.subscriberName}
                          </span>
                        </div>
                      )}
                      {withdrawal.technician?.email && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{withdrawal.technician.email}</span>
                        </div>
                      )}
                    </div>

                    {withdrawal.adminNotes && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Admin Notes: </span>
                        <span>{withdrawal.adminNotes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleViewDetails(withdrawal)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    {withdrawal.status === "pending" && (
                      <Button
                        variant="default"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal)
                          setAdminNotes(withdrawal.adminNotes || "")
                          setActionStatus("processing")
                          setShowDetailsDialog(true)
                        }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Process
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
            <DialogDescription>
              Review withdrawal request and take appropriate action
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-6">
              {/* Transaction Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Amount</label>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(Number(selectedWithdrawal.amount))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedWithdrawal.status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Technician</label>
                    <div className="mt-1 font-medium">
                      {selectedWithdrawal.technician?.name || "Unknown"}
                    </div>
                    {selectedWithdrawal.technician?.email && (
                      <div className="text-sm text-muted-foreground">
                        {selectedWithdrawal.technician.email}
                      </div>
                    )}
                    {selectedWithdrawal.technician?.phone && (
                      <div className="text-sm text-muted-foreground">
                        {selectedWithdrawal.technician.phone}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Request Date</label>
                    <div className="mt-1">
                      {format(new Date(selectedWithdrawal.createdAt), "MMM dd, yyyy HH:mm")}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Withdrawal Method</label>
                  <div className="mt-1 font-medium capitalize">
                    {selectedWithdrawal.withdrawalMethod || "Not specified"}
                  </div>
                </div>

                {/* Account Details */}
                {selectedWithdrawal.accountDetails && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <label className="text-sm font-medium">Account Details</label>
                    {selectedWithdrawal.accountDetails.accountNumber && (
                      <div>
                        <span className="text-sm text-muted-foreground">Account Number: </span>
                        <span className="font-medium">
                          {selectedWithdrawal.accountDetails.accountNumber}
                        </span>
                      </div>
                    )}
                    {selectedWithdrawal.accountDetails.phoneNumber && (
                      <div>
                        <span className="text-sm text-muted-foreground">Phone Number: </span>
                        <span className="font-medium">
                          {selectedWithdrawal.accountDetails.phoneNumber}
                        </span>
                      </div>
                    )}
                    {selectedWithdrawal.accountDetails.subscriberName && (
                      <div>
                        <span className="text-sm text-muted-foreground">Subscriber Name: </span>
                        <span className="font-medium">
                          {selectedWithdrawal.accountDetails.subscriberName}
                        </span>
                      </div>
                    )}
                    {selectedWithdrawal.accountDetails.bankName && (
                      <div>
                        <span className="text-sm text-muted-foreground">Bank: </span>
                        <span className="font-medium">
                          {selectedWithdrawal.accountDetails.bankName}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <label className="text-sm font-medium">Admin Notes</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this transaction..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              {selectedWithdrawal.status === "pending" && (
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionStatus("rejected")
                      handleUpdateStatus("rejected")
                    }}
                    disabled={updateWithdrawal.isPending}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionStatus("processing")
                      handleUpdateStatus("processing")
                    }}
                    disabled={updateWithdrawal.isPending}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Mark as Processing
                  </Button>
                  <Button
                    onClick={() => {
                      setActionStatus("completed")
                      handleUpdateStatus("completed")
                    }}
                    disabled={updateWithdrawal.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Withdrawal
                  </Button>
                </DialogFooter>
              )}

              {selectedWithdrawal.status === "processing" && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionStatus("rejected")
                      handleUpdateStatus("rejected")
                    }}
                    disabled={updateWithdrawal.isPending}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setActionStatus("completed")
                      handleUpdateStatus("completed")
                    }}
                    disabled={updateWithdrawal.isPending}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Complete
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
