"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  CreditCard,
  Zap,
  Users,
  Stethoscope,
  UserCheck,
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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency } from "@/lib/utils"
import { useComprehensiveFacilities, type ComprehensiveFacility } from "@/hooks/use-facilities"

interface FacilityDetailsPageProps {
  facilityId: string
}

export function FacilityDetailsPage({ facilityId }: FacilityDetailsPageProps) {
  const { data: facilities, isLoading } = useComprehensiveFacilities()

  const facility: ComprehensiveFacility | undefined = useMemo(
    () => facilities?.find((f) => f.id === facilityId),
    [facilities, facilityId]
  )

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

  const credit = Number(facility.creditBalance || 0)
  const isLowCredit = credit < 10000

  const hasCoordinates =
    typeof facility.latitude === "number" &&
    typeof facility.longitude === "number" &&
    !Number.isNaN(facility.latitude) &&
    !Number.isNaN(facility.longitude) &&
    facility.latitude >= -90 &&
    facility.latitude <= 90 &&
    facility.longitude >= -180 &&
    facility.longitude <= 180

  const getMapUrl = () => {
    if (!hasCoordinates) return null
    const lat = facility.latitude!
    const lng = facility.longitude!
    return `https://www.google.com/maps?q=${lat},${lng}&z=17`
  }

  const getMapEmbedUrl = () => {
    if (!hasCoordinates) return null
    const lat = facility.latitude!
    const lng = facility.longitude!
    const bboxPadding = 0.01
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - bboxPadding},${lat - bboxPadding},${lng + bboxPadding},${
      lat + bboxPadding
    }&layer=mapnik&marker=${lat},${lng}`
  }

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
                  <MapPin className="w-4 h-4" />
                  <span>
                    {facility.city}, {facility.region}
                  </span>
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
          <div className="flex items-center gap-2 flex-shrink-0">
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
            {isLowCredit && (
              <Badge className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 border-yellow-200">Low Credit</Badge>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/90 backdrop-blur shadow-sm border border-green-100 rounded-2xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Credit Balance</p>
                  <p className={cn("text-xl font-bold", isLowCredit ? "text-yellow-600" : "text-gray-900")}>
                    {formatCurrency(credit)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur shadow-sm border border-blue-100 rounded-2xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Devices</p>
                  <p className="text-xl font-bold text-gray-900">
                    {facility.activeDevices || 0}/{facility.deviceCount || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Active</p>
                </div>
                <Plug className="w-8 h-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur shadow-sm border border-purple-100 rounded-2xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Users</p>
                  <p className="text-xl font-bold text-gray-900">{facility.userCount || 0}</p>
                </div>
                <Users className="w-8 h-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur shadow-sm border border-indigo-100 rounded-2xl">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Total Paid</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(facility.totalPaidAmount || 0)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Info */}
          <Card className="lg:col-span-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-600" />
                Contact Information
              </h2>
              <div className="space-y-3">
                {facility.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="text-sm text-gray-900 mt-0.5">{facility.address}</p>
                    </div>
                  </div>
                )}
                {facility.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm text-gray-900 mt-0.5">{facility.phone}</p>
                    </div>
                  </div>
                )}
                {facility.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm text-gray-900 mt-0.5">{facility.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card className="lg:col-span-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                System Information
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Payment Model</span>
                  <Badge variant="outline" className="text-xs">
                    {facility.paymentModel ? facility.paymentModel.toUpperCase() : "N/A"}
                  </Badge>
                </div>
                {facility.systemSize && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">System Size</span>
                    <span className="text-sm font-medium text-gray-900">{facility.systemSize}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Monthly Consumption</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Number(facility.monthlyConsumption || 0).toFixed(2)} kWh
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Email Verified</span>
                  <Badge variant={facility.emailVerified ? "default" : "secondary"} className="text-xs">
                    {facility.emailVerified ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {facility.emailVerified ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Terms Accepted</span>
                  <Badge variant={facility.acceptTerms ? "default" : "secondary"} className="text-xs">
                    {facility.acceptTerms ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {facility.acceptTerms ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device Status */}
          <Card className="lg:col-span-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plug className="w-4 h-4 text-green-600" />
                Device Status
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total Devices</span>
                  <span className="text-sm font-semibold text-gray-900">{facility.deviceCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Active</span>
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                    {facility.activeDevices || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Inactive</span>
                  <Badge className="text-xs bg-gray-100 text-gray-700 border-gray-200">
                    {facility.inactiveDevices || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card className="lg:col-span-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                Payment Status
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total Payments</span>
                  <span className="text-sm font-semibold text-gray-900">{facility.totalPayments || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Completed</span>
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                    {facility.completedPayments || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Pending</span>
                  <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                    {facility.pendingPayments || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Failed</span>
                  <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                    {facility.failedPayments || 0}
                  </Badge>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Total Amount Paid</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatCurrency(facility.totalPaidAmount || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking System */}
          {facility.isBookingEnabled && (
            <Card className="lg:col-span-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
              <CardContent className="pt-6 pb-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-green-600" />
                  Booking System
                </h2>
                <div className="space-y-3">
                  {facility.bookingSlug && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Booking Slug</span>
                      <span className="text-xs font-mono font-medium text-gray-900">{facility.bookingSlug}</span>
                    </div>
                  )}
                  {facility.bookingTimezone && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Timezone</span>
                      <span className="text-sm font-medium text-gray-900">{facility.bookingTimezone}</span>
                    </div>
                  )}
                  {facility.bookingWhatsappNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">WhatsApp</span>
                      <span className="text-sm font-medium text-gray-900">{facility.bookingWhatsappNumber}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Departments</span>
                    <div className="flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-purple-600" />
                      <span className="text-sm font-semibold text-gray-900">{facility.departmentCount || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Doctors</span>
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-indigo-600" />
                      <span className="text-sm font-semibold text-gray-900">{facility.doctorCount || 0}</span>
                    </div>
                  </div>
                  {facility.totalAppointments > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Total Appointments</span>
                        <span className="text-sm font-semibold text-gray-900">{facility.totalAppointments}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Pending</span>
                        <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                          {facility.pendingAppointments}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Confirmed</span>
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                          {facility.confirmedAppointments}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Completed</span>
                        <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                          {facility.completedAppointments}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Referral Info */}
          {(facility.referralCode || facility.referredBy) && (
            <Card className="lg:col-span-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
              <CardContent className="pt-6 pb-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-green-600" />
                  Referral Information
                </h2>
                <div className="space-y-3">
                  {facility.referralCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Referral Code</span>
                      <span className="text-xs font-mono font-medium text-gray-900">{facility.referralCode}</span>
                    </div>
                  )}
                  {facility.referredBy && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Referred By</span>
                      <span className="text-xs text-gray-600">Facility ID</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Benefit Applied</span>
                    <Badge variant={facility.referralBenefitApplied ? "default" : "secondary"} className="text-xs">
                      {facility.referralBenefitApplied ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account Info */}
          <Card className="lg:col-span-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-600" />
                Account Information
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Created</span>
                  <span className="text-xs text-gray-600">
                    {facility.createdAt ? new Date(facility.createdAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Last Updated</span>
                  <span className="text-xs text-gray-600">
                    {facility.updatedAt ? new Date(facility.updatedAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                {facility.lastLoginAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Last Login</span>
                    <span className="text-xs text-gray-600">
                      {new Date(facility.lastLoginAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Section */}
        {hasCoordinates && (
          <Card className="bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-600" />
                  Location Map (Based on Coordinates)
                </h2>
              </div>
              {getMapEmbedUrl() && (
                <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                  <iframe
                    width="100%"
                    height="400"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={getMapEmbedUrl() || ""}
                    title={`Map showing exact location at coordinates ${facility.latitude?.toFixed(6)}, ${facility.longitude?.toFixed(6)}`}
                  />
                  <div className="p-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 text-center">
                    <MapPin className="w-3 h-3 inline mr-1 text-red-600" />
                    <span className="font-medium">Pin marker shows exact coordinates:</span>{" "}
                    {facility.latitude?.toFixed(6)}, {facility.longitude?.toFixed(6)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No coordinates message */}
        {!hasCoordinates && (
          <Card className="border border-yellow-200 bg-yellow-50/90 rounded-2xl shadow-sm">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">GPS Coordinates Not Available</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Map cannot be displayed because GPS coordinates (latitude/longitude) are not set for this facility.
                    The map pin can only be shown when exact coordinates are available.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t mt-4">
          {hasCoordinates && getMapUrl() && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const url = getMapUrl()
                if (url) {
                  window.open(url, "_blank", "noopener,noreferrer")
                }
              }}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Open in Google Maps (Pin at Coordinates)
            </Button>
          )}
          <Button variant="outline" asChild className={hasCoordinates ? "flex-1" : "w-full"}>
            <Link href={`/dashboard/admin/facilities/${facility.id}`}>
              <Eye className="w-4 h-4 mr-2" />
              View Energy & Device Metrics
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}


