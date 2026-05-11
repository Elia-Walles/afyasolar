"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Smartphone,
  CreditCard,
  DollarSign,
} from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

interface PaygRepaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  contractShortId: string
  mode: "installment" | "full"
  amount: number
  onPaymentComplete?: () => void
}

const mobileProviders = [
  { value: "Mpesa", label: "M-Pesa", logo: "/images/services/mpesa.png" },
  { value: "Airtel", label: "Airtel Money", logo: "/images/services/aitel money logo.png" },
  { value: "Tigo", label: "Mixx by Yas", logo: "/images/services/mixx by yas.png" },
  { value: "Halopesa", label: "Halo Pesa", logo: "/images/services/halopesa.png" },
]

const banks = [
  {
    value: "NMB",
    label: "NMB Bank",
    logo: "/images/services/nmb.png",
    otpInstructions:
      "Dial *150*66# → Press 8 (More) → Press 5 (Register Sarafu) → Press 1 (Select Account No.)",
  },
  {
    value: "CRDB",
    label: "CRDB Bank",
    logo: "/images/services/crdb.png",
    otpInstructions:
      "Dial *150*03# → Enter SIM Banking PIN → Press 7 (Other services) → Press 5 (Azampay) → Link Azampay Account",
  },
]

export function PaygRepaymentDialog({
  open,
  onOpenChange,
  contractId,
  contractShortId,
  mode,
  amount,
  onPaymentComplete,
}: PaygRepaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<"mobile" | "bank">("mobile")
  const [mobile, setMobile] = useState("")
  const [provider, setProvider] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [selectedBank, setSelectedBank] = useState("")
  const [bankMobile, setBankMobile] = useState("")
  const [otp, setOtp] = useState("")
  const [transactionId, setTransactionId] = useState<string | null>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTransactionId(null)
    }
  }, [open])

  const initiateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        serviceName: "payg-financing",
        paygContractId: contractId,
        paygRepaymentMode: mode,
        paymentType,
      }
      if (paymentType === "mobile") {
        payload.mobile = mobile.replace(/\s/g, "")
        payload.provider = provider
      } else {
        payload.accountNumber = accountNumber
        payload.selectedBank = selectedBank
        payload.bankMobile = bankMobile.replace(/\s/g, "")
        payload.otp = otp
      }
      const res = await fetch("/api/payments/azam-pay/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Payment initiation failed")
      }
      return res.json()
    },
    onSuccess: (data) => {
      const txId =
        data?.payment?.externalId ||
        data?.payment?.transactionId ||
        data?.transactionId
      if (txId) {
        setTransactionId(txId)
        toast.success(
          "Payment initiated. Check your phone and enter the PIN to confirm.",
        )
      } else {
        toast.error("Payment initiated but no reference returned. Please contact support.")
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to initiate payment.")
    },
  })

  // Poll payment status
  const { data: paymentStatus } = useQuery({
    queryKey: ["payg-payment-status", transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      if (!transactionId) return null
      const res = await fetch(
        `/api/payments/azam-pay/callback?transactionId=${transactionId}`,
        { method: "GET", cache: "no-store", credentials: "include" },
      )
      if (!res.ok) return null
      const data = await res.json()
      return data.payment || data.transaction || null
    },
    refetchInterval: (query) => {
      const p = query.state.data as { status?: string } | null
      if (!p) return 3000
      if (p.status === "completed" || p.status === "failed") return false
      return 3000
    },
    retry: 3,
    retryDelay: 1500,
  })

  useEffect(() => {
    if (!paymentStatus) return
    if (paymentStatus.status === "completed") {
      toast.success("Payment completed. Your contract has been updated.")
      const t = setTimeout(() => {
        onOpenChange(false)
        onPaymentComplete?.()
      }, 800)
      return () => clearTimeout(t)
    }
    if (paymentStatus.status === "failed") {
      toast.error(paymentStatus?.statusMessage || "Payment failed. Please try again.")
      setTransactionId(null)
    }
  }, [paymentStatus, onOpenChange, onPaymentComplete])

  const isProcessing =
    initiateMutation.isPending ||
    (paymentStatus &&
      ["pending", "awaiting_confirmation", "processing", "initiated"].includes(
        paymentStatus.status,
      ))
  const showWaitingState = Boolean(isProcessing && transactionId)
  const isCompleted = paymentStatus?.status === "completed"
  const isFailed = paymentStatus?.status === "failed"

  const handleDialogOpenChange = (next: boolean) => {
    if (!next && showWaitingState) {
      toast.info(
        "Please wait for the payment to confirm or fail before closing.",
      )
      return
    }
    onOpenChange(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (paymentType === "mobile") {
      if (!mobile || !provider) {
        toast.error("Please enter mobile number and select provider")
        return
      }
      const mobileRegex = /^(\+255|0)?[67]\d{8}$/
      if (!mobileRegex.test(mobile.replace(/\s/g, ""))) {
        toast.error("Please enter a valid Tanzania mobile number")
        return
      }
    } else {
      if (!accountNumber || !selectedBank) {
        toast.error("Please select bank and enter account number")
        return
      }
      if (!bankMobile) {
        toast.error("Please enter the mobile number linked to your bank account")
        return
      }
      const bankMobileRegex = /^(\+255|0)?[67]\d{8}$/
      if (!bankMobileRegex.test(bankMobile.replace(/\s/g, ""))) {
        toast.error("Please enter a valid Tanzania mobile number for bank")
        return
      }
      if (!otp || otp.length < 4) {
        toast.error("Please enter a valid OTP (at least 4 digits)")
        return
      }
    }

    initiateMutation.mutate()
  }

  const selectedBankInfo = banks.find((b) => b.value === selectedBank)

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[520px] max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <span className="leading-tight">
              {mode === "installment"
                ? "Pay Next Installment"
                : "Pay Full Outstanding"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-1.5">
            Contract #{contractShortId} — paying{" "}
            <span className="font-semibold">{formatCurrency(amount)}</span>{" "}
            {mode === "installment"
              ? "for the next installment."
              : "to settle this contract in full."}
          </DialogDescription>
        </DialogHeader>

        {showWaitingState ? (
          <div className="pt-6 space-y-4 text-center">
            <div className="relative inline-flex">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {paymentStatus?.status === "awaiting_confirmation"
                  ? "Check your phone"
                  : "Processing payment"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentStatus?.status === "awaiting_confirmation"
                  ? "Enter your PIN on your phone to confirm the payment."
                  : "Please wait while we confirm your payment with the provider."}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-left text-xs text-blue-800 space-y-1">
              <p className="font-semibold">Important:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Do not close this window</li>
                <li>Enter your PIN when prompted</li>
                <li>You will be notified once payment is confirmed</li>
              </ul>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-bold">Payment Confirmed</h3>
            <p className="text-sm text-muted-foreground">
              Your repayment of {formatCurrency(amount)} has been applied to
              contract #{contractShortId}.
            </p>
          </div>
        ) : isFailed ? (
          <div className="pt-6 text-center space-y-3">
            <XCircle className="h-12 w-12 text-red-600 mx-auto" />
            <h3 className="text-lg font-bold">Payment Failed</h3>
            <p className="text-sm text-muted-foreground">
              {paymentStatus?.statusMessage || "Please try again."}
            </p>
            <Button
              variant="outline"
              onClick={() => setTransactionId(null)}
            >
              Retry
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-5">
            <div className="rounded-lg bg-muted/30 border p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount due</span>
              <span className="text-lg font-bold tabular-nums">
                {formatCurrency(amount)}
              </span>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">
                Payment method
              </Label>
              <RadioGroup
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as "mobile" | "bank")}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${
                    paymentType === "mobile" ? "border-blue-500 bg-blue-50" : ""
                  }`}
                >
                  <RadioGroupItem value="mobile" id="payg-mobile" />
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Mobile Money</span>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${
                    paymentType === "bank" ? "border-blue-500 bg-blue-50" : ""
                  }`}
                >
                  <RadioGroupItem value="bank" id="payg-bank" />
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Bank Transfer</span>
                </label>
              </RadioGroup>
            </div>

            {paymentType === "mobile" ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payg-provider" className="text-sm">
                    Mobile money provider
                  </Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger id="payg-provider" className="mt-1">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {mobileProviders.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className="flex items-center gap-2">
                            <Image
                              src={p.logo}
                              alt={p.label}
                              width={20}
                              height={20}
                              className="rounded"
                            />
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payg-mobile-number" className="text-sm">
                    Mobile number
                  </Label>
                  <Input
                    id="payg-mobile-number"
                    type="tel"
                    placeholder="e.g. 0712345678 or +255712345678"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payg-bank" className="text-sm">
                    Bank
                  </Label>
                  <Select
                    value={selectedBank}
                    onValueChange={setSelectedBank}
                  >
                    <SelectTrigger id="payg-bank" className="mt-1">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          <span className="flex items-center gap-2">
                            <Image
                              src={b.logo}
                              alt={b.label}
                              width={20}
                              height={20}
                              className="rounded"
                            />
                            {b.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payg-account" className="text-sm">
                    Account number
                  </Label>
                  <Input
                    id="payg-account"
                    placeholder="Bank account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="payg-bank-mobile" className="text-sm">
                    Mobile number linked to bank
                  </Label>
                  <Input
                    id="payg-bank-mobile"
                    type="tel"
                    placeholder="e.g. 0712345678"
                    value={bankMobile}
                    onChange={(e) => setBankMobile(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="payg-otp" className="text-sm">
                    OTP from bank
                  </Label>
                  <Input
                    id="payg-otp"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="mt-1"
                  />
                  {selectedBankInfo && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {selectedBankInfo.otpInstructions}
                    </p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={initiateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={initiateMutation.isPending}
              >
                {initiateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initiating…
                  </>
                ) : (
                  <>Pay {formatCurrency(amount)}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
