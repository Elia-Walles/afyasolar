"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  Download, 
  Shield, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Settings,
  Info,
  XCircle
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface ContractDetailsProps {
  facilityId?: string
}

interface ContractData {
  contractType: 'PaaS' | 'Installment' | 'Outright'
  startDate: string
  endDate?: string
  monthlyFee: number
  depositPaid?: number
  totalPrice?: number
  remainingBalance?: number
  expectedCompletionDate?: string
  status: 'active' | 'pending' | 'completed' | 'expired'
}

interface TermsAndConditions {
  gracePeriod: number
  gracePeriodPolicy: string
  restrictionPolicy: string
  contractTerms: string[]
}

interface CoverageInfo {
  scope: 'full-facility' | 'critical-loads'
  description: string
  inclusions: string[]
  exclusions: string[]
  limitations: string[]
}

export function ContractDetails({ facilityId }: ContractDetailsProps) {
  const [activeTab, setActiveTab] = useState("summary")

  // Mock data - in real app, this would come from API
  const contractData: ContractData = {
    contractType: 'Installment',
    startDate: '2024-01-15',
    endDate: '2026-01-15',
    monthlyFee: 50000,
    depositPaid: 250000,
    totalPrice: 1200000,
    remainingBalance: 950000,
    expectedCompletionDate: '2026-01-15',
    status: 'active'
  }

  const termsAndConditions: TermsAndConditions = {
    gracePeriod: 5,
    gracePeriodPolicy: "A 5-day grace period is granted for all monthly payments. Payments made within this period will not incur late fees.",
    restrictionPolicy: "Service may be temporarily suspended if payments are delayed beyond the grace period. Reconnection fees may apply.",
    contractTerms: [
      "Monthly payments are due on the 15th of each month",
      "Late payment fee of 5% applies after grace period",
      "System maintenance included in monthly fee",
      "24/7 customer support available",
      "Contract can be terminated with 30-day notice",
      "Equipment remains property of Afya Solar until full payment"
    ]
  }

  const coverageInfo: CoverageInfo = {
    scope: 'critical-loads',
    description: "Coverage includes essential medical equipment and critical infrastructure",
    inclusions: [
      "Medical refrigerators and freezers",
      "Laboratory equipment",
      "Emergency lighting systems",
      "Communication equipment",
      "Security systems",
      "Basic patient monitoring devices"
    ],
    exclusions: [
      "Air conditioning systems",
      "Non-essential office equipment",
      "Personal electronic devices",
      "Laundry facilities",
      "Kitchen appliances (except medical food storage)"
    ],
    limitations: [
      "Maximum load capacity: 5kVA",
      "Battery backup provides 4 hours of critical load support",
      "Solar generation varies by weather conditions",
      "Annual maintenance required for optimal performance"
    ]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "expired":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />
      case "expired":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const downloadContractPDF = () => {
    // In real app, this would trigger PDF download
    console.log("Downloading contract PDF...")
  }

  return (
    <div className="space-y-6">
      {/* Contract Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Contract Summary
          </CardTitle>
          <CardDescription>Overview of your solar service contract</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Contract Type</label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn(
                    contractData.contractType === 'PaaS' ? 'bg-blue-100 text-blue-800' :
                    contractData.contractType === 'Installment' ? 'bg-purple-100 text-purple-800' :
                    'bg-green-100 text-green-800'
                  )}>
                    {contractData.contractType}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {contractData.contractType === 'PaaS' ? 'Pay-as-you-go' :
                     contractData.contractType === 'Installment' ? 'Payment plan' :
                     'One-time purchase'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{new Date(contractData.startDate).toLocaleDateString()}</span>
                </div>
              </div>

              {contractData.endDate && (
                <div>
                  <label className="text-sm font-medium text-gray-700">End Date</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{new Date(contractData.endDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Monthly Fee</label>
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-lg font-semibold text-green-600">{formatCurrency(contractData.monthlyFee)}</span>
                </div>
              </div>

              {contractData.depositPaid && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Deposit Paid</label>
                  <div className="flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{formatCurrency(contractData.depositPaid)}</span>
                  </div>
                </div>
              )}

              {contractData.totalPrice && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Price</label>
                  <div className="flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{formatCurrency(contractData.totalPrice)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {contractData.remainingBalance && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Remaining Balance</label>
                  <div className="flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-lg font-semibold text-orange-600">{formatCurrency(contractData.remainingBalance)}</span>
                  </div>
                </div>
              )}

              {contractData.expectedCompletionDate && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Expected Completion</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{new Date(contractData.expectedCompletionDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn(getStatusColor(contractData.status), "flex items-center gap-1")}>
                    {getStatusIcon(contractData.status)}
                    {contractData.status.charAt(0).toUpperCase() + contractData.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
        </TabsList>

        {/* Terms and Conditions */}
        <TabsContent value="terms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Terms and Conditions
              </CardTitle>
              <CardDescription>Contract policies and terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Grace Period Policy
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>{termsAndConditions.gracePeriod}-day grace period</strong> is granted for all monthly payments.
                  </p>
                  <p className="text-sm text-blue-700">
                    {termsAndConditions.gracePeriodPolicy}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Restriction Policy
                </h4>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-800">
                    {termsAndConditions.restrictionPolicy}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  Contract Terms
                </h4>
                <ul className="space-y-2">
                  {termsAndConditions.contractTerms.map((term, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{term}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={downloadContractPDF} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Contract PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Information */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                Coverage Information
              </CardTitle>
              <CardDescription>What's included in your service coverage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Coverage Scope</h4>
                <Badge className={cn(
                  coverageInfo.scope === 'full-facility' ? 'bg-green-100 text-green-800' :
                  'bg-yellow-100 text-yellow-800'
                )}>
                  {coverageInfo.scope === 'full-facility' ? 'Full Facility' : 'Critical Loads Only'}
                </Badge>
                <p className="text-sm text-gray-600 mt-2">{coverageInfo.description}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  What's Included
                </h4>
                <ul className="space-y-2">
                  {coverageInfo.inclusions.map((inclusion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{inclusion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Exclusions
                </h4>
                <ul className="space-y-2">
                  {coverageInfo.exclusions.map((exclusion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{exclusion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-600" />
                  Limitations
                </h4>
                <ul className="space-y-2">
                  {coverageInfo.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
