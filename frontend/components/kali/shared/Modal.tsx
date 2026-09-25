'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export default function Modal({ open, onClose, children, className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6 md:p-8">
      <div className="absolute inset-0 bg-[#0f1a19]/50" onClick={onClose} />
      <div
        className={`animate-in relative z-10 flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-modal ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
