import { toast } from "sonner"
import { getErrorMessage } from "@/lib/get-error-message"

export function notifySuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined)
}

export function notifyError(message: string, description?: string) {
  toast.error(message, description ? { description } : undefined)
}

export function notifyInfo(message: string, description?: string) {
  toast.info(message, description ? { description } : undefined)
}

/** Run an async action with loading + success/error toasts. */
export async function notifyPromise<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error?: string }
): Promise<T> {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: (err) => messages.error ?? getErrorMessage(err),
  })
}
