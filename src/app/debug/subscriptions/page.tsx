"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface SubscriptionData {
  facilityId?: string
  facility?: any
  allSubscriptions?: any[]
  serviceChecks?: Record<string, any>
  timestamp?: string
}

export default function DebugSubscriptionsPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)

  async function fetchData() {
    try {
      const response = await fetch('/api/debug/subscriptions')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function createSubscription(serviceName: string) {
    setCreating(serviceName)
    try {
      const response = await fetch('/api/debug/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceName }),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log(`Created ${serviceName} subscription:`, result)
      
      // Refresh data after creation
      await fetchData()
    } catch (err: any) {
      console.error(`Error creating ${serviceName} subscription:`, err)
      setError(err.message)
    } finally {
      setCreating(null)
    }
  }

  useEffect(() => {
    if (session) {
      fetchData()
    } else {
      setLoading(false)
      setError("No session found")
    }
  }, [session])

  if (loading) {
    return <div className="p-8">Loading debug data...</div>
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Subscription Debug Info</h1>
      
      {/* Test Subscription Creation */}
      <Card>
        <CardHeader>
          <CardTitle>Test Subscription Creation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => createSubscription('afya-solar')}
              disabled={creating === 'afya-solar'}
            >
              {creating === 'afya-solar' ? 'Creating...' : 'Create Afya Solar Subscription'}
            </Button>
          </div>
          <Button onClick={fetchData} variant="outline">Refresh Data</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Session Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facility Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(data?.facility, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(data?.allSubscriptions, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(data?.serviceChecks, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500">
        Last updated: {data?.timestamp}
      </div>
    </div>
  )
}
