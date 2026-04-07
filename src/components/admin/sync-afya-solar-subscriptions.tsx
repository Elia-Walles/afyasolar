"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSyncAfyaSolarSubscriptions, useAfyaSolarSubscriberExists } from "@/hooks/use-afyasolar-auto-subscriber"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { RefreshCw, Users, Database, CheckCircle, AlertCircle } from "lucide-react"

interface SyncAfyaSolarSubscriptionsProps {
  facilityId?: string
  facilityName?: string
}

export function SyncAfyaSolarSubscriptions({ facilityId, facilityName }: SyncAfyaSolarSubscriptionsProps) {
  const { data: session } = useSession()
  const { data: existingSubscriber } = useAfyaSolarSubscriberExists(facilityId)
  const syncMutation = useSyncAfyaSolarSubscriptions()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    if (!facilityId) {
      toast.error("Facility ID is required for syncing")
      return
    }

    setIsSyncing(true)
    try {
      await syncMutation.mutateAsync(facilityId)
      toast.success("Afya Solar subscription synced successfully!")
    } catch (error) {
      toast.error("Failed to sync Afya Solar subscription")
    } finally {
      setIsSyncing(false)
    }
  }

  if (!session?.user?.email) {
    return null
  }

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          Sync Afya Solar Subscriptions
        </CardTitle>
        <CardDescription>
          Migrate existing Afya Solar subscriptions to the new centralized subscriber table
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {facilityName || 'Current Facility'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {existingSubscriber ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Synced
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Not Synced
              </Badge>
            )}
          </div>
        </div>

        {/* Sync Status Details */}
        {existingSubscriber && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-semibold text-green-800 mb-2">Sync Details:</h4>
            <div className="space-y-1 text-xs text-green-700">
              <p>• Package: {existingSubscriber.packageName}</p>
              <p>• Plan: {existingSubscriber.planType}</p>
              <p>• Status: {existingSubscriber.subscriptionStatus}</p>
              <p>• Synced: {new Date(existingSubscriber.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {/* Sync Button */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {existingSubscriber 
              ? "Subscriber record exists in the new table"
              : "No subscriber record found in the new table"
            }
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing || syncMutation.isPending || !facilityId}
            variant={existingSubscriber ? "outline" : "default"}
            className="min-w-[120px]"
          >
            {isSyncing || syncMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : existingSubscriber ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-sync
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <p className="font-semibold mb-1">How it works:</p>
          <ul className="space-y-1">
            <li>• Checks for existing Afya Solar subscriptions in service_subscriptions table</li>
            <li>• Creates corresponding record in afyasolar_subscribers table</li>
            <li>• Preserves subscription dates and status information</li>
            <li>• Uses default 10KW PAAS plan for existing subscriptions</li>
          </ul>
        </div>

        {/* Error Message */}
        {syncMutation.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              Error: {syncMutation.error.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
