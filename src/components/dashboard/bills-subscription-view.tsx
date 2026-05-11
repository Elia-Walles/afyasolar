"use client"

import { useMemo } from "react"
import {
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileText,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, cn } from "@/lib/utils"

const DEFAULT_PANEL_CARD_CLASS = "shadow-sm border border-gray-100 bg-white"
const DEFAULT_SECTION_TITLE_CLASS = "text-base font-semibold text-gray-900"
const DEFAULT_META_TEXT_CLASS = "text-xs text-gray-500"

export interface BillsSubscriptionViewProps {
  /** Afya Solar subscriber record for the facility. */
  afyaSolarSubscriber: any | null
  /** Facility energy bills (utility bills). */
  bills?: any[] | null
  /** Service access payment rows for "afya-solar". */
  serviceAccessPayments?: any[] | null
  /** Afya Solar invoice requests (admin-approved billing). */
  invoiceRequests?: any[] | null
  /** Facility record (creditBalance, monthlyConsumption, paymentModel). */
  facility?: any | null
  /** Show "Pay Now" CTA buttons (facility user only). */
  canShowPayNow?: boolean
  /** Called when a "Pay Now" button is clicked. */
  onPayClick?: () => void
  /** Render the "Refresh" CTA in the empty-state card. */
  onReload?: () => void
  /** Render the "Go to Afya Solar" CTA in the empty-state card. */
  onNavigateToAfyaSolar?: () => void
  /** Style overrides so the view inherits the parent dashboard look. */
  panelCardClass?: string
  sectionTitleClass?: string
  metaTextClass?: string
}

