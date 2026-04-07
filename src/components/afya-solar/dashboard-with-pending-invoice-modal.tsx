"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FacilityDashboard } from "@/components/dashboard/facility-dashboard"
import { FileText, AlertCircle } from "lucide-react"

interface AfyaSolarDashboardWithPendingModalProps {
  facilityId?: string
}

export function AfyaSolarDashboardWithPendingModal({ facilityId }: AfyaSolarDashboardWithPendingModalProps) {
  return (
    <>
      <div className="pointer-events-none select-none opacity-60">
        <FacilityDashboard facilityId={facilityId} />
      </div>
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800">
              <AlertCircle className="h-5 w-5" />
              Pending invoice
            </DialogTitle>
            <DialogDescription className="text-left pt-1">
              You have a pending invoice. Complete payment to access your solar management dashboard.
              Once our team confirms your payment, you will have full access here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <FileText className="h-5 w-5 shrink-0" />
            <span>
              Pay the invoice sent to your facility email. After payment, contact us or wait for status update;
              the admin will mark your invoice as paid and this message will disappear.
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
