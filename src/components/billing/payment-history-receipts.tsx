"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  History, 
  Download, 
  Search, 
  Filter,
  Calendar,
  DollarSign,
  Smartphone,
  Building,
  Mail,
  Printer,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  Share2
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface PaymentHistoryReceiptsProps {
  facilityId?: string
}

interface PaymentRecord {
  id: string
  date: string
  amount: number
  method: 'mobile-money' | 'bank-transfer' | 'cash'
  status: 'completed' | 'pending' | 'failed'
  receiptNumber: string
  description: string
  runningBalance: number
}

interface Receipt {
  id: string
  receiptNumber: string
  date: string
  amount: number
  method: string
  status: string
  description: string
  verified: boolean
  pdfUrl?: string
}

export function PaymentHistoryReceipts({ facilityId }: PaymentHistoryReceiptsProps) {
  const [activeTab, setActiveTab] = useState("history")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState<"all" | "7days" | "30days" | "90days" | "custom">("all")
  const [amountRange, setAmountRange] = useState<"all" | "0-10k" | "10k-50k" | "50k-100k" | "100k+">("all")
  const [paymentMethod, setPaymentMethod] = useState<"all" | "mobile-money" | "bank-transfer" | "cash">("all")
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailAddress, setEmailAddress] = useState("")

  // Mock data - in real app, this would come from API
  const paymentHistory: PaymentRecord[] = [
    {
      id: "1",
      date: "2024-03-01T10:30:00Z",
      amount: 50000,
      method: "mobile-money",
      status: "completed",
      receiptNumber: "RCP-2024-001",
      description: "Monthly payment - March 2024",
      runningBalance: 125000
    },
    {
      id: "2",
      date: "2024-02-01T09:15:00Z",
      amount: 50000,
      method: "bank-transfer",
      status: "completed",
      receiptNumber: "RCP-2024-002",
      description: "Monthly payment - February 2024",
      runningBalance: 175000
    },
    {
      id: "3",
      date: "2024-01-01T11:45:00Z",
      amount: 50000,
      method: "mobile-money",
      status: "completed",
      receiptNumber: "RCP-2024-003",
      description: "Monthly payment - January 2024",
      runningBalance: 225000
    },
    {
      id: "4",
      date: "2024-03-15T14:20:00Z",
      amount: 25000,
      method: "mobile-money",
      status: "pending",
      receiptNumber: "RCP-2024-004",
      description: "Partial payment - March 2024",
      runningBalance: 100000
    }
  ]

  const receipts: Receipt[] = [
    {
      id: "1",
      receiptNumber: "RCP-2024-001",
      date: "2024-03-01T10:30:00Z",
      amount: 50000,
      method: "Mobile Money",
      status: "completed",
      description: "Monthly payment - March 2024",
      verified: true,
      pdfUrl: "/receipts/rcp-2024-001.pdf"
    },
    {
      id: "2",
      receiptNumber: "RCP-2024-002",
      date: "2024-02-01T09:15:00Z",
      amount: 50000,
      method: "Bank Transfer",
      status: "completed",
      description: "Monthly payment - February 2024",
      verified: true,
      pdfUrl: "/receipts/rcp-2024-002.pdf"
    }
  ]

  // Filter payment history based on filters
  const filteredPaymentHistory = useMemo(() => {
    let filtered = paymentHistory

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.amount.toString().includes(searchTerm)
      )
    }

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
    if (paymentMethod !== "all") {
      filtered = filtered.filter(payment => payment.method === paymentMethod)
    }

    return filtered
  }, [paymentHistory, searchTerm, dateRange, amountRange, paymentMethod])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "failed":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "failed":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "mobile-money":
      case "Mobile Money":
        return <Smartphone className="h-4 w-4" />
      case "bank-transfer":
      case "Bank Transfer":
        return <Building className="h-4 w-4" />
      case "cash":
        return <DollarSign className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const exportToCSV = () => {
    const headers = ["Date", "Receipt Number", "Amount", "Method", "Status", "Description", "Running Balance"]
    const csvContent = [
      headers.join(","),
      ...filteredPaymentHistory.map(payment => [
        new Date(payment.date).toLocaleDateString(),
        payment.receiptNumber,
        payment.amount,
        payment.method,
        payment.status,
        payment.description,
        payment.runningBalance
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
    // In real app, this would generate PDF
    console.log("Exporting to PDF...")
  }

  const printReceipt = (receipt: Receipt) => {
    const printWindow = window.open('', '', 'PRINT', 'height=600,width=800')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt ${receipt.receiptNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .details { margin: 20px 0; }
              .row { display: flex; justify-content: space-between; margin: 10px 0; }
              .label { font-weight: bold; }
              .footer { margin-top: 40px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Payment Receipt</h1>
              <h2>${receipt.receiptNumber}</h2>
            </div>
            <div class="details">
              <div class="row">
                <span class="label">Date:</span>
                <span>${new Date(receipt.date).toLocaleDateString()}</span>
              </div>
              <div class="row">
                <span class="label">Amount:</span>
                <span>${formatCurrency(receipt.amount)}</span>
              </div>
              <div class="row">
                <span class="label">Method:</span>
                <span>${receipt.method}</span>
              </div>
              <div class="row">
                <span class="label">Description:</span>
                <span>${receipt.description}</span>
              </div>
              <div class="row">
                <span class="label">Status:</span>
                <span>${receipt.status}</span>
              </div>
            </div>
            <div class="footer">
              <p>This is an official receipt from Afya Solar</p>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  const emailReceipt = () => {
    // In real app, this would send email
    console.log(`Emailing receipt to ${emailAddress}`)
    setEmailDialogOpen(false)
    setEmailAddress("")
  }

  const verifyReceipt = (receipt: Receipt) => {
    // In real app, this would verify receipt
    console.log(`Verifying receipt ${receipt.receiptNumber}`)
  }

  const totalPaid = paymentHistory
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  const currentBalance = paymentHistory.length > 0 
    ? paymentHistory[0].runningBalance 
    : 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(currentBalance)}</div>
            <p className="text-xs text-muted-foreground">Outstanding amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <History className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{paymentHistory.length}</div>
            <p className="text-xs text-muted-foreground">Payment records</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        {/* Payment History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-green-600" />
                Detailed Payment History
              </CardTitle>
              <CardDescription>View and filter your payment transactions</CardDescription>
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
                      placeholder="Search receipts..."
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
                      <SelectItem value="custom">Custom Range</SelectItem>
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
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="mobile-money">Mobile Money</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
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

              {/* Payment History Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Running Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPaymentHistory.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{payment.receiptNumber}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMethodIcon(payment.method)}
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
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipts Tab */}
        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Receipts
              </CardTitle>
              <CardDescription>Access and manage all your payment receipts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {receipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{receipt.receiptNumber}</h4>
                        {receipt.verified && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <div className="font-medium">{new Date(receipt.date).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <div className="font-medium">{formatCurrency(receipt.amount)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Method:</span>
                          <div className="flex items-center gap-1 font-medium">
                            {getMethodIcon(receipt.method)}
                            {receipt.method}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <div className="font-medium">{receipt.status}</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{receipt.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => printReceipt(receipt)}>
                        <Printer className="h-4 w-4 mr-1" />
                        Print
                      </Button>
                      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Mail className="h-4 w-4 mr-1" />
                            Email
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Email Receipt</DialogTitle>
                            <DialogDescription>
                              Send a copy of this receipt to your email address
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="email">Email Address</Label>
                              <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={emailAddress}
                                onChange={(e) => setEmailAddress(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={emailReceipt} disabled={!emailAddress}>
                                Send Email
                              </Button>
                              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm" onClick={() => verifyReceipt(receipt)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Verify
                      </Button>
                      {receipt.pdfUrl && (
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
