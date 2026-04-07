'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt, Download, Building2, Calendar, DollarSign, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  ManagementPanelTableSkeleton,
  ManagementPanelErrorState,
} from '@/components/management-panel/management-panel-loading'

interface Payment {
  id: string
  facilityId: string
  facilityName: string
  amount: string
  paymentDate: string
  periodLabel: string
  paymentType: string
  status: string
}

export function ManagementPanelPaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchData = async () => {
    try {
      setError(null)
      setRefreshing(true)
      const res = await fetch('/api/management-panel/payments')
      if (!res.ok) throw new Error('Failed to fetch payments')
      const data = await res.json()
      setPayments(data.payments || [])
      setTotalAmount(Number(data.totalAmount ?? 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleExport = async () => {
    try {
      setExporting(true)
      const res = await fetch('/api/management-panel/export')
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      const csvLines = [
        'Facility,Period,Amount (TZS),Type,Status',
        ...(data.payments || []).map(
          (p: { facilityName: string; periodLabel: string; amount: string; paymentType: string; status: string }) =>
            [p.facilityName, p.periodLabel, p.amount, p.paymentType, p.status].join(',')
        ),
      ]
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payment-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <ManagementPanelTableSkeleton rows={8} />
  }

  if (error) {
    return (
      <ManagementPanelErrorState
        title="Unable to load payments"
        message={error}
        onRetry={fetchData}
      />
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Payment History</h1>
          <p className="text-sm text-gray-500 mt-1">Recent PAYG and payment records across all sites</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || payments.length === 0}
            className="gap-2"
          >
            <Download className={cn('w-4 h-4', exporting && 'animate-pulse')} />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>
    <Card className="rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50/30">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="w-5 h-5" />
            Recent Payments
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">All payments from the database</p>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No payments in the database yet.</p>
            <p className="text-sm mt-1">Run the management panel seed to load payment history.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="pb-3 font-medium">Facility</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Amount (TZS)</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {p.facilityName}
                        </span>
                      </td>
                      <td className="py-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {typeof p.paymentDate === 'string' ? p.paymentDate : format(new Date(p.paymentDate), 'yyyy-MM-dd')}
                      </td>
                      <td className="py-3">
                        <span className="flex items-center gap-2 font-medium">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          {Number(p.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3">{p.paymentType}</td>
                      <td className="py-3">
                        <Badge className="bg-green-100 text-green-800">{p.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Summary: Total collected this period — TZS {totalAmount.toLocaleString()}
            </p>
          </>
        )}
      </CardContent>
    </Card>
    </>
  )
}
