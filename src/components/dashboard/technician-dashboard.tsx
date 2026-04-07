"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogoutButton } from "@/components/logout-button"

interface TechnicianDashboardProps {
  technicianId: string
}

export function TechnicianDashboard({ technicianId }: TechnicianDashboardProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Technician Portal</CardTitle>
            <CardDescription>
              Technician workflows are currently disabled in this environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">
              Technician profile: <span className="font-mono text-xs">{technicianId}</span>
            </p>
            <LogoutButton variant="outline" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

