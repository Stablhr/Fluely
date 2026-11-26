'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

/** Open dialogs, innermost last, so Escape and Tab only act on the top one. */
const openDialogs: object[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * What every dialog needs for keyboard and screen-reader use: focus moves in
 * when it opens, Tab stays inside it, focus goes back where it was when it
 * closes, it is named by its first heading unless it has a label, and Escape
 * closes only the top dialog (when `onClose` is given).
 */
export function useDialogFocus(
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose?: () => void,
) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    const token = {}
    openDialogs.push(token)
    const previous = document.activeElement as HTMLElement | null

    if (!panel.hasAttribute('aria-label') && !panel.hasAttribute('aria-labelledby')) {
      const heading = panel.querySelector<HTMLElement>('h1, h2, h3')
      if (heading) {
        heading.id ||= `dialog-title-${Math.random().toString(36).slice(2, 9)}`
        panel.setAttribute('aria-labelledby', heading.id)
      }
    }
    // An `autoFocus` field inside has already taken focus; otherwise focus the dialog.
    if (!panel.contains(document.activeElement)) panel.focus()

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token) return
      if (e.key === 'Escape' && closeRef.current) {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = panel.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openDialogs.splice(openDialogs.indexOf(token), 1)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [open, panelRef])
}

export default function Modal({ open, onClose, children, className = '' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocus(panelRef, open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6 md:p-8">
      <div className="animate-overlay absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`animate-dialog relative z-10 flex h-full w-full flex-col overflow-hidden rounded-hero border border-border bg-surface shadow-modal outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
