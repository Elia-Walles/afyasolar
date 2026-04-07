"use client"

import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2, Trash2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

interface DeleteTechnicianDialogProps {
  technicianId: string
  technicianName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeleteTechnicianDialog({
  technicianId,
  technicianName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteTechnicianDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev !== null && prev > 0) {
            return prev - 1
          }
          return null
        })
      }, 1000)
    } else if (countdown === 0) {
      // Countdown finished, proceed with deletion
      performDelete()
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [countdown])

  const handleConfirm = () => {
    setCanUndo(true)
    setCountdown(10)
  }

  const handleUndo = () => {
    setCountdown(null)
    setCanUndo(false)
    toast.info("Deletion cancelled")
  }

  const performDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/technicians/${technicianId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Failed to delete technician")
        return
      }
      toast.success("Technician deleted successfully")
      handleOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast.error("Failed to delete technician")
    } finally {
      setIsDeleting(false)
      setCountdown(null)
      setCanUndo(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCountdown(null)
      setCanUndo(false)
      setIsDeleting(false)
    }
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg">Delete technician</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {!canUndo ? (
                <>
                  <p>
                    Are you sure you want to delete <strong className="text-foreground">{technicianName}</strong> from the database?
                  </p>
                  <p className="font-medium text-destructive">
                    This action cannot be undone. Related data (assignments, reviews, maintenance history, etc.) may be affected or prevent deletion.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Deleting <strong className="text-foreground">{technicianName}</strong> in:
                  </p>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-destructive">
                      {countdown}
                    </div>
                    <p className="text-sm text-muted-foreground">seconds</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can undo this action before the countdown finishes.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          {!canUndo ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleUndo}
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Undo Delete
              </Button>
              <div className="text-sm text-muted-foreground">
                Deleting in {countdown}s...
              </div>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
