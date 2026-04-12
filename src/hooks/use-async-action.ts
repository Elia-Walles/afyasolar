"use client"

import { useCallback, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/get-error-message"
import { notifyError, notifySuccess } from "@/lib/toast-feedback"

type AsyncActionOptions = {
  successMessage?: string
  errorMessage?: string
  /** If false, errors are rethrown after toast (default: true) */
  swallowError?: boolean
}

/**
 * Wraps an async function with isPending, optional success/error toasts, and safe error handling.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: AsyncActionOptions
) {
  const [isPending, setIsPending] = useState(false)
  const optsRef = useRef(options)
  optsRef.current = options

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setIsPending(true)
    try {
      const result = await fn(...args)
      const o = optsRef.current
      if (o?.successMessage) {
        notifySuccess(o.successMessage)
      }
      return result
    } catch (e) {
      const o = optsRef.current
      const msg = o?.errorMessage ?? getErrorMessage(e)
      notifyError(msg)
      if (o?.swallowError !== false) {
        return undefined
      }
      throw e
    } finally {
      setIsPending(false)
    }
  }, [fn])

  return { run, isPending }
}
