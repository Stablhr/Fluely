'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'

export default function AddCardForm({ listId }: { listId: string }) {
  const addCard = useStore().addCard
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return
    addCard(listId, t)
    setTitle('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition"
        style={{ color: 'var(--surface-text-muted)' }}
      >
        <Plus size={15} />
        Add a card
      </button>
    )
  }

  return (
    <div className="mt-1 rounded-lg border p-1.5" style={{ background: 'var(--surface-bg-subtle)', borderColor: 'var(--surface-border)' }}>
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Card title…"
        autoFocus
        rows={2}
        className="w-full resize-none rounded-md px-2.5 py-1.5 text-sm outline-none placeholder:text-text-muted"
        style={{ color: 'var(--surface-text)', background: 'transparent' }}
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="transition"
          style={{ color: 'var(--surface-text-muted)' }}
        >
          <X size={17} />
        </button>
      </div>
    </div>
  )
}
