"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type AdminBlockingDialogProps = {
  open: boolean
  title: string
  description?: string
}

/**
 * Modal overlay for long-running admin operations (prevents duplicate submits and signals progress).
 */
export function AdminBlockingDialog({ open, title, description }: AdminBlockingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex justify-center py-6">
          <div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
