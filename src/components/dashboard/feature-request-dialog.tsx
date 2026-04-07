"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

interface FeatureRequestDialogProps {
  serviceName: "afya-solar"
  serviceDisplayName: string
  trigger?: React.ReactNode
}

const serviceIcons: Record<string, string> = {
  "afya-solar": "☀️",
}

export function FeatureRequestDialog({
  serviceName,
  serviceDisplayName,
  trigger,
}: FeatureRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")

  const submitMutation = useMutation({
    mutationFn: async (data: {
      serviceName: string
      title: string
      description: string
      priority: string
    }) => {
      const response = await fetch("/api/feature-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit feature request")
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success("Feature request submitted successfully!")
      setOpen(false)
      setTitle("")
      setDescription("")
      setPriority("medium")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit feature request")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || title.length < 3) {
      toast.error("Title must be at least 3 characters")
      return
    }

    if (!description.trim() || description.length < 10) {
      toast.error("Description must be at least 10 characters")
      return
    }

    submitMutation.mutate({
      serviceName,
      title: title.trim(),
      description: description.trim(),
      priority,
    })
  }

  const isSubmitting = submitMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild suppressHydrationWarning>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Request Feature
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" suppressHydrationWarning>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="text-2xl">{serviceIcons[serviceName] || "💡"}</span>
            Request New Feature - {serviceDisplayName}
          </DialogTitle>
          <DialogDescription>
            Share your ideas for new features or improvements. Our team will review your request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold">
              Feature Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Add bulk appointment scheduling"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={255}
              disabled={isSubmitting}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              A brief, descriptive title for your feature request (3-255 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the feature in detail. What problem does it solve? How would it work? What would be the benefits?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              rows={6}
              disabled={isSubmitting}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Provide detailed information about the feature (minimum 10 characters)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-sm font-semibold">
              Priority
            </Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as "low" | "medium" | "high")}
              disabled={isSubmitting}
            >
              <SelectTrigger id="priority" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    Low - Nice to have
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    Medium - Would be helpful
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                    High - Critical for operations
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How important is this feature for your facility?
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
