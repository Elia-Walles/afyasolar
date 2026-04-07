"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Lock, Sun } from "lucide-react"

import { DemoFacilityDashboard } from "@/components/demo-facility-dashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getFacilityByToken } from "@/lib/facility-data"

export default function DemoPage() {
  const params = useParams()
  const token = params.token as string

  const facility = getFacilityByToken(token)

  if (!facility) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              This demo link is invalid or has expired. Please contact AfyaSolar for a valid access token.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button>
                <Sun className="w-4 h-4 mr-2" />
                Return to AfyaSolar Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <DemoFacilityDashboard facility={facility} />
}

