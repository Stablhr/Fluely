'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ProfileCard, usePublicProfile } from '@/components/kali/shared/ProfileCard'

type Props = {
  userId: string
  boardId?: string
  children: React.ReactNode
  className?: string
}

export default function ProfilePopover({ userId, boardId, children, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const { data: profile, isLoading } = usePublicProfile(open ? userId : null, boardId)

  useEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setPos({
        top: rect.bottom + 8,
        left: Math.min(Math.max(8, rect.left), window.innerWidth - 320 - 8),
      })
    }
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      // close handled by clicking outside the popover; popover is in portal
      const pop = document.getElementById('profile-popover')
      if (pop?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!userId) return <span className={className}>{children}</span>

  return (
    <span ref={triggerRef} className={`cursor-pointer ${className}`} onClick={() => setOpen((v) => !v)}>
      {children}
      {open && pos && (
        createPortal(
          <div
            id="profile-popover"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: 320, zIndex: 60 }}
            className="rounded-2xl border border-border bg-surface-elevated p-2 shadow-medium"
          >
            {isLoading || !profile ? (
              <div className="p-4 text-xs text-text-muted">Loading…</div>
            ) : (
              <ProfileCard profile={profile} boardRole={null} />
            )}
          </div>,
          document.body,
        )
      )}
    </span>
  )
}
