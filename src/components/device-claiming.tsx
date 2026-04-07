"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plug, CheckCircle, Loader2 } from "lucide-react"
import { useClaimDevice } from "@/hooks/use-devices"
import { deviceClaimSchema } from "@/lib/validations"
import type { z } from "zod"
import { toast } from "sonner"

type DeviceClaimForm = z.infer<typeof deviceClaimSchema>

export function DeviceClaiming() {
  const [claimed, setClaimed] = useState(false)
  const claimDevice = useClaimDevice()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DeviceClaimForm>({
    resolver: zodResolver(deviceClaimSchema),
    defaultValues: {
      serialPrefix: "",
      serialSuffix: "",
      deviceType: "eyedro",
    },
  })

  const deviceType = watch("deviceType")
  const serialPrefix = watch("serialPrefix")
  const serialSuffix = watch("serialSuffix")

  const onSubmit = async (data: DeviceClaimForm) => {
    try {
      const result = await claimDevice.mutateAsync(data)
      if (result.success) {
        setClaimed(true)
        toast.success("Device successfully claimed!")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to claim device")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          Claim New Device
        </CardTitle>
        <CardDescription>Add a smart meter or energy monitor to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="deviceType">Device Type</Label>
            <Select
              value={deviceType}
              onValueChange={(value) => setValue("deviceType", value as DeviceClaimForm["deviceType"])}
            >
              <SelectTrigger id="deviceType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eyedro">Eyedro Smart Meter</SelectItem>
                <SelectItem value="afyasolar">AfyaSolar Meter</SelectItem>
                <SelectItem value="generic">Generic PAYG Meter</SelectItem>
              </SelectContent>
            </Select>
            {errors.deviceType && (
              <p className="text-sm text-destructive mt-1">{errors.deviceType.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="serialPrefix">Serial Number (First 3 characters)</Label>
              <Input
                id="serialPrefix"
                placeholder="ABC"
                maxLength={3}
                {...register("serialPrefix", {
                  onChange: (e) => {
                    setValue("serialPrefix", e.target.value.toUpperCase())
                  },
                })}
              />
              {errors.serialPrefix && (
                <p className="text-sm text-destructive mt-1">{errors.serialPrefix.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="serialSuffix">Serial Number (After dash)</Label>
              <Input
                id="serialSuffix"
                placeholder="12345"
                maxLength={5}
                {...register("serialSuffix", {
                  onChange: (e) => {
                    setValue("serialSuffix", e.target.value.toUpperCase())
                  },
                })}
              />
              {errors.serialSuffix && (
                <p className="text-sm text-destructive mt-1">{errors.serialSuffix.message}</p>
              )}
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Serial Number Format</p>
            <p className="text-sm text-muted-foreground">
              Enter the first 3 characters, then the 5 characters after the dash
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Example: <strong>ABC-12345</strong>
            </p>
          </div>

          {claimed && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="w-5 h-5" />
                <p className="font-medium">Device Successfully Claimed!</p>
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  <strong>Device ID:</strong> {serialPrefix}-{serialSuffix}
                </p>
                <p>
                  <strong>Default Sensor:</strong> 200 Amps
                </p>
                <p>
                  <strong>Ports:</strong> 2 (Home System)
                </p>
                <p>
                  <strong>Mode:</strong> Change of State
                </p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={serialPrefix.length !== 3 || serialSuffix.length !== 5 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Claiming...
              </>
            ) : (
              "Claim Device"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

