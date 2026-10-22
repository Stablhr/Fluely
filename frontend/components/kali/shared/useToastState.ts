import { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'

/**
 * An optional button on a toast.
 *
 * Used for the "Undo" affordance on a move: the toast stays up long enough
 * for the action to be worth taking, and clicking it reverses the change.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** How long the toast stays up, in milliseconds. */
  duration?: number;
}

interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
  duration: number
}

export interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

const DEFAULT_DURATION = 3000

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'success', options?: ToastOptions) => {
      const id = ++toastId
      const duration = options?.duration ?? DEFAULT_DURATION
      setToasts((prev) => [...prev.slice(-4), { id, message, type, action: options?.action, duration }])
      const timer = setTimeout(() => removeToast(id), duration)
      timersRef.current.set(id, timer)
    },
    [removeToast],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  }, [])

  return { toasts, toast, removeToast }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
