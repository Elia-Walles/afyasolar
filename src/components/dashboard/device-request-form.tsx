"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import type { Facility } from "@/types"
import { z } from "zod"

const deviceRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().min(1, "Phone is required").max(20),
  facilityName: z.string().max(255).optional(),
  deviceType: z.string().max(50).optional(),
  quantity: z.number().int().min(1).default(1),
  message: z.string().optional(),
})

type DeviceRequestForm = z.infer<typeof deviceRequestSchema>

interface DeviceRequestFormProps {
  facility?: Facility | null
}

export function DeviceRequestForm({ facility }: DeviceRequestFormProps) {
  const { data: session } = useSession()
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DeviceRequestForm>({
    resolver: zodResolver(deviceRequestSchema),
    defaultValues: {
      name: session?.user?.name || facility?.name || "",
      email: session?.user?.email || facility?.email || "",
      phone: facility?.phone || "",
      facilityName: facility?.name || "",
      deviceType: "",
      quantity: 1,
      message: "",
    },
  })

  const deviceType = watch("deviceType")

  const onSubmit = async (data: DeviceRequestForm) => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/device-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit device request")
      }

      const result = await response.json()
      if (result.success) {
        setSubmitted(true)
        reset()
        toast.success("Device request submitted successfully! We'll review it and get back to you.")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit device request")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-900 mb-2">Request Submitted!</h3>
        <p className="text-green-600 mb-4">
          Your device request has been submitted. We'll review it and contact you soon.
        </p>
        <Button
          onClick={() => setSubmitted(false)}
          variant="outline"
          className="border-green-200 text-green-700 hover:bg-green-50"
        >
          Submit Another Request
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Your Name</Label>
          <Input
            id="name"
            {...register("name")}
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            disabled={isSubmitting}
          />
          {errors.email && (
            <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            {...register("phone")}
            placeholder="+255 123 456 789"
            disabled={isSubmitting}
          />
          {errors.phone && (
            <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="facilityName">Facility Name</Label>
          <Input
            id="facilityName"
            {...register("facilityName")}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="deviceType">Device Type (Optional)</Label>
          <Select
            value={deviceType}
            onValueChange={(value) => setValue("deviceType", value)}
          >
            <SelectTrigger id="deviceType" disabled={isSubmitting}>
              <SelectValue placeholder="Select device type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eyedro">Eyedro Smart Meter</SelectItem>
              <SelectItem value="afyasolar">AfyaSolar Meter</SelectItem>
              <SelectItem value="generic">Generic PAYG Meter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            {...register("quantity", { valueAsNumber: true })}
            disabled={isSubmitting}
          />
          {errors.quantity && (
            <p className="text-sm text-red-600 mt-1">{errors.quantity.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="message">Additional Message (Optional)</Label>
        <Textarea
          id="message"
          {...register("message")}
          className="min-h-[100px]"
          placeholder="Any additional information about your device request..."
          disabled={isSubmitting}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit Device Request
          </>
        )}
      </Button>
    </form>
  )
}

