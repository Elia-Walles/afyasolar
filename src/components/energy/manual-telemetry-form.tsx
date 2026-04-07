"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface ManualTelemetryFormProps {
  facilityId: string
}

export function ManualTelemetryForm({ facilityId }: ManualTelemetryFormProps) {
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16))
  const [deviceId, setDeviceId] = useState<string>("manual-device")
  const [power, setPower] = useState<string>("1000") // Watts
  const [energy, setEnergy] = useState<string>("5") // kWh
  const [solarGeneration, setSolarGeneration] = useState<string>("5")
  const [batteryLevel, setBatteryLevel] = useState<string>("80")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const body = {
        deviceId,
        power: Number(power) || 0,
        energy: Number(energy) || 0,
        solarGeneration: Number(solarGeneration) || 0,
        batteryLevel: Number(batteryLevel) || 0,
        gridStatus: "connected",
        deviceStatus: "normal",
        timestamp: new Date(timestamp).toISOString(),
      }

      const res = await fetch(`/api/energy?facilityId=${facilityId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to store telemetry")
      }

      toast.success("Manual telemetry sample stored successfully.")
    } catch (error: any) {
      toast.error(error?.message || "Failed to store telemetry sample.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="timestamp">Timestamp</Label>
          <Input
            id="timestamp"
            type="datetime-local"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deviceId">Device ID</Label>
          <Input
            id="deviceId"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="manual-device"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="power">Power (W)</Label>
          <Input
            id="power"
            type="number"
            value={power}
            onChange={(e) => setPower(e.target.value)}
            min="0"
            step="0.1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="energy">Energy (kWh)</Label>
          <Input
            id="energy"
            type="number"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
            min="0"
            step="0.1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solarGeneration">Solar Generation (kWh)</Label>
          <Input
            id="solarGeneration"
            type="number"
            value={solarGeneration}
            onChange={(e) => setSolarGeneration(e.target.value)}
            min="0"
            step="0.1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="batteryLevel">Battery Level (%)</Label>
          <Input
            id="batteryLevel"
            type="number"
            value={batteryLevel}
            onChange={(e) => setBatteryLevel(e.target.value)}
            min="0"
            max="100"
            step="1"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Telemetry Sample"}
        </Button>
      </div>
    </form>
  )
}

