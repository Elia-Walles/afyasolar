"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  History,
  Download, 
  Search, 
  SortAsc, 
  SortDesc,
  QrCode,
  Smartphone,
  Building,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  TrendingUp,
  Gift
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface BillingSectionProps {
  facilityId?: string
}

interface PaymentHistory {
  id: string
  date: string
  amount: number
  method: 'mobile-money' | 'bank-transfer'
  status: 'completed' | 'pending' | 'failed'
  receiptUrl?: string
}

interface UpcomingObligation {
  id: string
  month: string
  amount: number
  dueDate: string
  discount?: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  dueDate: string
  pdfUrl?: string
}

export function BillingSection({ facilityId }: BillingSectionProps) {
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"mobile-money" | "bank-transfer">("mobile-money")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [showQRCode, setShowQRCode] = useState(false)
  const [generatedReference, setGeneratedReference] = useState("")
  
  // Enhanced filtering states
  const [dateRange, setDateRange] = useState<"all" | "7days" | "30days" | "90days">("all")
  const [amountRange, setAmountRange] = useState<"all" | "0-10k" | "10k-50k" | "50k-100k" | "100k+">("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<"all" | "mobile-money" | "bank-transfer" | "cash">("all")

  // Mock data - in real app, this would come from API
  const currentStatus = {
    balanceDue: 125000,
    nextDueDate: "2024-03-15",
    monthlyObligation: 50000,
    gracePeriodDays: 5,
    status: "pending" as "pending" | "overdue" | "paid"
  }

  const paymentHistory: PaymentHistory[] = [
    {
      id: "1",
      date: "2024-02-28",
      amount: 50000,
      method: "mobile-money",
      status: "completed",
      receiptUrl: "/receipts/feb-2024.pdf"
    },
    {
      id: "2", 
      date: "2024-01-28",
      amount: 50000,
      method: "bank-transfer",
      status: "completed",
      receiptUrl: "/receipts/jan-2024.pdf"
    },
    {
      id: "3",
      date: "2024-03-01",
      amount: 25000,
      method: "mobile-money",
      status: "pending"
    }
  ]

  const upcomingObligations: UpcomingObligation[] = [
    {
      id: "1",
      month: "March 2024",
      amount: 50000,
      dueDate: "2024-03-15",
      discount: 5
    },
    {
      id: "2", 
      month: "April 2024",
      amount: 50000,
      dueDate: "2024-04-15",
      discount: 3
    },
    {
      id: "3",
      month: "May 2024", 
      amount: 50000,
      dueDate: "2024-05-15"
    }
  ]

  const invoices: Invoice[] = [
    {
      id: "1",
      invoiceNumber: "INV-2024-001",
      date: "2024-02-01",
      amount: 50000,
      status: "paid",
      dueDate: "2024-02-15",
      pdfUrl: "/invoices/inv-2024-001.pdf"
    },
    {
      id: "2",
      invoiceNumber: "INV-2024-002", 
      date: "2024-03-01",
      amount: 50000,
      status: "pending",
      dueDate: "2024-03-15",
      pdfUrl: "/invoices/inv-2024-002.pdf"
    }
  ]

  // Filter and sort payment history
  const filteredPaymentHistory = useMemo(() => {
    let filtered = paymentHistory.filter(payment =>
      payment.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.amount.toString().includes(searchTerm) ||
      payment.method.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA
    })
  }, [paymentHistory, searchTerm, sortOrder])

  // Apply advanced filters
  const advancedFilteredPaymentHistory = useMemo(() => {
    let filtered = filteredPaymentHistory

    // Date range filter
    const now = new Date()
    if (dateRange === "7days") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(payment => new Date(payment.date) >= sevenDaysAgo)
    } else if (dateRange === "30days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(payment => new Date(payment.date) >= thirtyDaysAgo)
    } else if (dateRange === "90days") {
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(payment => new Date(payment.date) >= ninetyDaysAgo)
    }

    // Amount range filter
    if (amountRange === "0-10k") {
      filtered = filtered.filter(payment => payment.amount <= 10000)
    } else if (amountRange === "10k-50k") {
      filtered = filtered.filter(payment => payment.amount > 10000 && payment.amount <= 50000)
    } else if (amountRange === "50k-100k") {
      filtered = filtered.filter(payment => payment.amount > 50000 && payment.amount <= 100000)
    } else if (amountRange === "100k+") {
      filtered = filtered.filter(payment => payment.amount > 100000)
    }

    // Payment method filter
    if (paymentMethodFilter !== "all") {
      filtered = filtered.filter(payment => payment.method === paymentMethodFilter)
    }

    return filtered
  }, [filteredPaymentHistory, dateRange, amountRange, paymentMethodFilter])

  // Export functions
  const exportToCSV = () => {
    const headers = ["Date", "Amount", "Method", "Status", "Receipt", "Running Balance"]
    const csvContent = [
      headers.join(","),
      ...advancedFilteredPaymentHistory.map(payment => [
        new Date(payment.date).toLocaleDateString(),
        payment.amount,
        payment.method,
        payment.status,
        payment.receiptUrl || "",
        payment.amount // Placeholder for running balance
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const exportToPDF = () => {
    console.log("Exporting to PDF...")
  }

  // Calculate running balance and totals
  const totalPaid = paymentHistory
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  const runningBalanceHistory = useMemo(() => {
    let balance = 0
    return [...advancedFilteredPaymentHistory].reverse().map(payment => {
      if (payment.status === 'completed') {
        balance -= payment.amount
      }
      return { ...payment, runningBalance: Math.abs(balance) }
    })
  }, [advancedFilteredPaymentHistory])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "failed":
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return <CheckCircle2 className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "failed":
      case "overdue":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const generatePaymentReference = () => {
    const reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    setGeneratedReference(reference)
  }

  const calculatePrepayDiscount = (months: number, baseAmount: number) => {
    const discountRates = { 1: 0, 3: 0.05, 6: 0.08, 12: 0.12 }
    const discount = discountRates[months as keyof typeof discountRates] || 0
    return {
      total: baseAmount * months * (1 - discount),
      discount: baseAmount * months * discount,
      rate: discount * 100
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(currentStatus.balanceDue)}</div>
            <p className="text-xs text-muted-foreground">Outstanding amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Due Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Date(currentStatus.nextDueDate).toLocaleDateString()}</div>
            <p className="text-xs text-muted-foreground">Payment deadline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Obligation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentStatus.monthlyObligation)}</div>
            <p className="text-xs text-muted-foreground">PaaS/Installment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grace Period</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStatus.gracePeriodDays}</div>
            <p className="text-xs text-muted-foreground">Days remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {getStatusIcon(currentStatus.status)}
          </CardHeader>
          <CardContent>
            <Badge className={cn(getStatusColor(currentStatus.status))}>
              {currentStatus.status.charAt(0).toUpperCase() + currentStatus.status.slice(1)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Account status</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payment" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="payment">Make Payment</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="obligations">Upcoming</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Make Payment Section */}
        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Make Payment</CardTitle>
              <CardDescription>Choose your payment method and amount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (TZS)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPaymentAmount(currentStatus.monthlyObligation.toString())}
                    >
                      Pay Minimum
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPaymentAmount(currentStatus.balanceDue.toString())}
                    >
                      Pay Full
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPaymentAmount("")}
                    >
                      Custom
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile-money">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Mobile Money
                        </div>
                      </SelectItem>
                      <SelectItem value="bank-transfer">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Bank Transfer
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={generatePaymentReference} className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Generate Payment Reference
                </Button>
                
                {paymentMethod === "mobile-money" && (
                  <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <QrCode className="h-4 w-4 mr-2" />
                        Show QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Mobile Money QR Code</DialogTitle>
                        <DialogDescription>
                          Scan this QR code with your mobile money app to complete payment
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                          <QrCode className="h-24 w-24 text-gray-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Payment Reference: {generatedReference || "Generate reference first"}
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {generatedReference && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Payment Reference Generated</p>
                  <p className="text-sm text-green-600">{generatedReference}</p>
                </div>
              )}

              {/* Payment Instructions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Payment Instructions</h4>
                {paymentMethod === "mobile-money" ? (
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>1. Dial *150*00# on your mobile phone</p>
                    <p>2. Select "Pay by M-Pesa"</p>
                    <p>3. Enter business number: 123456</p>
                    <p>4. Enter reference: {generatedReference || "Generate reference first"}</p>
                    <p>5. Enter amount: {paymentAmount || "Enter amount above"}</p>
                    <p>6. Enter your PIN to confirm</p>
                  </div>
                ) : (
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>1. Bank: CRDB Bank</p>
                    <p>2. Account Name: Afya Solar Ltd</p>
                    <p>3. Account Number: 0151234567890</p>
                    <p>4. Reference: {generatedReference || "Generate reference first"}</p>
                    <p>5. Amount: {paymentAmount || "Enter amount above"}</p>
                    <p>6. Send receipt to billing@afyasolar.co.tz</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View your past payments and receipts</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Advanced Filters */}
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search payments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateRange">Date Range</Label>
                  <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amountRange">Amount Range</Label>
                  <Select value={amountRange} onValueChange={(value: any) => setAmountRange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select amount range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Amounts</SelectItem>
                      <SelectItem value="0-10k">0 - 10,000</SelectItem>
                      <SelectItem value="10k-50k">10,000 - 50,000</SelectItem>
                      <SelectItem value="50k-100k">50,000 - 100,000</SelectItem>
                      <SelectItem value="100k+">100,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select value={paymentMethodFilter} onValueChange={(value: any) => setPaymentMethodFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="mobile-money">Mobile Money</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Export Options */}
              <div className="flex gap-2 mb-4">
                <Button variant="outline" onClick={exportToCSV} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export to CSV
                </Button>
                <Button variant="outline" onClick={exportToPDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export to PDF
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                    <p className="text-xs text-muted-foreground">All completed payments</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(currentStatus.balanceDue)}</div>
                    <p className="text-xs text-muted-foreground">Outstanding amount</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                    <div className="h-4 w-4 text-purple-600">
                      <History />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{advancedFilteredPaymentHistory.length}</div>
                    <p className="text-xs text-muted-foreground">Filtered transactions</p>
                  </CardContent>
                </Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Running Balance</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runningBalanceHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {payment.method === "mobile-money" ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <Building className="h-4 w-4" />
                          )}
                          {payment.method.replace("-", " ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(getStatusColor(payment.status), "flex items-center gap-1 w-fit")}>
                          {getStatusIcon(payment.status)}
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(payment.runningBalance)}</TableCell>
                      <TableCell>
                        {payment.receiptUrl ? (
                          <Button variant="ghost" size="sm" onClick={() => window.open(payment.receiptUrl, '_blank')}>
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upcoming Obligations */}
        <TabsContent value="obligations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Obligations</CardTitle>
              <CardDescription>Future payments and prepay options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingObligations.map((obligation) => (
                  <div key={obligation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{obligation.month}</h4>
                        {obligation.discount && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <Gift className="h-3 w-3 mr-1" />
                            {obligation.discount}% discount
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Due: {new Date(obligation.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(obligation.amount)}</div>
                      <Button size="sm" className="mt-1">Prepay Now</Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Prepay Options */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Prepay Multiple Months</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  {[3, 6, 12].map((months) => {
                    const { total, discount, rate } = calculatePrepayDiscount(months, currentStatus.monthlyObligation)
                    return (
                      <div key={months} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{months} Months</span>
                          {rate > 0 && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              {rate}% off
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Regular: {formatCurrency(currentStatus.monthlyObligation * months)}</p>
                          <p className="font-medium text-green-600">You pay: {formatCurrency(total)}</p>
                          <p className="text-xs text-green-600">Save {formatCurrency(discount)}</p>
                        </div>
                        <Button size="sm" className="w-full mt-2">Prepay {months} Months</Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice History */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>Download and view your past invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={cn(getStatusColor(invoice.status), "flex items-center gap-1 w-fit")}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
