"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  CreditCard,
  Zap,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Plug,
  Gift,
  CalendarCheck,
  FileText,
  Eye,
  ArrowLeft,
  Lock,
  Unlock,
  Clock,
  Key,
  Wifi,
  MessageSquare,
  User,
  Settings,
  Globe,
  Database,
  Shield,
  Smartphone,
  BarChart3,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency } from "@/lib/utils"
import { useComprehensiveFacilities, type ComprehensiveFacility } from "@/hooks/use-facilities"

interface FacilityFullDetailsPageProps {
  facilityId: string // Changed from slugName to facilityId
}

// Helper function to generate consistent slugs
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading and trailing hyphens
}

export function FacilityFullDetailsPage({ facilityId }: FacilityFullDetailsPageProps) {
  const { data: facilities, isLoading } = useComprehensiveFacilities()

  const facility: ComprehensiveFacility | undefined = useMemo(
    () => facilities?.find((f) => f.id === facilityId),
    [facilities, facilityId]
  )

  const { data: servicePayments = [] } = useQuery({
    queryKey: ["admin-facility-service-payments", facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const res = await fetch(`/api/service-access-payments?facilityId=${facilityId}&serviceName=afya-solar`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to load service access payments")
      return Array.isArray(json.data) ? json.data : []
    },
  })

  const { data: invoiceRequests = [] } = useQuery({
    queryKey: ["admin-facility-invoice-requests", facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const res = await fetch("/api/admin/solar/invoice-requests?limit=500", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to load invoice requests")
      const rows = Array.isArray(json.data) ? json.data : []
      return rows.filter((row: any) => row.facilityId === facilityId)
    },
  })

  const { data: assessmentCycles = [] } = useQuery({
    queryKey: ["admin-facility-assessment-cycles", facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const res = await fetch(`/api/facility/${facilityId}/assessment-cycles`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to load assessment cycles")
      return Array.isArray(json.cycles) ? json.cycles : []
    },
  })

  const { data: assessmentHistory = [] } = useQuery({
    queryKey: ["admin-facility-assessment-history", facilityId, assessmentCycles.length],
    enabled: Boolean(facilityId) && assessmentCycles.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(
        assessmentCycles.slice(0, 20).map(async (cycle: any) => {
          const [energyRes, climateRes] = await Promise.all([
            fetch(`/api/assessment-cycles/${cycle.id}/energy`, { cache: "no-store" }),
            fetch(`/api/assessment-cycles/${cycle.id}/climate`, { cache: "no-store" }),
          ])
          const energyJson = energyRes.ok ? await energyRes.json().catch(() => ({})) : {}
          const climateJson = climateRes.ok ? await climateRes.json().catch(() => ({})) : {}
          const efficiencyScore =
            energyJson?.operationsData?.assessmentScore ??
            energyJson?.sizingData?.meuSummary?.overallEfficiency ??
            null
          const climateScore = climateJson?.score?.rcs ?? null

          return {
            id: cycle.id,
            status: cycle.status,
            startedAt: cycle.startedAt,
            completedAt: cycle.completedAt,
            assessmentNumber: cycle.assessmentNumber ?? null,
            efficiencyScore,
            climateScore,
            climateTier: climateJson?.score?.tier ?? null,
            topRisks: Array.isArray(climateJson?.topRisks) ? climateJson.topRisks.length : 0,
            hasEnergyData: Boolean(energyJson?.sizingData || energyJson?.operationsData),
            hasClimateData: Boolean(climateJson?.score || (Array.isArray(climateJson?.responses) && climateJson.responses.length > 0)),
          }
        })
      )
      return rows
    },
  })

  if (isLoading || !facilities) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading facility details...</p>
        </div>
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm font-medium text-gray-900">Facility not found</p>
              <p className="text-xs text-gray-600 mt-1">
                The facility you are looking for does not exist or has been removed.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Management Panel
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString()
  }

  const formatBoolean = (value: any) => {
    if (value === null || value === undefined) return "N/A"
    return value ? "Yes" : "No"
  }

  const paymentSummary = useMemo(() => {
    const completed = servicePayments.filter((p: any) => p.status === "completed")
    const pendingOrFailed = servicePayments.filter((p: any) => p.status !== "completed")
    const totalPaid = completed.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    const latest = servicePayments[0] ?? null

    return {
      totalTransactions: servicePayments.length,
      completedCount: completed.length,
      pendingOrFailedCount: pendingOrFailed.length,
      totalPaid,
      latest,
    }
  }, [servicePayments])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button asChild variant="ghost" size="sm" className="mt-1">
              <Link href="/dashboard/admin">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Building2 className="w-6 h-6 text-green-600" />
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{facility.name}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  <span>ID: {facility.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>{facility.city}, {facility.region}</span>
                </div>
                {facility.category && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">{facility.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Badge
            variant={facility.status === "active" ? "default" : "secondary"}
            className={cn(
              "text-xs px-3 py-1",
              facility.status === "active"
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-gray-100 text-gray-700 border-gray-200",
            )}
          >
            {facility.status}
          </Badge>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-600" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Facility ID</p>
                <p className="text-sm font-mono text-gray-900">{facility.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-sm font-medium text-gray-900">{facility.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Address</p>
                <p className="text-sm text-gray-900">{facility.address || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">City</p>
                <p className="text-sm text-gray-900">{facility.city}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Region</p>
                <p className="text-sm text-gray-900">{facility.region}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Region ID</p>
                <p className="text-sm text-gray-900">{(facility as any).region_id || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">District ID</p>
                <p className="text-sm text-gray-900">{(facility as any).district_id || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <p className="text-sm text-gray-900">{facility.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-sm text-gray-900">{facility.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Category</p>
                <p className="text-sm text-gray-900">{facility.category || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <Badge variant={facility.status === "active" ? "default" : "secondary"}>
                  {facility.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Created At</p>
                <p className="text-sm text-gray-900">{formatDate(facility.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Updated At</p>
                <p className="text-sm text-gray-900">{formatDate(facility.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment & System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Payment & System Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Model</p>
                <p className="text-sm font-medium text-gray-900">{facility.paymentModel?.toUpperCase() || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Credit Balance</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(facility.creditBalance || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Monthly Consumption</p>
                <p className="text-sm text-gray-900">{facility.monthlyConsumption || 0} kWh</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">System Size</p>
                <p className="text-sm text-gray-900">{facility.systemSize || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">SMS Sender ID</p>
                <p className="text-sm text-gray-900">{facility.smsSenderId || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Logo URL</p>
                <p className="text-sm text-gray-900 truncate">{facility.logoUrl || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Package, Bills & Payment Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Package</p>
                <p className="text-sm font-medium text-gray-900">
                  {paymentSummary.latest?.packageName || "Not selected"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Package Plan</p>
                <p className="text-sm text-gray-900">
                  {paymentSummary.latest?.paymentPlan?.toUpperCase() || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Transactions</p>
                <p className="text-sm font-semibold text-gray-900">{paymentSummary.totalTransactions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Completed Payments</p>
                <p className="text-sm font-semibold text-green-700">{paymentSummary.completedCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Pending/Failed</p>
                <p className="text-sm font-semibold text-amber-700">{paymentSummary.pendingOrFailedCount}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(paymentSummary.totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Invoice Requests</p>
                <p className="text-lg font-bold text-blue-700">{invoiceRequests.length}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Recent Payment Statuses</h4>
              {servicePayments.length > 0 ? (
                servicePayments.slice(0, 8).map((payment: any) => (
                  <div key={payment.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(payment.amount || 0))}</p>
                        <p className="text-xs text-gray-500">
                          {payment.packageName || "Afya Solar"} {payment.paymentPlan ? `(${payment.paymentPlan})` : ""} •{" "}
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "N/A"}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "text-xs",
                          payment.status === "completed"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : payment.status === "failed"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-yellow-100 text-yellow-700 border-yellow-200"
                        )}
                      >
                        {String(payment.status || "pending")}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No Afya Solar payment transactions found for this facility.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              Assessment History Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">All Cycles</p>
                <p className="text-base font-semibold text-gray-900">{assessmentCycles.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Completed Cycles</p>
                <p className="text-base font-semibold text-green-700">
                  {assessmentCycles.filter((c: any) => c.status === "completed").length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Energy Entries</p>
                <p className="text-base font-semibold text-blue-700">
                  {assessmentHistory.filter((c: any) => c.hasEnergyData).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Climate Entries</p>
                <p className="text-base font-semibold text-purple-700">
                  {assessmentHistory.filter((c: any) => c.hasClimateData).length}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {assessmentHistory.length > 0 ? (
                assessmentHistory.map((cycle: any) => (
                  <div key={cycle.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Assessment {cycle.assessmentNumber ? `#${cycle.assessmentNumber}` : cycle.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Started: {cycle.startedAt ? new Date(cycle.startedAt).toLocaleString() : "N/A"}
                          {cycle.completedAt ? ` • Completed: ${new Date(cycle.completedAt).toLocaleString()}` : ""}
                        </p>
                      </div>
                      <Badge variant={cycle.status === "completed" ? "default" : "secondary"}>{cycle.status}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Energy efficiency score</p>
                        <p className="font-semibold text-blue-700">
                          {cycle.efficiencyScore != null ? Number(cycle.efficiencyScore).toFixed(1) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Climate resilience score (RCS)</p>
                        <p className="font-semibold text-purple-700">
                          {cycle.climateScore != null ? Number(cycle.climateScore).toFixed(1) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Top risk drivers</p>
                        <p className="font-semibold text-gray-900">{cycle.topRisks ?? 0}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/admin/facility/${facilityId}?section=energy-efficiency`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Open Energy Assessment
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/admin/facility/${facilityId}?section=climate-resilience`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Open Climate Assessment
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No assessment cycles found for this facility.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security & Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Security & Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Email Verified</p>
                <Badge variant={facility.emailVerified ? "default" : "secondary"}>
                  {facility.emailVerified ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {formatBoolean(facility.emailVerified)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone Verified</p>
                <Badge variant={(facility as any).phoneVerified ? "default" : "secondary"}>
                  {(facility as any).phoneVerified ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {formatBoolean((facility as any).phoneVerified)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Accept Terms</p>
                <Badge variant={facility.acceptTerms ? "default" : "secondary"}>
                  {facility.acceptTerms ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {formatBoolean(facility.acceptTerms)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Failed Login Attempts</p>
                <p className="text-sm text-gray-900">{(facility as any).failed_login_attempts || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Account Locked Until</p>
                <p className="text-sm text-gray-900">{formatDate((facility as any).account_locked_until)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Last Login At</p>
                <p className="text-sm text-gray-900">{formatDate(facility.lastLoginAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Password Reset Token</p>
                <p className="text-sm font-mono text-gray-900 truncate">{(facility as any).password_reset_token || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Password Reset Expires</p>
                <p className="text-sm text-gray-900">{formatDate((facility as any).password_reset_expires)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone Verification Code</p>
                <p className="text-sm font-mono text-gray-900">{(facility as any).phone_verification_code || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone Verification Expires</p>
                <p className="text-sm text-gray-900">{formatDate((facility as any).phone_verification_expires)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invitation System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-600" />
              Invitation System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Invitation Token</p>
                <p className="text-sm font-mono text-gray-900 truncate">{(facility as any).invitation_token || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Invitation Expires</p>
                <p className="text-sm text-gray-900">{formatDate((facility as any).invitation_expires)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Referral Code</p>
                <p className="text-sm font-mono text-gray-900">{facility.referralCode || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Referred By</p>
                <p className="text-sm text-gray-900">{facility.referredBy || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Referral Benefit Applied</p>
                <Badge variant={facility.referralBenefitApplied ? "default" : "secondary"}>
                  {formatBoolean(facility.referralBenefitApplied)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-green-600" />
              Booking System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Booking Enabled</p>
                <Badge variant={facility.isBookingEnabled ? "default" : "secondary"}>
                  {formatBoolean(facility.isBookingEnabled)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Booking WhatsApp Number</p>
                <p className="text-sm text-gray-900">{facility.bookingWhatsappNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Booking Timezone</p>
                <p className="text-sm text-gray-900">{facility.bookingTimezone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Booking Slug</p>
                <p className="text-sm font-mono text-gray-900">{facility.bookingSlug || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Booking Settings</p>
                <p className="text-sm text-gray-900 truncate">{facility.bookingSettings || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">WhatsApp Enabled</p>
                <Badge variant={(facility as any).whatsapp_enabled ? "default" : "secondary"}>
                  {formatBoolean((facility as any).whatsapp_enabled)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Location Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Latitude</p>
                <p className="text-sm text-gray-900">{facility.latitude || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Longitude</p>
                <p className="text-sm text-gray-900">{facility.longitude || "N/A"}</p>
              </div>
            </div>
            {facility.latitude && facility.longitude && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `https://www.google.com/maps?q=${facility.latitude},${facility.longitude}&z=17`
                    window.open(url, "_blank", "noopener,noreferrer")
                  }}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Open in Google Maps
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              Additional Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Device Count</p>
                <p className="text-sm font-semibold text-gray-900">{facility.deviceCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Active Devices</p>
                <p className="text-sm font-semibold text-green-600">{facility.activeDevices || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Inactive Devices</p>
                <p className="text-sm font-semibold text-red-600">{facility.inactiveDevices || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">User Count</p>
                <p className="text-sm font-semibold text-gray-900">{facility.userCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Department Count</p>
                <p className="text-sm font-semibold text-gray-900">{facility.departmentCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Doctor Count</p>
                <p className="text-sm font-semibold text-gray-900">{facility.doctorCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Appointments</p>
                <p className="text-sm font-semibold text-gray-900">{facility.totalAppointments || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Payments</p>
                <p className="text-sm font-semibold text-gray-900">{facility.totalPayments || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Paid Amount</p>
                <p className="text-sm font-bold text-green-600">{formatCurrency(facility.totalPaidAmount || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
