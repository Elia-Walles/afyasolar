"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface DeleteFacilityDialogProps {
  facilityId: string
  facilityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const expectedCommand = (name: string) => `delete-${name}`

export function DeleteFacilityDialog({
  facilityId,
  facilityName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteFacilityDialogProps) {
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const expected = expectedCommand(facilityName)
  const isMatch = confirmText.trim() === expected

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirmText("")
    }
    onOpenChange(next)
  }

  const handleDelete = async () => {
    if (!isMatch) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/facilities/${facilityId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Failed to delete facility")
        return
      }
      toast.success("Facility deleted successfully")
      handleOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast.error("Failed to delete facility")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg">Delete facility</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You are about to permanently delete <strong className="text-foreground">{facilityName}</strong> from the database.
              </p>
              <p className="font-medium text-destructive">
                This action cannot be undone. Related data (users, devices, subscriptions, etc.) may be affected or prevent deletion.
              </p>
              <div className="space-y-2 pt-2">
                <Label htmlFor="delete-confirm" className="text-foreground">
                  Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{expected}</code> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expected}
                  className="font-mono"
                  autoComplete="off"
                  disabled={isDeleting}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
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
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete facility
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
