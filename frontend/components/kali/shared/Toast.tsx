'use client'

import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { ToastContext, useToastState } from './useToastState'

type ToastType = 'success' | 'error' | 'info'

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const COLORS: Record<ToastType, string> = {
  success: 'border-success bg-success-subtle text-success-text',
  error: 'border-danger bg-danger-subtle text-danger-text',
  info: 'border-info bg-info-subtle text-info-text',
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, toast, removeToast } = useToastState()

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-16 right-4 z-[70] flex flex-col gap-2 md:bottom-4" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <div
              key={t.id}
              role="alert"
              className={`animate-in flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-medium ${COLORS[t.type]}`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
