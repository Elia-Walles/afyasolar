"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Power, AlertTriangle, CheckCircle, CreditCard } from "lucide-react"
import { useFacility } from "@/hooks/use-facilities"
import { useLiveEnergyData } from "@/hooks/use-energy-data"
import { formatCurrency, calculateDaysRemaining } from "@/lib/utils"
import type { PowerStatus } from "@/types"
import { useRouter } from "next/navigation"

interface PaygControlProps {
  facilityId?: string
}

export function PaygControl({ facilityId }: PaygControlProps) {
  const router = useRouter()
  const { data: facility, isLoading: facilityLoading } = useFacility(facilityId)
  const { data: liveData, isLoading: dataLoading } = useLiveEnergyData(facilityId)

  const isLoading = facilityLoading || dataLoading

  const creditBalance = facility?.creditBalance ? Number(facility.creditBalance) : 0
  const dailyConsumption = liveData?.todayTotal || 0
  const daysRemaining = useMemo(
    () => calculateDaysRemaining(creditBalance, dailyConsumption * 357.14285), // TSh per kWh
    [creditBalance, dailyConsumption]
  )

  const powerStatus: PowerStatus = useMemo(() => {
    if (creditBalance === 0) return "disconnected"
    if (creditBalance < 10000) return "warning"
    return "connected"
  }, [creditBalance])

  const creditPercentage = Math.min((creditBalance / 100000) * 100, 100)

  const handleTopUp = () => {
    router.push("/dashboard/facility/payments")
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-5 h-5" />
            PAYG Power Control
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="w-5 h-5" />
          PAYG Power Control
        </CardTitle>
        <CardDescription>Automatic power management based on credit balance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Power Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Power Status</p>
            <p className="text-2xl font-bold">
              {powerStatus === "connected" && "Connected"}
              {powerStatus === "disconnected" && "Disconnected"}
              {powerStatus === "warning" && "Low Credit Warning"}
            </p>
          </div>
          <Badge
            variant={powerStatus === "connected" ? "default" : "destructive"}
            className={powerStatus === "connected" ? "bg-success" : powerStatus === "warning" ? "bg-warning" : ""}
          >
            {powerStatus === "connected" && <CheckCircle className="w-3 h-3 mr-1" />}
            {powerStatus === "warning" && <AlertTriangle className="w-3 h-3 mr-1" />}
            {powerStatus === "connected" ? "Active" : powerStatus === "warning" ? "Warning" : "Inactive"}
          </Badge>
        </div>

        {/* Credit Balance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Credit Balance</p>
            <p className="text-sm font-medium">{formatCurrency(creditBalance)}</p>
          </div>
          <Progress value={creditPercentage} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">
            Estimated {daysRemaining} days remaining at current usage
          </p>
        </div>

        {/* Auto-Disconnect Warning */}
        {creditBalance < 10000 && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Low Credit Warning</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your credit is running low. Power will be automatically disconnected when balance reaches TSh 0.
                  Critical equipment (vaccine refrigeration, emergency lighting) will remain powered.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical Equipment Protection */}
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Protected Equipment</p>
          <p className="text-sm text-muted-foreground">
            The following equipment will remain powered even if credit runs out:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• Vaccine Refrigeration (0.8 kW)</li>
            <li>• Emergency Lighting (0.2 kW)</li>
            <li>• Medical Monitoring Equipment (0.3 kW)</li>
          </ul>
        </div>

        {/* Quick Top-Up */}
        <Button className="w-full" size="lg" onClick={handleTopUp}>
          <CreditCard className="w-4 h-4 mr-2" />
          Top Up Credit Now
        </Button>
      </CardContent>
    </Card>
  )
}

