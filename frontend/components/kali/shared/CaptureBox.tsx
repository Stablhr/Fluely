'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'

export default function CaptureBox({ autoFocus = false, variant = 'sidebar' }: { autoFocus?: boolean; variant?: 'sidebar' | 'dash' }) {
  const addInboxItem = useStore().addInboxItem
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    addInboxItem(t)
    setText('')
  }

  const containerClass =
    variant === 'sidebar'
      ? 'rounded-lg border bg-surface p-1.5'
      : 'rounded-card bg-base-surface p-2 shadow-card transition-shadow duration-150 focus-within:ring-2 focus-within:ring-primary/30 hover:shadow-card-hover'

  return (
    <div
      className={`flex items-center gap-1 transition-colors duration-150 focus-within:border-primary ${containerClass}`}
      style={variant === 'sidebar' ? { borderColor: 'var(--surface-border)' } : undefined}
    >
      <button
        type="button"
        onClick={submit}
        title="Capture to Inbox"
        className={`flex shrink-0 items-center justify-center rounded-md text-primary transition-colors duration-150 hover:bg-primary-subtle active:scale-[0.98] ${variant === 'sidebar' ? 'h-7 w-7' : 'h-8 w-8'}`}
      >
        <Plus size={16} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="Capture a task…"
        autoFocus={autoFocus}
        className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
      />
    </div>
  )
}
