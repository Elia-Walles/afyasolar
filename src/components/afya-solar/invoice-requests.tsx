'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, RefreshCw, Mail, Phone, Package, Calendar, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InvoiceRequestRow {
  id: string
  facilityId: string
  facilityName: string
  facilityEmail: string | null
  facilityPhone: string | null
  packageId: string
  packageName: string
  // Afya Solar: paymentPlan, Afya Booking: billingCycle
  paymentPlan?: string | null
  billingCycle?: string | null
  amount: string | number
  currency?: string
  packageMetadata?: string | null
  status: string
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  serviceName?: 'afya-solar' | 'afya-booking'
}

export default function AfyaSolarInvoiceRequests() {
  const [requests, setRequests] = useState<InvoiceRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const url = `/api/admin/invoice-requests${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setRequests(data.data)
      } else {
        setRequests([])
      }
    } catch (e) {
      console.error('Failed to fetch invoice requests:', e)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [statusFilter])

  const formatDate = (d: string) => {
    try {
      const date = new Date(d)
      return date.toLocaleString()
    } catch {
      return d
    }
  }

  const formatAmount = (amount: string | number, currency?: string) => {
    const n = typeof amount === 'number' ? amount : parseFloat(amount)
    if (isNaN(n)) return amount
    const cur = currency || 'TZS'
    return `${cur} ${n.toLocaleString()}`
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>
      case 'approved':
        return <Badge variant="default" className="bg-green-600">Approved</Badge>
      case 'paid':
        return <Badge variant="default" className="bg-emerald-600">Paid</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleMarkAsPaid = async (row: InvoiceRequestRow) => {
    setUpdatingId(row.id)
    try {
      // Use service-specific admin endpoint so domain logic is preserved
      const service = row.serviceName || 'afya-solar'
      const basePath =
        service === 'afya-booking'
          ? '/api/admin/booking/invoice-requests'
          : '/api/admin/solar/invoice-requests'

      const res = await fetch(`${basePath}/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      const data = await res.json()
      if (data.success) {
        fetchRequests()
      } else {
        console.error(data.error)
      }
    } catch (e) {
      console.error('Failed to mark as paid:', e)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Requests (Pay By Invoice)
            </CardTitle>
            <CardDescription>
              Requests from facilities to pay by invoice. Emails are sent to info@ubuntuafyalink.co.tz.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchRequests} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No invoice requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Plan / Billing</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm font-medium">
                      {row.serviceName === 'afya-booking' ? 'Afya Booking' : 'Afya Solar'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">{row.facilityName}</p>
                        {row.facilityEmail && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {row.facilityEmail}
                          </p>
                        )}
                        {row.facilityPhone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {row.facilityPhone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{row.packageName}</span>
                        <span className="text-xs text-muted-foreground">({row.packageId})</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {row.serviceName === 'afya-booking'
                        ? row.billingCycle || '-'
                        : row.paymentPlan || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(row.amount, row.currency)}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      {row.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={updatingId === row.id}
                          onClick={() => handleMarkAsPaid(row)}
                        >
                          {updatingId === row.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark as Paid
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
