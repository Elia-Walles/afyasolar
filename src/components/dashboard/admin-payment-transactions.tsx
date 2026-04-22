"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
  Building2,
  Smartphone,
  RefreshCw,
  TrendingUp,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { SubscriptionCountdown } from "@/components/ui/subscription-countdown"
import { AdminBlockingDialog } from "@/components/admin/admin-blocking-dialog"

interface PaymentTransaction {
  id: string
  facilityId: string
  serviceName: string
  externalId: string
  azamTransactionId?: string
  azamReference?: string
  mnoReference?: string
  amount: string
  currency: string
  paymentType: string
  paymentMethod?: string
  mobileNumber?: string
  mobileProvider?: string
  bankName?: string
  status: string
  statusMessage?: string
  failureReason?: string
  billingCycle?: string
  initiatedAt: string
  completedAt?: string
  failedAt?: string
  createdAt: string
  facilityName?: string
  subscriptionExpiryDate?: string
  subscriptionStatus?: string
}

interface TransactionStats {
  total: number
  completed: number
  failed: number
  pending: number
  totalAmount: number
}

interface TransactionResponse {
  transactions: PaymentTransaction[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
  stats: TransactionStats
}

export function AdminPaymentTransactions() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [serviceFilter, setServiceFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showStatusUpdateDialog, setShowStatusUpdateDialog] = useState(false)
  const [newStatus, setNewStatus] = useState<string>("")
  const [adminNotes, setAdminNotes] = useState<string>("")

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<TransactionResponse>({
    queryKey: ['admin-payment-transactions', statusFilter, serviceFilter, searchQuery, dateFrom, dateTo, sortBy, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy: sortBy,
        sortOrder: sortOrder,
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (serviceFilter !== 'all') params.set('serviceName', serviceFilter)
      if (searchQuery) params.set('search', searchQuery)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const response = await fetch(`/api/admin/transactions?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch transactions: ${response.status}`)
      }
      const result = await response.json()
      // Log for debugging
      console.log('Transactions API response:', result)
      return result
    },
    retry: 2,
    retryDelay: 1000,
    // Enable real-time polling - refetch every 5 seconds
    refetchInterval: 5000,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Refetch when reconnecting
    refetchOnReconnect: true,
  })

  const transactions = data?.transactions || []
  const stats = data?.stats || { total: 0, completed: 0, failed: 0, pending: 0, totalAmount: 0 }
  const pagination = data?.pagination || { page: 1, limit: 20, totalCount: 0, totalPages: 1, hasMore: false }

  // Mutation for verifying payment with Azam Pay
  const verifyPaymentMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(`/api/admin/transactions/${transactionId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to verify payment')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Payment verified successfully')
      refetch()
      queryClient.invalidateQueries({ queryKey: ["comprehensive-facilities"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.invalidateQueries({ queryKey: ["admin-active-subs"] })
      queryClient.invalidateQueries({ queryKey: ["afya-solar-admin-financial-summary"] })
      queryClient.invalidateQueries({ queryKey: ["afya-solar-admin-financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-snapshot-summary"] })
      queryClient.invalidateQueries({ queryKey: ["admin-solar-invoice-requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin-payment-transactions"] })
      // Refresh selected transaction if it's the same one
      if (selectedTransaction && data.data?.transactionId === selectedTransaction.id) {
        setSelectedTransaction({
          ...selectedTransaction,
          status: data.data.newStatus || selectedTransaction.status,
        })
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to verify payment')
    },
  })

  // Mutation for updating transaction status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ transactionId, status, notes }: { transactionId: string; status: string; notes?: string }) => {
      const response = await fetch(`/api/admin/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: notes }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update transaction')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Transaction status updated successfully')
      refetch()
      queryClient.invalidateQueries({ queryKey: ["comprehensive-facilities"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.invalidateQueries({ queryKey: ["admin-active-subs"] })
      queryClient.invalidateQueries({ queryKey: ["afya-solar-admin-financial-summary"] })
      queryClient.invalidateQueries({ queryKey: ["afya-solar-admin-financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["admin-assessment-snapshot-summary"] })
      queryClient.invalidateQueries({ queryKey: ["admin-solar-invoice-requests"] })
      queryClient.invalidateQueries({ queryKey: ["admin-payment-transactions"] })
      setShowStatusUpdateDialog(false)
      setShowDetailsDialog(false)
      setNewStatus("")
      setAdminNotes("")
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update transaction status')
    },
  })

  const handleUpdateStatus = () => {
    if (!selectedTransaction || !newStatus) {
      toast.error('Please select a status')
      return
    }
    updateStatusMutation.mutate({
      transactionId: selectedTransaction.id,
      status: newStatus,
      notes: adminNotes || undefined,
    })
  }

  const handleViewDetails = (transaction: PaymentTransaction) => {
    setSelectedTransaction(transaction)
    setNewStatus(transaction.status)
    setAdminNotes("")
    setShowDetailsDialog(true)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string; icon: typeof Clock }> = {
      initiated: { label: "Initiated", className: "bg-gray-100 text-gray-800 border border-gray-300", icon: Clock },
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border border-yellow-300", icon: Clock },
      awaiting_confirmation: { label: "Awaiting PIN", className: "bg-blue-100 text-blue-800 border border-blue-300", icon: AlertCircle },
      processing: { label: "Processing", className: "bg-purple-100 text-purple-800 border border-purple-300", icon: RefreshCw },
      completed: { label: "Completed", className: "bg-green-100 text-green-800 border border-green-300", icon: CheckCircle2 },
      failed: { label: "Failed", className: "bg-red-100 text-red-800 border border-red-300", icon: XCircle },
      cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800 border border-gray-300", icon: XCircle },
    }

    const variant = variants[status] || variants.pending
    const Icon = variant.icon

    return (
      <Badge className={cn("flex items-center gap-1.5 px-2.5 py-1 font-semibold shadow-sm", variant.className)}>
        <Icon className="h-3.5 w-3.5" />
        {variant.label}
      </Badge>
    )
  }

  const getServiceBadge = (serviceName: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      'afya-solar': { label: "Afya Solar", className: "bg-yellow-50 text-yellow-700 border border-yellow-300 shadow-sm" },
    }

    const variant = variants[serviceName] || { label: serviceName, className: "bg-gray-50 text-gray-700 border border-gray-300" }

    return (
      <Badge variant="outline" className={cn("px-2.5 py-1 font-semibold shadow-sm", variant.className)}>
        {variant.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payment Transactions</h2>
          <p className="text-muted-foreground">
            View all Azam Pay payment transactions from facilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <CreditCard className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by transaction ID, mobile number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="initiated">Initiated</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="awaiting_confirmation">Awaiting PIN</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="afya-solar">Afya Solar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <TrendingUp className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="w-full sm:w-auto"
            >
              {sortOrder === "desc" ? "↓" : "↑"}
            </Button>
          </div>
          
          {/* Date Range Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t">
            <div className="flex-1">
              <Label htmlFor="dateFrom" className="text-xs text-muted-foreground mb-1 block">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="h-9"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="dateTo" className="text-xs text-muted-foreground mb-1 block">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="h-9"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom("")
                  setDateTo("")
                  setPage(1)
                }}
                className="h-9"
              >
                Clear Dates
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading transactions...
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
              <p className="text-red-600 font-medium">Error loading transactions</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card
              key={transaction.id}
              className={cn(
                "hover:shadow-lg transition-all cursor-pointer border-2",
                transaction.status === "pending" && "border-yellow-300 border-l-4 bg-yellow-50/30",
                transaction.status === "failed" && "border-red-300 border-l-4 bg-red-50/30",
                transaction.status === "completed" && "border-green-300 border-l-4 bg-green-50/20",
                transaction.status === "awaiting_confirmation" && "border-blue-300 border-l-4 bg-blue-50/30",
                transaction.status === "processing" && "border-purple-300 border-l-4 bg-purple-50/30"
              )}
              onClick={() => handleViewDetails(transaction)}
            >
              <CardContent className="py-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className={cn(
                          "h-4 w-4",
                          transaction.status === "completed" ? "text-green-600" : 
                          transaction.status === "failed" ? "text-red-600" :
                          transaction.status === "pending" ? "text-yellow-600" :
                          "text-muted-foreground"
                        )} />
                        <span className="font-medium">
                          {transaction.mobileNumber || transaction.externalId.substring(0, 16)}
                        </span>
                      </div>
                      {getStatusBadge(transaction.status)}
                      {getServiceBadge(transaction.serviceName)}
                    </div>

                    {/* Subscription Countdown - Show for completed transactions */}
                    {transaction.status === "completed" && transaction.subscriptionExpiryDate && (
                      <div>
                        <SubscriptionCountdown
                          expiryDate={transaction.subscriptionExpiryDate}
                          billingCycle={transaction.billingCycle as "monthly" | "yearly" | null}
                        />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        <span className="font-medium">{transaction.facilityName || "Unknown Facility"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(transaction.createdAt), "MMM dd, HH:mm")}
                      </div>
                      {transaction.completedAt && transaction.status === "completed" && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="font-medium">Completed {format(new Date(transaction.completedAt), "MMM dd")}</span>
                        </div>
                      )}
                      {transaction.mobileProvider && (
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          {transaction.mobileProvider}
                        </div>
                      )}
                      <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border">
                        {transaction.externalId.substring(0, 20)}...
                      </div>
                    </div>

                    {transaction.failureReason && (
                      <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">{transaction.failureReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Amount and Status */}
                  <div className="text-right space-y-2">
                    <div className={cn(
                      "text-2xl font-bold",
                      transaction.status === "completed" ? "text-green-600" : 
                      transaction.status === "failed" ? "text-red-600" :
                      transaction.status === "pending" ? "text-yellow-600" :
                      "text-gray-700"
                    )}>
                      {formatCurrency(Number(transaction.amount))}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{transaction.currency}</p>
                    {transaction.billingCycle && (
                      <Badge variant="outline" className="mt-1">
                        {transaction.billingCycle === "yearly" ? "Yearly" : "Monthly"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pagination.limit + 1} - {Math.min(page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-3">
              Page {page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!pagination.hasMore}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete details of the payment transaction
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6">
              {/* Status and Amount */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium">Amount</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    selectedTransaction.status === "completed" ? "text-green-600" : "text-gray-700"
                  )}>
                    {formatCurrency(Number(selectedTransaction.amount))}
                  </p>
                </div>
              </div>

              {/* Subscription Countdown - Show for completed transactions */}
              {selectedTransaction.status === "completed" && selectedTransaction.subscriptionExpiryDate && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-900 mb-2">Subscription Status</p>
                  <SubscriptionCountdown
                    expiryDate={selectedTransaction.subscriptionExpiryDate}
                    billingCycle={selectedTransaction.billingCycle as "monthly" | "yearly" | null}
                    className="w-full"
                  />
                  {selectedTransaction.subscriptionExpiryDate && (
                    <p className="text-xs text-green-700 mt-2">
                      Expires: {format(new Date(selectedTransaction.subscriptionExpiryDate), "MMM dd, yyyy 'at' HH:mm")}
                    </p>
                  )}
                </div>
              )}

              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-muted-foreground">Transaction ID</label>
                  <p className="font-mono text-xs mt-1 break-all">{selectedTransaction.id}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">External ID</label>
                  <p className="font-mono text-xs mt-1 break-all">{selectedTransaction.externalId}</p>
                </div>
                {selectedTransaction.azamTransactionId && (
                  <div>
                    <label className="text-muted-foreground">Azam Transaction ID</label>
                    <p className="font-mono text-xs mt-1 break-all">{selectedTransaction.azamTransactionId}</p>
                  </div>
                )}
                {selectedTransaction.azamReference && (
                  <div>
                    <label className="text-muted-foreground">Azam Reference</label>
                    <p className="font-mono text-xs mt-1 break-all">{selectedTransaction.azamReference}</p>
                  </div>
                )}
                {selectedTransaction.mnoReference && (
                  <div>
                    <label className="text-muted-foreground">MNO Reference</label>
                    <p className="font-mono text-xs mt-1 break-all">{selectedTransaction.mnoReference}</p>
                  </div>
                )}
              </div>

              {/* Service & Facility */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-muted-foreground">Service</label>
                  <div className="mt-1">{getServiceBadge(selectedTransaction.serviceName)}</div>
                </div>
                <div>
                  <label className="text-muted-foreground">Facility</label>
                  <p className="mt-1 font-medium">{selectedTransaction.facilityName || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{selectedTransaction.facilityId}</p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                <label className="text-sm font-medium text-blue-900">Payment Details</label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700">Type:</span>
                    <span className="ml-2 font-medium capitalize">{selectedTransaction.paymentType}</span>
                  </div>
                  {selectedTransaction.mobileProvider && (
                    <div>
                      <span className="text-blue-700">Provider:</span>
                      <span className="ml-2 font-medium">{selectedTransaction.mobileProvider}</span>
                    </div>
                  )}
                  {selectedTransaction.mobileNumber && (
                    <div>
                      <span className="text-blue-700">Mobile:</span>
                      <span className="ml-2 font-medium">{selectedTransaction.mobileNumber}</span>
                    </div>
                  )}
                  {selectedTransaction.bankName && (
                    <div>
                      <span className="text-blue-700">Bank:</span>
                      <span className="ml-2 font-medium">{selectedTransaction.bankName}</span>
                    </div>
                  )}
                  {selectedTransaction.billingCycle && (
                    <div>
                      <span className="text-blue-700">Billing:</span>
                      <span className="ml-2 font-medium capitalize">{selectedTransaction.billingCycle}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-muted-foreground">Initiated</label>
                  <p className="mt-1">{format(new Date(selectedTransaction.initiatedAt), "MMM dd, yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Created</label>
                  <p className="mt-1">{format(new Date(selectedTransaction.createdAt), "MMM dd, yyyy HH:mm:ss")}</p>
                </div>
                {selectedTransaction.completedAt && (
                  <div>
                    <label className="text-muted-foreground">Completed</label>
                    <p className="mt-1 text-green-600">{format(new Date(selectedTransaction.completedAt), "MMM dd, yyyy HH:mm:ss")}</p>
                  </div>
                )}
                {selectedTransaction.failedAt && (
                  <div>
                    <label className="text-muted-foreground">Failed</label>
                    <p className="mt-1 text-red-600">{format(new Date(selectedTransaction.failedAt), "MMM dd, yyyy HH:mm:ss")}</p>
                  </div>
                )}
              </div>

              {/* Error Info */}
              {(selectedTransaction.statusMessage || selectedTransaction.failureReason) && (
                <div className={cn(
                  "p-4 rounded-lg",
                  selectedTransaction.status === "failed" ? "bg-red-50" : "bg-gray-50"
                )}>
                  {selectedTransaction.statusMessage && (
                    <div>
                      <label className="text-sm font-medium">Status Message</label>
                      <p className="mt-1 text-sm">{selectedTransaction.statusMessage}</p>
                    </div>
                  )}
                  {selectedTransaction.failureReason && (
                    <div className="mt-2">
                      <label className="text-sm font-medium text-red-700">Failure Reason</label>
                      <p className="mt-1 text-sm text-red-600">{selectedTransaction.failureReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Actions */}
              <div className="border-t pt-4 space-y-4">
                {/* Quick Mark as Completed Button - Show if not completed */}
                {selectedTransaction.status !== 'completed' && (
                  <div>
                    <Button
                      onClick={() => {
                        setNewStatus('completed')
                        setAdminNotes('Payment verified and marked as completed by admin')
                        handleUpdateStatus()
                      }}
                      disabled={updateStatusMutation.isPending}
                      variant="default"
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {updateStatusMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Marking as Completed...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark as Completed & Send SMS
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Manually mark payment as completed and send SMS notification to user
                    </p>
                  </div>
                )}
                
                {/* Verify Payment Button - Show if transaction has Azam ID and is not completed */}
                {selectedTransaction.azamTransactionId && selectedTransaction.status !== 'completed' && (
                  <div>
                    <Button
                      onClick={() => verifyPaymentMutation.mutate(selectedTransaction.id)}
                      disabled={verifyPaymentMutation.isPending}
                      variant="outline"
                      className="w-full"
                    >
                      {verifyPaymentMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Verifying with Azam Pay...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Verify Payment with Azam Pay
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check current payment status directly with Azam Pay API (may timeout)
                    </p>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="statusUpdate" className="text-sm font-medium mb-2 block">
                    Update Transaction Status
                  </Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger id="statusUpdate">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initiated">Initiated</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="awaiting_confirmation">Awaiting PIN</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="adminNotes" className="text-sm font-medium mb-2 block">
                    Admin Notes (Optional)
                  </Label>
                  <Textarea
                    id="adminNotes"
                    placeholder="Add notes about this status change..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleUpdateStatus}
                  disabled={updateStatusMutation.isPending || !newStatus || newStatus === selectedTransaction.status}
                  className="w-full"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdminBlockingDialog
        open={verifyPaymentMutation.isPending || updateStatusMutation.isPending}
        title="Updating payment"
        description="Contacting the payment provider and refreshing records. Please wait."
      />
    </div>
  )
}

