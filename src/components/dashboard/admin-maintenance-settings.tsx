"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { MaintenanceWorkflowSettings } from "@/lib/settings/visibility-settings"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function AdminMaintenanceSettings() {
  const { data, isLoading, mutate } = useSWR('/api/settings/maintenance', fetcher)
  const [saving, setSaving] = useState(false)
  const [localSettings, setLocalSettings] = useState<MaintenanceWorkflowSettings | null>(null)

  useEffect(() => {
    if (data?.data) {
      setLocalSettings(data.data)
    }
  }, [data])

  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings...
      </div>
    )
  }

  if (!localSettings) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings...
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSettings),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }
      await mutate()
      toast.success('Settings updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance Workflow Settings</CardTitle>
        <CardDescription>Control how quotes, reports, and notifications behave</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Quote visibility</p>
          <Select
            value={localSettings.quoteVisibility}
            onValueChange={(value) => setLocalSettings((prev: any) => ({ ...prev, quoteVisibility: value }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_only">Admins only</SelectItem>
              <SelectItem value="facility_after_approval">Facility after admin approval</SelectItem>
              <SelectItem value="always_visible">Always visible to facility</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Require report before quote</p>
          <Select
            value={localSettings.requireReportBeforeQuote ? 'yes' : 'no'}
            onValueChange={(value) => setLocalSettings((prev: any) => ({ ...prev, requireReportBeforeQuote: value === 'yes' }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Reminder SLA (hours)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-gray-500 mb-1">Report due</p>
              <Input
                type="number"
                value={localSettings.reminders.reportDueHours}
                onChange={(e) => setLocalSettings((prev: any) => ({
                  ...prev,
                  reminders: { ...prev.reminders, reportDueHours: Number(e.target.value) },
                }))}
              />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 mb-1">Quote due</p>
              <Input
                type="number"
                value={localSettings.reminders.quoteDueHours}
                onChange={(e) => setLocalSettings((prev: any) => ({
                  ...prev,
                  reminders: { ...prev.reminders, quoteDueHours: Number(e.target.value) },
                }))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