export function BillsSubscriptionView({
  afyaSolarSubscriber,
  bills,
  serviceAccessPayments,
  invoiceRequests,
  facility,
  canShowPayNow = false,
  onPayClick,
  onReload,
  onNavigateToAfyaSolar,
  panelCardClass = DEFAULT_PANEL_CARD_CLASS,
  sectionTitleClass = DEFAULT_SECTION_TITLE_CLASS,
  metaTextClass = DEFAULT_META_TEXT_CLASS,
}: BillsSubscriptionViewProps) {
  const safeBills = bills ?? []
  const safeServiceAccessPayments = serviceAccessPayments ?? []
  const safeInvoiceRequests = invoiceRequests ?? []

  const completedServiceAccessPayments = useMemo(
    () =>
      safeServiceAccessPayments.filter((p: any) => p?.status === "completed"),
    [safeServiceAccessPayments],
  )

  const pendingServiceAccessPayments = useMemo(
    () =>
      safeServiceAccessPayments.filter(
        (p: any) => p?.status && p.status !== "completed",
      ),
    [safeServiceAccessPayments],
  )

  const renderPayButton = (key: string) =>
    canShowPayNow && onPayClick ? (
      <Button
        key={key}
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={onPayClick}
      >
        <DollarSign className="w-4 h-4 mr-2" />
        Pay Now
      </Button>
    ) : null

  return (
    <div className="space-y-6">
      {/* Bills Section */}
      <Card className={panelCardClass}>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", sectionTitleClass)}>
            <Receipt className="w-5 h-5 text-green-600" />
            Bills
          </CardTitle>
          <CardDescription className={metaTextClass}>
            View bills and manage payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Package Information */}
          {afyaSolarSubscriber ? (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-green-900 mb-2">
                    Solar Package
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-700">Package</p>
                      <p className="font-medium text-green-900">
                        {afyaSolarSubscriber.packageName}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700">System Size</p>
                      <p className="font-medium text-green-900">
                        {afyaSolarSubscriber.packageRatedKw} kW
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700">Plan Type</p>
                      <p className="font-medium text-green-900">
                        {afyaSolarSubscriber.planType === "CASH"
                          ? "One-Time Payment"
                          : afyaSolarSubscriber.planType === "INSTALLMENT"
                            ? "Installment Plan"
                            : afyaSolarSubscriber.planType === "PAAS"
                              ? "Pay-As-You-Go"
                              : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700">Status</p>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          afyaSolarSubscriber.subscriptionStatus === "active"
                            ? "bg-green-100 text-green-800"
                            : afyaSolarSubscriber.subscriptionStatus ===
                                "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {afyaSolarSubscriber.subscriptionStatus
                          ? afyaSolarSubscriber.subscriptionStatus
                              .charAt(0)
                              .toUpperCase() +
                            afyaSolarSubscriber.subscriptionStatus.slice(1)
                          : "Unknown"}
                      </span>
                    </div>
                    <div>
                      <p className="text-green-700">Package Health</p>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            afyaSolarSubscriber.systemStatus === "active"
                              ? "bg-green-500"
                              : "bg-gray-400"
                          }`}
                        />
                        <span className="text-xs font-medium text-green-700">
                          {afyaSolarSubscriber.systemHealth === "optimal"
                            ? "Optimal"
                            : afyaSolarSubscriber.systemHealth === "warning"
                              ? "Warning"
                              : "Critical"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {afyaSolarSubscriber.systemHealth === "optimal"
                          ? "System performing well"
                          : afyaSolarSubscriber.systemHealth === "warning"
                            ? "System needs attention"
                            : "System requires immediate attention"}
                      </div>
                    </div>
                    <div>
                      <p className="text-green-700">Installation Date</p>
                      <p className="font-medium text-green-900">
                        {afyaSolarSubscriber.installationDate
                          ? new Date(
                              afyaSolarSubscriber.installationDate,
                            ).toLocaleDateString()
                          : "Not installed"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-right">
                    <p className="text-xs text-green-600 mb-1">
                      Next Service Due
                    </p>
                    <p className="text-sm font-medium text-green-900">
                      {afyaSolarSubscriber.nextBillingDate
                        ? new Date(
                            afyaSolarSubscriber.nextBillingDate,
                          ).toLocaleDateString()
                        : "Calculate based on plan"}
                    </p>
                  </div>
                  {canShowPayNow && onPayClick ? (
                    <Button
                      size="sm"
                      className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={onPayClick}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Pay Now
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-yellow-400 text-xl">⚠️</span>
                </div>
                <h4 className="text-lg font-semibold text-yellow-900 mb-2">
                  No Solar Package Found
                </h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Subscription details are not available yet. If a payment was
                  made recently, wait a moment and refresh.
                </p>
                <div className="flex items-center justify-center gap-2">
                  {onReload ? (
                    <Button size="sm" variant="outline" onClick={onReload}>
                      Refresh
                    </Button>
                  ) : null}
                  {onNavigateToAfyaSolar ? (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={onNavigateToAfyaSolar}
                    >
                      Go to Afya Solar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Next Month's Payment */}
          {afyaSolarSubscriber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">
                Next Payment Information
              </h4>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-blue-900">
                    {afyaSolarSubscriber.planType === "CASH" &&
                    afyaSolarSubscriber.totalPackagePrice
                      ? formatCurrency(afyaSolarSubscriber.totalPackagePrice)
                      : afyaSolarSubscriber.planType === "INSTALLMENT" &&
                          afyaSolarSubscriber.monthlyPaymentAmount
                        ? formatCurrency(
                            afyaSolarSubscriber.monthlyPaymentAmount,
                          )
                        : afyaSolarSubscriber.planType === "PAAS" &&
                            afyaSolarSubscriber.monthlyPaymentAmount
                          ? formatCurrency(
                              afyaSolarSubscriber.monthlyPaymentAmount,
                            )
                          : "N/A"}
                  </p>
                  <p className="text-sm text-blue-600">
                    {afyaSolarSubscriber.planType === "CASH"
                      ? "One-time payment"
                      : afyaSolarSubscriber.planType === "INSTALLMENT"
                        ? "Monthly installment"
                        : afyaSolarSubscriber.planType === "PAAS"
                          ? "Monthly service fee"
                          : "Payment amount"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600 mb-1">Payment Method</p>
                  <p className="text-sm font-medium text-blue-900">
                    {afyaSolarSubscriber.paymentMethod || "Not set"}
                  </p>
                </div>
              </div>

              {afyaSolarSubscriber.nextBillingDate && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 mb-1">
                        Days Until Payment
                      </p>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const now = new Date()
                          const nextBilling = new Date(
                            afyaSolarSubscriber.nextBillingDate,
                          )
                          const daysUntil = Math.ceil(
                            (nextBilling.getTime() - now.getTime()) /
                              (1000 * 60 * 60 * 24),
                          )
                          return (
                            <>
                              <span
                                className={`text-2xl font-bold ${
                                  daysUntil > 7
                                    ? "text-green-600"
                                    : daysUntil > 0
                                      ? "text-yellow-600"
                                      : "text-red-600"
                                }`}
                              >
                                {daysUntil > 0 ? daysUntil : 0}
                              </span>
                              <span className="text-sm text-gray-600">
                                {daysUntil === 1 ? "day" : "days"}
                              </span>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${(() => {
                          const now = new Date()
                          const nextBilling = new Date(
                            afyaSolarSubscriber.nextBillingDate,
                          )
                          const daysUntil = Math.ceil(
                            (nextBilling.getTime() - now.getTime()) /
                              (1000 * 60 * 60 * 24),
                          )
                          if (daysUntil <= 0) return "bg-red-100 text-red-800"
                          if (daysUntil <= 7)
                            return "bg-yellow-100 text-yellow-800"
                          return "bg-green-100 text-green-800"
                        })()}`}
                      >
                        {(() => {
                          const now = new Date()
                          const nextBilling = new Date(
                            afyaSolarSubscriber.nextBillingDate,
                          )
                          const daysUntil = Math.ceil(
                            (nextBilling.getTime() - now.getTime()) /
                              (1000 * 60 * 60 * 24),
                          )
                          if (daysUntil <= 0) return "Payment overdue"
                          if (daysUntil <= 7) return "Payment due soon"
                          return "Payment on schedule"
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Due date:{" "}
                    {new Date(
                      afyaSolarSubscriber.nextBillingDate,
                    ).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Billing Summary (subscriber view) */}
          {afyaSolarSubscriber && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Billing Summary
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-700">Credit Balance</p>
                  <p className="font-medium text-gray-900">
                    {afyaSolarSubscriber.remainingBalance !== undefined
                      ? formatCurrency(afyaSolarSubscriber.remainingBalance)
                      : formatCurrency(0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700">Monthly Consumption</p>
                  <p className="font-medium text-gray-900">
                    {facility?.monthlyConsumption
                      ? formatCurrency(Number(facility.monthlyConsumption))
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700">Payment Model</p>
                  <p className="font-medium text-gray-900">
                    {afyaSolarSubscriber.planType || "Not Set"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Installment Schedule */}
          {afyaSolarSubscriber &&
            afyaSolarSubscriber.planType === "INSTALLMENT" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-900 mb-3">
                  Installment Schedule
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-amber-700">Total Contract</p>
                    <p className="font-medium text-amber-900">
                      {afyaSolarSubscriber.totalPackagePrice
                        ? formatCurrency(afyaSolarSubscriber.totalPackagePrice)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-700">Remaining Balance</p>
                    <p className="font-medium text-amber-900">
                      {afyaSolarSubscriber.remainingBalance !== undefined
                        ? formatCurrency(afyaSolarSubscriber.remainingBalance)
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-amber-700">Progress</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width:
                            afyaSolarSubscriber.totalPackagePrice &&
                            afyaSolarSubscriber.remainingBalance !== undefined
                              ? `${
                                  ((afyaSolarSubscriber.totalPackagePrice -
                                    afyaSolarSubscriber.remainingBalance) /
                                    afyaSolarSubscriber.totalPackagePrice) *
                                  100
                                }%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* PAAS Service Details */}
          {afyaSolarSubscriber && afyaSolarSubscriber.planType === "PAAS" && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-900 mb-3">
                Service Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-purple-700">Contract Status</p>
                  <p className="font-medium text-purple-900">
                    {afyaSolarSubscriber.contractStatus || "Active"}
                  </p>
                </div>
                <div>
                  <p className="text-purple-700">Billing Model</p>
                  <p className="font-medium text-purple-900">
                    {afyaSolarSubscriber.billingModel || "Fixed Monthly"}
                  </p>
                </div>
                <div>
                  <p className="text-purple-700">Minimum Term</p>
                  <p className="font-medium text-purple-900">
                    {afyaSolarSubscriber.minimumTermMonths || 12} months
                  </p>
                </div>
                <div>
                  <p className="text-purple-700">Auto-renew</p>
                  <p className="font-medium text-purple-900">
                    {afyaSolarSubscriber.autoRenew ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Facility Billing Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Billing Summary
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-700">Credit Balance</p>
                <p className="font-medium text-gray-900">
                  {facility?.creditBalance
                    ? formatCurrency(facility.creditBalance)
                    : "TZS 0"}
                </p>
              </div>
              <div>
                <p className="text-gray-700">Monthly Consumption</p>
                <p className="font-medium text-gray-900">
                  {facility?.monthlyConsumption
                    ? `${facility.monthlyConsumption} kWh`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-700">Payment Model</p>
                <p className="font-medium text-gray-900">
                  {facility?.paymentModel || "Not Set"}
                </p>
              </div>
            </div>
          </div>

          {/* Bills list */}
          {safeBills.length > 0 && (
            <div className="space-y-4">
              {safeBills.slice(0, 5).map((bill: any) => (
                <div
                  key={bill.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {new Date(bill.periodStart).toLocaleDateString()} -{" "}
                        {new Date(bill.periodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Period:{" "}
                        {Math.ceil(
                          (new Date(bill.periodEnd).getTime() -
                            new Date(bill.periodStart).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )}{" "}
                        days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(bill.totalCost)}
                      </p>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          bill.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : bill.status === "overdue"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {bill.status.charAt(0).toUpperCase() +
                          bill.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Consumption</p>
                      <p className="font-medium">{bill.totalConsumption} kWh</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rate</p>
                      <p className="font-medium">
                        {formatCurrency(
                          Number(bill.totalCost) /
                            Number(bill.totalConsumption),
                        )}
                        /kWh
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Due Date</p>
                      <p
                        className={`font-medium ${
                          new Date(bill.dueDate) < new Date()
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {new Date(bill.dueDate).toLocaleDateString()}
                        {new Date(bill.dueDate) < new Date() && " (Overdue)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <FileText className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      {bill.status !== "paid" ? renderPayButton(`pay-${bill.id}`) : null}
                      <Button size="sm" variant="outline" disabled>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    <div className="text-xs text-gray-400">
                      Bill ID: {bill.id}
                    </div>
                  </div>
                </div>
              ))}
              {safeBills.length > 5 && (
                <div className="text-center">
                  <Button variant="outline" size="sm">
                    View All Bills ({safeBills.length - 5} more)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className={panelCardClass}>
        <CardHeader>
          <CardTitle className={sectionTitleClass}>Payment History</CardTitle>
          <CardDescription className={metaTextClass}>
            Afya Solar subscription payments and invoice requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safeServiceAccessPayments.length > 0 ||
          safeInvoiceRequests.length > 0 ? (
            <div className="space-y-6">
              {completedServiceAccessPayments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-gray-700 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      Completed Payments
                    </h4>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {completedServiceAccessPayments.length} transaction
                      {completedServiceAccessPayments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {completedServiceAccessPayments
                      .slice(0, 5)
                      .map((payment: any) => (
                        <div
                          key={payment.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-4 h-4 rounded-full ${
                                  payment.status === "completed"
                                    ? "bg-green-500"
                                    : payment.status === "failed"
                                      ? "bg-red-500"
                                      : "bg-yellow-500"
                                }`}
                              />
                              <div>
                                <p className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(payment.amount)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {payment.paymentMethod
                                    ? payment.paymentMethod
                                        .charAt(0)
                                        .toUpperCase() +
                                      payment.paymentMethod.slice(1)
                                    : "Unknown"}{" "}
                                  •{" "}
                                  {new Date(
                                    payment.createdAt,
                                  ).toLocaleDateString()}
                                  {payment.paidAt &&
                                    ` • Paid: ${new Date(
                                      payment.paidAt,
                                    ).toLocaleDateString()}`}
                                </p>
                                {payment.packageName && (
                                  <p className="text-sm text-gray-500">
                                    Package: {payment.packageName}{" "}
                                    {payment.paymentPlan &&
                                      `(${payment.paymentPlan})`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  payment.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : payment.status === "failed"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {payment.status.charAt(0).toUpperCase() +
                                  payment.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                              Transaction ID: {payment.transactionId || "N/A"}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" disabled>
                                <Receipt className="w-4 h-4 mr-2" />
                                Receipt
                              </Button>
                              <Button size="sm" variant="outline" disabled>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {pendingServiceAccessPayments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-gray-700 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-yellow-600" />
                      Pending / Failed
                    </h4>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {pendingServiceAccessPayments.length} transaction
                      {pendingServiceAccessPayments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pendingServiceAccessPayments
                      .slice(0, 5)
                      .map((payment: any) => (
                        <div
                          key={payment.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-4 h-4 rounded-full ${
                                  payment.status === "failed"
                                    ? "bg-red-500"
                                    : "bg-yellow-500"
                                }`}
                              />
                              <div>
                                <p className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(payment.amount)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {payment.paymentMethod
                                    ? payment.paymentMethod
                                        .charAt(0)
                                        .toUpperCase() +
                                      payment.paymentMethod.slice(1)
                                    : "Unknown"}{" "}
                                  •{" "}
                                  {new Date(
                                    payment.createdAt,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  payment.status === "failed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {String(payment.status || "pending")
                                  .charAt(0)
                                  .toUpperCase() +
                                  String(payment.status || "pending").slice(1)}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                              Transaction ID: {payment.transactionId || "N/A"}
                            </div>
                            <div className="flex gap-2">
                              {renderPayButton(`pay-pending-${payment.id}`)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {safeInvoiceRequests.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-gray-700 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-blue-600" />
                      Invoice Requests
                    </h4>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {safeInvoiceRequests.length} request
                      {safeInvoiceRequests.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {safeInvoiceRequests.slice(0, 5).map((invoice: any) => (
                      <div
                        key={invoice.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full ${
                                invoice.status === "approved"
                                  ? "bg-green-500"
                                  : invoice.status === "rejected"
                                    ? "bg-red-500"
                                    : "bg-yellow-500"
                              }`}
                            />
                            <div>
                              <p className="text-lg font-semibold text-gray-900">
                                {formatCurrency(invoice.amount)}
                              </p>
                              <p className="text-sm text-gray-600">
                                Invoice •{" "}
                                {new Date(
                                  invoice.createdAt,
                                ).toLocaleDateString()}
                              </p>
                              {invoice.packageName && (
                                <p className="text-sm text-gray-500">
                                  Package: {invoice.packageName}{" "}
                                  {invoice.paymentPlan &&
                                    `(${invoice.paymentPlan})`}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                invoice.status === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : invoice.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {invoice.status.charAt(0).toUpperCase() +
                                invoice.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                          <div className="text-xs text-gray-500">
                            Request ID: {invoice.id}
                          </div>
                          <div className="flex gap-2">
                            {invoice.status === "pending" && (
                              <Button size="sm" variant="outline" disabled>
                                Awaiting invoice processing
                              </Button>
                            )}
                            <Button size="sm" variant="outline">
                              <FileText className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                            <Button size="sm" variant="outline">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(safeServiceAccessPayments.length > 5 ||
                safeInvoiceRequests.length > 5) && (
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm">
                    View All Transactions
                    {safeServiceAccessPayments.length +
                      safeInvoiceRequests.length >
                    5
                      ? ` (${
                          safeServiceAccessPayments.length +
                          safeInvoiceRequests.length -
                          5
                        } more)`
                      : ""}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">💳</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Payment History Found
              </h3>
              <p className="text-gray-500 mb-4">
                Afya Solar subscription payments and invoice requests will
                appear here
              </p>

              <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">
                  Payment Information:
                </h4>
                <div className="text-xs text-blue-700 space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span>
                      <strong>Mobile Money:</strong> M-Pesa, Airtel, Mixx
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span>
                      <strong>Bank Transfer:</strong> Direct bank deposits
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span>
                      <strong>Invoice:</strong> Pay by invoice (admin approval)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span>
                      <strong>Installments:</strong> Pay in installments for
                      packages
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 rounded text-xs text-yellow-700">
                <p className="font-semibold">Current Status:</p>
                <p>
                  • Service Access Payments:{" "}
                  {safeServiceAccessPayments.length || 0}
                </p>
                <p>• Invoice Requests: {safeInvoiceRequests.length || 0}</p>
                <p>
                  • Afya Solar Subscriber:{" "}
                  {afyaSolarSubscriber ? "Found" : "Not found"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
