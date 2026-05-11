"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Wallet,
  Calendar,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Banknote,
  TrendingDown,
  FileText,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { PaygRepaymentDialog } from "./payg-repayment-dialog"

interface FinancingContract {
  id: string
  customerId: string
  principalIssued: string | number
  interestRate: string | number
  amountPaid: string | number
  outstandingBalance: string | number
  daysOverdue: number
  status: "active" | "completed" | "defaulted"
  createdAt: string
  updatedAt: string
}

interface ScheduleEntry {
  id: string
  contractId: string
  dueDate: string
  amount: string | number
  principal: string | number
  interest: string | number
  status: "pending" | "paid" | "overdue"
  paidDate: string | null
}

interface SummaryResponse {
  contracts: FinancingContract[]
  schedule: ScheduleEntry[]
  kpis: {
    totalOutstanding: number
    nextDueAmount: number
    nextDueDate: string | null
    overdueCount: number
    activeContracts: number
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

interface PaygFinancingSectionProps {
  facilityId?: string
}

export function PaygFinancingSection({ facilityId }: PaygFinancingSectionProps) {
  const { data, isLoading, isError, refetch } = useQuery<SummaryResponse>({
    queryKey: ["payg-summary", facilityId],
    queryFn: async () => {
      const res = await fetch("/api/facility/payg-financing/summary", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to load PAYG summary")
      }
      return res.json()
    },
    refetchOnWindowFocus: false,
  })

  const [activeDialog, setActiveDialog] = useState<{
    contract: FinancingContract
    mode: "installment" | "full"
    amount: number
    targetEntryId: string | null
  } | null>(null)

  const contractsById = useMemo(() => {
    const m = new Map<string, FinancingContract>()
    for (const c of data?.contracts ?? []) m.set(c.id, c)
    return m
  }, [data])

  const nextEntryByContract = useMemo(() => {
    const m = new Map<string, ScheduleEntry>()
    if (!data?.schedule) return m
    const sorted = [...data.schedule].sort((a, b) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    for (const e of sorted) {
      if (e.status === "paid") continue
      if (!m.has(e.contractId)) m.set(e.contractId, e)
    }
    return m
  }, [data])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading PAYG &amp; Financing…
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center gap-3 text-muted-foreground">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <p>We couldn&apos;t load your PAYG &amp; Financing information.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const contracts = data?.contracts ?? []
  const schedule = data?.schedule ?? []
  const kpis = data?.kpis ?? {
    totalOutstanding: 0,
    nextDueAmount: 0,
    nextDueDate: null,
    overdueCount: 0,
    activeContracts: 0,
  }

  if (contracts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-green-600" />
            PAYG &amp; Financing
          </CardTitle>
          <CardDescription>
            Your PAYG / financing contracts and repayment schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-3 opacity-60" />
            <p className="font-medium text-foreground mb-1">
              No financing contracts yet
            </p>
            <p className="text-sm">
              When AfyaSolar issues you a PAYG or financing contract, it will
              appear here with repayment schedule and payment buttons.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Wallet className="w-4 h-4 text-blue-600" />}
          label="Total Outstanding"
          value={formatCurrency(kpis.totalOutstanding)}
          accent="blue"
        />
        <KpiCard
          icon={<Calendar className="w-4 h-4 text-emerald-600" />}
          label="Next Due"
          value={kpis.nextDueAmount > 0 ? formatCurrency(kpis.nextDueAmount) : "—"}
          subValue={kpis.nextDueDate ? formatDate(kpis.nextDueDate) : "No upcoming due"}
          accent="emerald"
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          label="Overdue"
          value={`${kpis.overdueCount}`}
          subValue={kpis.overdueCount === 1 ? "instalment" : "instalments"}
          accent="amber"
        />
        <KpiCard
          icon={<TrendingDown className="w-4 h-4 text-indigo-600" />}
          label="Active Contracts"
          value={`${kpis.activeContracts}`}
          subValue={contracts.length === kpis.activeContracts ? "All active" : `${contracts.length} total`}
          accent="indigo"
        />
      </div>

      {/* Contracts list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            My Financing Contracts
          </CardTitle>
          <CardDescription>
            Pay your next installment or settle the full outstanding balance
            via mobile money or bank transfer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contracts.map((contract) => {
            const principal = toNumber(contract.principalIssued)
            const paid = toNumber(contract.amountPaid)
            const outstanding = toNumber(contract.outstandingBalance)
            const interestRate = toNumber(contract.interestRate)
            const next = nextEntryByContract.get(contract.id) || null
            const nextAmount = next
              ? Math.min(toNumber(next.amount), outstanding)
              : 0
            const progress = principal > 0 ? Math.min(100, (paid / principal) * 100) : 0
            const isActive = contract.status === "active"
            const canPayInstallment = isActive && !!next && nextAmount > 0
            const canPayFull = isActive && outstanding > 0

            return (
              <div
                key={contract.id}
                className="rounded-lg border p-4 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">
                        Contract #{contract.id.slice(0, 8).toUpperCase()}
                      </p>
                      <StatusBadge status={contract.status} />
                      {contract.daysOverdue > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {contract.daysOverdue}d overdue
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Started {formatDate(contract.createdAt)} • Interest {interestRate.toFixed(2)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(outstanding)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Paid {formatCurrency(paid)} of {formatCurrency(principal)}
                    </span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={() => {
                      if (!next) return
                      setActiveDialog({
                        contract,
                        mode: "installment",
                        amount: nextAmount,
                        targetEntryId: next.id,
                      })
                    }}
                    disabled={!canPayInstallment}
                    size="sm"
                  >
                    Pay next installment
                    {canPayInstallment ? ` (${formatCurrency(nextAmount)})` : ""}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setActiveDialog({
                        contract,
                        mode: "full",
                        amount: outstanding,
                        targetEntryId: null,
                      })
                    }
                    disabled={!canPayFull}
                    size="sm"
                  >
                    Pay full outstanding ({formatCurrency(outstanding)})
                  </Button>
                  {contract.status === "completed" && (
                    <Badge variant="outline" className="ml-1 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Fully repaid
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Repayment schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedule</CardTitle>
          <CardDescription>
            Upcoming and past installments across all your contracts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No repayment entries yet.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <tr className="border-b">
                    <th className="px-2 py-2 font-medium">Due Date</th>
                    <th className="px-2 py-2 font-medium">Contract</th>
                    <th className="px-2 py-2 font-medium text-right">Amount</th>
                    <th className="px-2 py-2 font-medium text-right">Principal</th>
                    <th className="px-2 py-2 font-medium text-right">Interest</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.slice(0, 30).map((entry) => {
                    const dueTime = new Date(entry.dueDate).getTime()
                    const isOverdue =
                      entry.status !== "paid" && dueTime < Date.now()
                    const effectiveStatus = isOverdue ? "overdue" : entry.status
                    const contract = contractsById.get(entry.contractId)
                    return (
                      <tr
                        key={entry.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-2 py-2 whitespace-nowrap">
                          {formatDate(entry.dueDate)}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs">
                          {contract ? `#${entry.contractId.slice(0, 8).toUpperCase()}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatCurrency(toNumber(entry.amount))}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatCurrency(toNumber(entry.principal))}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatCurrency(toNumber(entry.interest))}
                        </td>
                        <td className="px-2 py-2">
                          <ScheduleStatusBadge status={effectiveStatus} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {schedule.length > 30 && (
                <p className="text-xs text-muted-foreground mt-2 px-2">
                  Showing 30 of {schedule.length} entries.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {activeDialog && (
        <PaygRepaymentDialog
          open={Boolean(activeDialog)}
          onOpenChange={(open) => {
            if (!open) setActiveDialog(null)
          }}
          contractId={activeDialog.contract.id}
          contractShortId={activeDialog.contract.id.slice(0, 8).toUpperCase()}
          mode={activeDialog.mode}
          amount={activeDialog.amount}
          onPaymentComplete={() => {
            setActiveDialog(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  subValue,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  accent: "blue" | "emerald" | "amber" | "indigo"
}) {
  const ring = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
    indigo: "bg-indigo-50 border-indigo-100",
  }[accent]
  return (
    <Card className={cn("border", ring)}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-1 text-xl font-bold">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: FinancingContract["status"] }) {
  if (status === "completed") {
    return (
      <Badge variant="outline" className="text-xs text-green-700 border-green-300">
        Completed
      </Badge>
    )
  }
  if (status === "defaulted") {
    return (
      <Badge variant="destructive" className="text-xs">
        Defaulted
      </Badge>
    )
  }
  return (
    <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
      Active
    </Badge>
  )
}

function ScheduleStatusBadge({
  status,
}: {
  status: ScheduleEntry["status"] | "overdue"
}) {
  if (status === "paid") {
    return (
      <Badge variant="outline" className="text-xs text-green-700 border-green-300">
        Paid
      </Badge>
    )
  }
  if (status === "overdue") {
    return (
      <Badge variant="destructive" className="text-xs">
        Overdue
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs">
      Pending
    </Badge>
  )
}
