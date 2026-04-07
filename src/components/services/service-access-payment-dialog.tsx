"use client"

import { useState, useEffect } from "react"
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
import { Loader2, DollarSign, CheckCircle2, XCircle, Calendar, CreditCard, Smartphone, Info, FileText } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { formatCurrency, cn } from "@/lib/utils"
import { useAfyaSolarAutoSubscriber } from "@/hooks/use-afyasolar-auto-subscriber"

interface ServiceAccessPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceName: "afya-solar" | "equipment-resale"
  serviceDisplayName: string
  amount: number
  onPaymentComplete?: () => void
  // For Afya Solar: package selection details
  packageId?: string
  packageName?: string
  paymentPlan?: "cash" | "installment" | "paas"
  packageMetadata?: Record<string, any>
  // For Equipment Resale: resale item ID
  resaleItemId?: string
}

const mobileProviders = [
  { value: "Mpesa", label: "M-Pesa", logo: "/images/services/mpesa.png" },
  { value: "Airtel", label: "Airtel Money", logo: "/images/services/aitel money logo.png" },
  { value: "Tigo", label: "Mixx by Yas", logo: "/images/services/mixx by yas.png" },
  { value: "Halopesa", label: "Halo Pesa", logo: "/images/services/halopesa.png" },
]

// Only NMB and CRDB are supported by Azam Pay
const banks = [
  { 
    value: "NMB", 
    label: "NMB Bank", 
    logo: "/images/services/nmb.png",
    otpInstructions: "Dial *150*66# → Press 8 (More) → Press 5 (Register Sarafu) → Press 1 (Select Account No.)"
  },
  { 
    value: "CRDB", 
    label: "CRDB Bank", 
    logo: "/images/services/crdb.png",
    otpInstructions: "Dial *150*03# → Enter SIM Banking PIN → Press 7 (Other services) → Press 5 (Azampay) → Link Azampay Account"
  },
]

