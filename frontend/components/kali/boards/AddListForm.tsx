'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'

export default function AddListForm({ boardId }: { boardId: string }) {
  const addList = useStore().addList
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    const n = name.trim()
    if (!n) return
    addList(boardId, n)
    setName('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-[272px] shrink-0 items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-surface hover:text-text-primary"
      >
        <Plus size={16} />
        Add another list
      </button>
    )
  }

  return (
    <div className="w-[272px] shrink-0 rounded-lg border border-border bg-surface p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="List name"
        autoFocus
        className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel adding list"
          className="rounded-md text-text-secondary transition-colors duration-150 hover:text-text-primary"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
