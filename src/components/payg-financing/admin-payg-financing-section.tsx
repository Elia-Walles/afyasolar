"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils"

type ContractStatus = "active" | "completed" | "defaulted"
type RepaymentStatus = "pending" | "paid" | "overdue"

interface AdminFinancingContract {
  id: string
  customerId: string
  facilityName: string | null
  facilityStatus: string | null
  principalIssued: string | number
  interestRate: string | number
  amountPaid: string | number
  outstandingBalance: string | number
  daysOverdue: number
  status: ContractStatus
  createdAt: string
  updatedAt: string
}

interface AdminRepaymentEntry {
  id: string
  contractId: string
  facilityId: string
  facilityName: string | null
  dueDate: string
  amount: string | number
  principal: string | number
  interest: string | number
  status: RepaymentStatus
  paidDate: string | null
}

interface AdminPaygSummary {
  contracts: AdminFinancingContract[]
  schedule: AdminRepaymentEntry[]
  kpis: {
    totalOutstanding: number
    totalPaid: number
    nextDueAmount: number
    nextDueDate: string | null
    overdueCount: number
    activeContracts: number
    completedContracts: number
    defaultedContracts: number
    totalContracts: number
  }
}

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function shortId(id: string) {
  return id ? `#${id.slice(0, 8).toUpperCase()}` : "—"
}

function StatusBadge({ status }: { status: ContractStatus | RepaymentStatus | string }) {
  const st = String(status || "").toLowerCase()
  if (st === "completed" || st === "paid" || st === "active") {
    return (
      <Badge variant="outline" className="border-green-300 text-green-700">
        {status}
      </Badge>
    )
  }
  if (st === "defaulted" || st === "overdue") {
    return <Badge variant="destructive">{status}</Badge>
  }
  return <Badge variant="secondary">{status || "unknown"}</Badge>
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-4 w-4 text-green-700" />
          {title}
        </div>
        <p className="mt-1 text-xl font-bold">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export function AdminPaygFinancingSection({ facilityId }: { facilityId?: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<AdminPaygSummary>({
    queryKey: ["admin-payg-financing-summary", facilityId || "portfolio"],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (facilityId) params.set("facilityId", facilityId)
      const query = params.toString()
      const res = await fetch(`/api/admin/payg-financing/summary${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to load admin PAYG summary")
      }
      return res.json()
    },
    refetchOnWindowFocus: false,
  })

  const contracts = data?.contracts ?? []
  const schedule = data?.schedule ?? []
  const kpis = data?.kpis

  const visibleSchedule = useMemo(
    () =>
      [...schedule].sort((a, b) => {
        const aPaid = a.status === "paid" ? 1 : 0
        const bPaid = b.status === "paid" ? 1 : 0
        if (aPaid !== bPaid) return aPaid - bPaid
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }),
    [schedule],
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading admin PAYG &amp; Financing...
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          <p>Could not load PAYG &amp; Financing data.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold">PAYG &amp; Financing</h4>
          <p className="text-xs text-muted-foreground">
            {facilityId ? "Filtered to the selected facility." : "Portfolio-wide financing contracts and repayment schedule."}
          </p>
        </div>
        {isFetching ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Outstanding"
          value={formatCurrency(kpis?.totalOutstanding ?? 0)}
          subtitle="Open financing balance"
          icon={Wallet}
        />
        <KpiCard
          title="Total paid"
          value={formatCurrency(kpis?.totalPaid ?? 0)}
          subtitle="Applied repayments"
          icon={CheckCircle2}
        />
        <KpiCard
          title="Next due"
          value={(kpis?.nextDueAmount ?? 0) > 0 ? formatCurrency(kpis?.nextDueAmount ?? 0) : "—"}
          subtitle={kpis?.nextDueDate ? formatDate(kpis.nextDueDate) : "No pending dues"}
          icon={Calendar}
        />
        <KpiCard
          title="Overdue entries"
          value={String(kpis?.overdueCount ?? 0)}
          subtitle="Pending schedule entries past due"
          icon={AlertTriangle}
        />
        <KpiCard
          title="Contracts"
          value={String(kpis?.totalContracts ?? 0)}
          subtitle={`${kpis?.activeContracts ?? 0} active · ${kpis?.completedContracts ?? 0} completed`}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Financing contracts</CardTitle>
          <CardDescription className="text-xs">Rows: {contracts.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-3 h-7 w-7 opacity-60" />
              No PAYG / financing contracts found.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-gray-50">
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Overdue days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.facilityName || "Unknown facility"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{contract.customerId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{shortId(contract.id)}</TableCell>
                      <TableCell><StatusBadge status={contract.status} /></TableCell>
                      <TableCell className="text-right">{formatCurrency(toNumber(contract.principalIssued))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(toNumber(contract.amountPaid))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(toNumber(contract.outstandingBalance))}</TableCell>
                      <TableCell className="text-right">{contract.daysOverdue || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Repayment schedule</CardTitle>
          <CardDescription className="text-xs">Rows: {visibleSchedule.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleSchedule.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No repayment schedule entries found.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-gray-50">
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSchedule.slice(0, 100).map((entry) => {
                    const overdue =
                      entry.status !== "paid" && new Date(entry.dueDate).getTime() < Date.now()
                    const status = overdue ? "overdue" : entry.status
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.facilityName || "Unknown facility"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{entry.facilityId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(entry.dueDate)}</TableCell>
                        <TableCell className="font-mono text-xs">{shortId(entry.contractId)}</TableCell>
                        <TableCell><StatusBadge status={status} /></TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(toNumber(entry.amount))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(toNumber(entry.principal))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(toNumber(entry.interest))}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {visibleSchedule.length > 100 ? (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Showing 100 of {visibleSchedule.length} schedule entries.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