export function ServiceAccessPaymentDialog({
  open,
  onOpenChange,
  serviceName,
  serviceDisplayName,
  amount,
  onPaymentComplete,
  packageId,
  packageName,
  paymentPlan,
  packageMetadata,
  resaleItemId,
}: ServiceAccessPaymentDialogProps) {
  const router = useRouter()
  const [paymentType, setPaymentType] = useState<"mobile" | "bank" | "invoice">("mobile")
  const [mobile, setMobile] = useState<string>("")
  const [provider, setProvider] = useState<string>("")
  const [accountNumber, setAccountNumber] = useState<string>("")
  const [selectedBank, setSelectedBank] = useState<string>("")
  const [transactionId, setTransactionId] = useState<string | null>(null)
  
  // Afya Solar auto-subscriber hook
  const createSubscriberMutation = useAfyaSolarAutoSubscriber()
  
  // Bank payment specific fields
  const [bankMobile, setBankMobile] = useState<string>("") // Mobile number linked to bank account
  const [otp, setOtp] = useState<string>("") // OTP for bank verification
  
  const getPaymentAmount = (): number => amount

  // Submit invoice request (Pay By Invoice) for Afya Solar
  const invoiceRequestMutation = useMutation({
    mutationFn: async () => {
      const endpoint = "/api/afya-solar/invoice-requests"
      
      const requestBody = {
        packageId: packageId ?? "",
        packageName: packageName ?? "",
        paymentPlan: paymentPlan ?? "cash",
        amount: getPaymentAmount(),
        currency: "TZS",
        packageMetadata: packageMetadata ?? {},
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit invoice request")
      }
      return data
    },
    onSuccess: () => {
      toast.success("Invoice request submitted. Our team will send the invoice to your email.")
      onOpenChange(false)
      if (onPaymentComplete) {
        onPaymentComplete()
      }
      if (serviceName === "afya-solar") {
        router.push("/services/afya-solar")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit invoice request.")
    },
  })

  // Initiate payment mutation
  const initiatePaymentMutation = useMutation({
    mutationFn: async (data: {
      serviceName: string
      amount: number
      mobile?: string
      accountNumber?: string
      provider?: string
      paymentType: "mobile" | "bank"
      selectedBank?: string
      packageId?: string
      packageName?: string
      paymentPlan?: "cash" | "installment" | "paas"
      packageMetadata?: Record<string, any> | string
      resaleItemId?: string
      // Bank payment specific fields
      bankMobile?: string
      otp?: string
    }) => {
      const response = await fetch("/api/payments/azam-pay/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Payment initiation failed")
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Set transaction ID to trigger waiting state
      // Use externalId for polling (this is what's stored in serviceAccessPayments)
      const txId = data.payment?.externalId || data.payment?.transactionId || data.transactionId
      if (txId) {
        setTransactionId(txId)
        toast.success("Payment initiated! Please check your phone and enter your PIN when prompted.")
      } else {
        console.error("No transaction ID in response:", data)
        toast.error("Payment initiated but transaction ID not found. Please contact support.")
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to initiate payment. Please try again.")
    },
  })

  // Poll payment status - AJAX polling to check database status
  const { data: paymentStatus } = useQuery({
    queryKey: ["payment-status", transactionId],
    queryFn: async () => {
      if (!transactionId) return null
      try {
        const response = await fetch(
          `/api/payments/azam-pay/callback?transactionId=${transactionId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store', // Always fetch fresh data
          }
        )
        if (!response.ok) {
          console.error('Failed to fetch payment status:', response.status)
          return null
        }
        const data = await response.json()
        // Return payment status from database
        return data.payment || data.transaction || null
      } catch (error) {
        console.error('Error fetching payment status:', error)
        return null
      }
    },
    enabled: !!transactionId,
    refetchInterval: (query) => {
      const payment = query.state.data
      // Stop polling only if payment is completed or failed
      if (payment?.status === "completed" || payment?.status === "failed") {
        return false
      }
      // Continue polling for: pending, awaiting_confirmation, processing, initiated
      // Poll every 2 seconds for faster updates
      return 2000
    },
    // Retry on error
    retry: 3,
    retryDelay: 1000,
  })

  // Track if SMS has been sent for this transaction
  const [smsSent, setSmsSent] = useState(false)

  // Send SMS when payment status changes to completed (AJAX triggered)
  useEffect(() => {
    if (paymentStatus?.status === "completed" && !smsSent && transactionId) {
      // Send SMS notification immediately when status becomes completed
      const sendCompletionSMS = async () => {
        try {
          console.log('[PaymentDialog] Payment completed, sending SMS notification...')
          const response = await fetch('/api/payments/send-completion-sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactionId: transactionId,
              externalId: paymentStatus.externalId || paymentStatus.transactionId,
            }),
          })
          
          const text = await response.text()
          let result: { success?: boolean; error?: string } = {}
          try {
            result = text ? JSON.parse(text) : {}
          } catch {
            result = { success: false, error: response.ok ? 'Invalid response' : `Request failed: ${response.status}` }
          }
          if (result.success) {
            console.log('[PaymentDialog] ✅ SMS sent successfully')
            setSmsSent(true)
          } else if (result.error) {
            console.warn('[PaymentDialog] SMS not sent:', result.error)
          }
        } catch (error) {
          console.warn('[PaymentDialog] Send completion SMS failed:', error)
          // Don't fail the payment flow if SMS fails
        }
      }
      
      sendCompletionSMS()
    }
  }, [paymentStatus?.status, transactionId, smsSent])

  // Handle payment status updates - only allow access when status is completed
  useEffect(() => {
    if (paymentStatus?.status === "completed") {
      // Payment completed - show success message
      toast.success("Payment completed successfully! Redirecting to dashboard...")
      
      // Create Afya Solar subscriber record if this is an Afya Solar payment
      if (serviceName === "afya-solar" && packageId && packageName) {
        const session = JSON.parse(localStorage.getItem('session') || '{}')
        const facilityId = session?.user?.facilityId
        
        if (facilityId) {
          createSubscriberMutation.mutateAsync({
            facilityId,
            facilityName: session?.user?.facilityName || 'Unknown Facility',
            facilityEmail: session?.user?.email || '',
            facilityPhone: session?.user?.phone || '',
            packageId,
            packageName,
            packageCode: packageId,
            packageRatedKw: packageMetadata?.ratedKw || 0,
            planType: paymentPlan === 'cash' ? 'CASH' : paymentPlan === 'installment' ? 'INSTALLMENT' : 'PAAS',
            totalPackagePrice: packageMetadata?.trueCost || 0,
            paymentMethod: paymentType === 'mobile' ? 'MNO' : paymentType === 'bank' ? 'BANK' : 'INVOICE'
          }).catch(error => {
            console.error('Failed to create Afya Solar subscriber record:', error)
          })
        }
      }
      
      // Short delay before redirecting to show success message
      setTimeout(() => {
        // Close dialog first
        onOpenChange(false)
        // Call payment complete callback to update parent state
        if (onPaymentComplete) {
          onPaymentComplete()
        }
        // Reset transaction state
        setTransactionId(null)
        setSmsSent(false) // Reset SMS sent flag
        
        // Redirect to service dashboard
        if (serviceName === "afya-solar") {
          router.push("/services/afya-solar")
        } else if (serviceName === "equipment-resale") {
          // For equipment resale, just close dialog and refresh - no redirect needed
          // The parent component will handle refreshing the inventory
        }
      }, 500)
    } else if (paymentStatus?.status === "failed") {
      toast.error(paymentStatus?.statusMessage || "Payment failed. Please try again.")
      // Reset transaction state but keep dialog open so user can retry
      setTransactionId(null)
      setSmsSent(false) // Reset SMS sent flag
    }
  }, [paymentStatus, serviceName, router, onPaymentComplete, onOpenChange])

  // Close dialog immediately if payment is already completed when dialog opens
  useEffect(() => {
    if (open && paymentStatus?.status === "completed") {
      // Payment already completed, close dialog immediately
      onOpenChange(false)
      if (onPaymentComplete) {
        onPaymentComplete()
      }
    }
  }, [open, paymentStatus?.status, onOpenChange, onPaymentComplete])

  // Prevent dialog from closing while payment is in progress
  const handleDialogOpenChange = (open: boolean) => {
    // Don't allow closing if payment is in progress
    if (!open && showWaitingState) {
      toast.info("Please wait for the payment to complete or fail before closing. Do not close this window while waiting for PIN confirmation.")
      return
    }
    onOpenChange(open)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (paymentType === "mobile") {
      if (!mobile || !provider) {
        toast.error("Please enter mobile number and select provider")
        return
      }
      // Validate mobile number format (Tanzania: 10 digits starting with 0 or +255)
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
      // Validate bank mobile number format
      const bankMobileRegex = /^(\+255|0)?[67]\d{8}$/
      if (!bankMobileRegex.test(bankMobile.replace(/\s/g, ""))) {
        toast.error("Please enter a valid Tanzania mobile number for bank")
        return
      }
      if (!otp) {
        toast.error("Please enter the OTP from your bank")
        return
      }
      if (otp.length < 4) {
        toast.error("Please enter a valid OTP (at least 4 digits)")
        return
      }
    }

    const finalAmount = getPaymentAmount()
    
    initiatePaymentMutation.mutate({
      serviceName,
      amount: finalAmount,
      mobile: paymentType === "mobile" ? mobile.replace(/\s/g, "") : undefined,
      accountNumber: paymentType === "bank" ? accountNumber : undefined,
      provider: paymentType === "mobile" ? provider : undefined,
      paymentType: paymentType as "mobile" | "bank",
      selectedBank: paymentType === "bank" ? selectedBank : undefined,
      // Bank payment specific fields
      bankMobile: paymentType === "bank" ? bankMobile.replace(/\s/g, "") : undefined,
      otp: paymentType === "bank" ? otp : undefined,
      // Package selection details (for Afya Solar)
      packageId,
      packageName,
      paymentPlan,
      ...(packageMetadata && { packageMetadata }),
      // Resale item ID for Equipment Resale
      ...(serviceName === "equipment-resale" && { resaleItemId }),
    })
  }

  // Payment is processing if: mutation is pending OR status is pending/awaiting_confirmation/processing/initiated
  const isProcessing = initiatePaymentMutation.isPending || 
    (paymentStatus && (
      paymentStatus.status === "pending" || 
      paymentStatus.status === "awaiting_confirmation" || 
      paymentStatus.status === "processing" ||
      paymentStatus.status === "initiated"
    ))

  // Show waiting state UI (hide form when payment is initiated)
  const showWaitingState = isProcessing && transactionId !== null
  const showPaymentForm = !showWaitingState

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 sm:pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <span className="leading-tight">
              Complete Payment for{" "}
              {packageName ? `${packageName} Package` : serviceDisplayName}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-1.5 sm:mt-2">
            Please complete the payment to access {packageName ? `${packageName} package` : `${serviceDisplayName} service`}.
          </DialogDescription>
        </DialogHeader>

        {/* Waiting State - Show when payment is initiated */}
        {showWaitingState ? (
          <div className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6 py-6 sm:py-8">
              {/* Animated Spinner */}
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
              </div>

              {/* Status Message */}
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {paymentStatus?.status === "awaiting_confirmation" 
                    ? "Waiting for PIN Entry" 
                    : paymentStatus?.status === "processing"
                    ? "Processing Payment"
                    : paymentStatus?.status === "initiated"
                    ? "Payment Initiated"
                    : "Waiting for Payment"}
                </h3>
                
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 sm:p-6 max-w-md">
                  <div className="space-y-3 sm:space-y-4">
                    {paymentStatus?.status === "awaiting_confirmation" ? (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-lg sm:text-xl">📱</span>
                            </div>
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm sm:text-base font-semibold text-blue-900 mb-1">
                              Check Your Phone
                            </p>
                            <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
                              A PIN prompt has been sent to your mobile phone. Please check your phone and enter your PIN to complete the payment.
                            </p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 sm:p-4 border border-blue-200">
                          <p className="text-xs sm:text-sm text-gray-700 font-medium mb-2">
                            ⚠️ Important:
                          </p>
                          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                            <li>Do not close this window</li>
                            <li>Enter your PIN on your phone when prompted</li>
                            <li>Wait for confirmation</li>
                            <li>You will be redirected automatically once payment is confirmed</li>
                          </ul>
                        </div>
                      </>
                    ) : paymentStatus?.status === "processing" ? (
                      <div className="flex items-start gap-3">
                        <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-left">
                          <p className="text-sm sm:text-base font-semibold text-blue-900 mb-1">
                            Processing Your Payment
                          </p>
                          <p className="text-xs sm:text-sm text-blue-700">
                            Your payment is being processed. Please wait while we confirm your transaction...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-left">
                          <p className="text-sm sm:text-base font-semibold text-blue-900 mb-1">
                            Payment Initiated
                          </p>
                          <p className="text-xs sm:text-sm text-blue-700">
                            Your payment request has been sent. Waiting for confirmation...
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction Info */}
                {transactionId && (
                  <div className="text-xs sm:text-sm text-gray-500 space-y-1">
                    <p>Transaction ID: <span className="font-mono font-semibold">{transactionId}</span></p>
                    <p className="text-xs">This page will automatically update when payment is confirmed</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
          {/* Payment Amount Summary */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-medium text-gray-700">
                {"Access Fee:"}
              </span>
              <span className="text-xl sm:text-2xl font-bold text-green-600">
                {formatCurrency(getPaymentAmount())}
              </span>
            </div>
          </div>

          {/* Payment Type Selection */}
          <div className="space-y-2 sm:space-y-3">
            <Label className="text-sm sm:text-base font-semibold">Payment Method <span className="text-red-500">*</span></Label>
            {serviceName === "afya-solar" && (
              <p className="text-xs text-muted-foreground">Choose one: Mobile Money, Bank Transfer, or Pay By Invoice.</p>
            )}
            <div className={cn(
              "grid gap-2 sm:gap-3",
              serviceName === "afya-solar" ? "grid-cols-1 min-[400px]:grid-cols-3" : "grid-cols-2"
            )}>
              <button
                type="button"
                onClick={() => setPaymentType("mobile")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border-2 transition-all",
                  paymentType === "mobile"
                    ? "border-green-500 bg-green-50 shadow-md"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                )}
              >
                <Smartphone className={cn("h-5 w-5 sm:h-6 sm:w-6", paymentType === "mobile" ? "text-green-600" : "text-gray-400")} />
                <span className={cn("text-xs sm:text-sm font-medium", paymentType === "mobile" ? "text-green-700" : "text-gray-600")}>
                  Mobile Money
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("bank")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border-2 transition-all",
                  paymentType === "bank"
                    ? "border-green-500 bg-green-50 shadow-md"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                )}
              >
                <CreditCard className={cn("h-5 w-5 sm:h-6 sm:w-6", paymentType === "bank" ? "text-green-600" : "text-gray-400")} />
                <span className={cn("text-xs sm:text-sm font-medium", paymentType === "bank" ? "text-green-700" : "text-gray-600")}>
                  Bank Transfer
                </span>
              </button>
              {serviceName === "afya-solar" && (
                <button
                  type="button"
                  onClick={() => setPaymentType("invoice")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border-2 transition-all",
                    paymentType === "invoice"
                      ? "border-green-500 bg-green-50 shadow-md"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                >
                  <FileText className={cn("h-5 w-5 sm:h-6 sm:w-6", paymentType === "invoice" ? "text-green-600" : "text-gray-400")} />
                  <span className={cn("text-xs sm:text-sm font-medium text-center", paymentType === "invoice" ? "text-green-700" : "text-gray-600")}>
                    Pay By Invoice
                  </span>
                </button>
              )}
            </div>
          </div>

          {paymentType === "invoice" ? (
            <>
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">Invoice request</p>
                    <p className="text-xs text-green-800 mt-0.5">
                      Your request will be sent to our team. We will prepare an invoice and send it to your facility email. You can pay by bank transfer or other agreed terms.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto h-10 text-sm sm:text-base"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => invoiceRequestMutation.mutate()}
                  disabled={invoiceRequestMutation.isPending}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold h-10 text-sm sm:text-base"
                >
                  {invoiceRequestMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Submit Invoice Request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : paymentType === "mobile" ? (
            <>
              {/* Mobile Money Provider Selection */}
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm sm:text-base font-semibold">
                  Select Mobile Money Provider <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {mobileProviders.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setProvider(p.value)}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[85px] sm:min-h-[100px]",
                        provider === p.value
                          ? "border-green-500 bg-green-50 shadow-md scale-105"
                          : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                      )}
                    >
                      {provider === p.value && (
                        <CheckCircle2 className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-4 w-4 sm:h-5 sm:w-5 text-green-600 bg-white rounded-full" />
                      )}
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14">
                        <Image
                          src={p.logo}
                          alt={p.label}
                          fill
                          className="object-contain"
                          sizes="(max-width: 640px) 48px, 56px"
                        />
                      </div>
                      <span className={cn(
                        "text-[10px] sm:text-xs font-medium text-center leading-tight px-0.5",
                        provider === p.value ? "text-green-700 font-semibold" : "text-gray-600"
                      )}>
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Number Input */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="mobile" className="text-sm sm:text-base font-semibold">
                  Mobile Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="e.g., 0712345678 or +255712345678"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  className="h-10 sm:h-12 text-sm sm:text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your mobile number (Tanzania format: 0712345678 or +255712345678)
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Bank Selection */}
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm sm:text-base font-semibold">
                  Select Bank <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {banks.map((bank) => (
                    <button
                      key={bank.value}
                      type="button"
                      onClick={() => setSelectedBank(bank.value)}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg border-2 transition-all min-h-[85px] sm:min-h-[100px]",
                        selectedBank === bank.value
                          ? "border-green-500 bg-green-50 shadow-md scale-105"
                          : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                      )}
                    >
                      {selectedBank === bank.value && (
                        <CheckCircle2 className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-4 w-4 sm:h-5 sm:w-5 text-green-600 bg-white rounded-full" />
                      )}
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14">
                        <Image
                          src={bank.logo}
                          alt={bank.label}
                          fill
                          className="object-contain"
                          sizes="(max-width: 640px) 48px, 56px"
                        />
                      </div>
                      <span className={cn(
                        "text-[10px] sm:text-xs font-medium text-center leading-tight px-0.5",
                        selectedBank === bank.value ? "text-green-700 font-semibold" : "text-gray-600"
                      )}>
                        {bank.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* OTP Instructions */}
              {selectedBank && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium text-blue-900">
                        How to get your OTP for {banks.find(b => b.value === selectedBank)?.label}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {banks.find(b => b.value === selectedBank)?.otpInstructions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Number Input */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="accountNumber" className="text-sm sm:text-base font-semibold">
                  Account Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="accountNumber"
                  placeholder="Enter your bank account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                  className="h-10 sm:h-12 text-sm sm:text-base"
                />
              </div>

              {/* Mobile Number Linked to Bank */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="bankMobile" className="text-sm sm:text-base font-semibold">
                  Mobile Number (linked to bank) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="bankMobile"
                  type="tel"
                  placeholder="e.g., 0712345678 or +255712345678"
                  value={bankMobile}
                  onChange={(e) => setBankMobile(e.target.value)}
                  required
                  className="h-10 sm:h-12 text-sm sm:text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the mobile number registered with your bank account
                </p>
              </div>

              {/* OTP Input */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="otp" className="text-sm sm:text-base font-semibold">
                  OTP (One-Time Password) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter OTP from your bank"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  maxLength={8}
                  className="h-10 sm:h-12 text-sm sm:text-base tracking-widest font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Follow the instructions above to generate your OTP
                </p>
              </div>
            </>
          )}

            {/* Payment Status Messages - Only show for mobile/bank, not invoice */}
            {paymentType !== "invoice" && paymentStatus?.status === "failed" && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium text-red-900">
                      Payment failed
                    </p>
                    <p className="text-xs text-red-700 mt-0.5 sm:mt-1">
                      {paymentStatus?.statusMessage || "Please check your details and try again."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {paymentType !== "invoice" && (
            <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (isProcessing) {
                    toast.info("Please wait for the payment to complete or fail before closing.")
                  } else {
                    onOpenChange(false)
                  }
                }}
                disabled={isProcessing}
                className="w-full sm:w-auto h-10 text-sm sm:text-base"
              >
                {isProcessing ? "Payment in Progress..." : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || (paymentType === "mobile" && (!mobile || !provider)) || (paymentType === "bank" && (!accountNumber || !selectedBank || !bankMobile || !otp))}
                className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold h-10 text-sm sm:text-base"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-xs sm:text-sm">Processing...</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    <span className="text-xs sm:text-sm">Pay {formatCurrency(getPaymentAmount())}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
