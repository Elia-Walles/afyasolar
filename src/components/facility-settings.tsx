"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FacilityLogoUpload } from "@/components/facility-logo-upload"
import { Settings, ArrowLeft, Gift, Copy, CheckCircle2 } from "lucide-react"
import { useFacility } from "@/hooks/use-facilities"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface FacilitySettingsProps {
  facilityId?: string
  onBack?: () => void
}

export function FacilitySettings({ facilityId, onBack }: FacilitySettingsProps) {
  const { data: facility } = useFacility(facilityId)
  const router = useRouter()
  const [referralCode, setReferralCode] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [isLoadingCode, setIsLoadingCode] = useState(false)

  useEffect(() => {
    if (facilityId) {
      loadReferralCode()
    }
  }, [facilityId])

  const loadReferralCode = async () => {
    try {
      setIsLoadingCode(true)
      const response = await fetch('/api/facilities/referral-code')
      if (response.ok) {
        const data = await response.json()
        setReferralCode(data.referralCode || '')
      }
    } catch (error) {
      console.error('Error loading referral code:', error)
    } finally {
      setIsLoadingCode(false)
    }
  }

  const handleCopyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode)
      setCopied(true)
      toast.success('Referral code copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Settings
            </h1>
            <p className="text-sm text-gray-600 mt-1">Manage your facility profile and preferences</p>
          </div>
        </div>

        {/* Logo Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Facility Logo</CardTitle>
            <CardDescription>
              Upload or update your facility logo. This logo will appear in all your service dashboards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6">
              <FacilityLogoUpload facilityId={facilityId} size="lg" />
              <div className="text-center max-w-md">
                <p className="text-sm text-gray-600">
                  Recommended: Square image, at least 200x200 pixels. Maximum file size: 5MB.
                  Supported formats: JPG, PNG, GIF, WebP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Program */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-600" />
              Referral Program
            </CardTitle>
            <CardDescription>
              Invite other facilities and earn rewards. Share your referral code with facilities you invite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingCode ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin" />
                Loading referral code...
              </div>
            ) : referralCode ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Your Referral Code</p>
                    <p className="text-2xl font-bold text-green-600 font-mono">{referralCode}</p>
                    <p className="text-xs text-gray-600 mt-2">
                      Share this code with facilities you invite. They'll get free Afya Booking for the next month upon admin approval!
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyReferralCode}
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-gray-500">
                Referral code not available
              </div>
            )}
            {facility?.referredBy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Referred By</p>
                <p className="text-sm text-blue-700">
                  You were referred by another facility. Thank you for joining through our referral program!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facility Information */}
        {facility && (
          <Card>
            <CardHeader>
              <CardTitle>Facility Information</CardTitle>
              <CardDescription>Your facility details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Facility Name</label>
                <p className="text-sm text-gray-900 mt-1">{facility.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Location</label>
                <p className="text-sm text-gray-900 mt-1">
                  {facility.city}, {facility.region}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900 mt-1">{facility.email || "Not set"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <p className="text-sm text-gray-900 mt-1">{facility.phone}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
