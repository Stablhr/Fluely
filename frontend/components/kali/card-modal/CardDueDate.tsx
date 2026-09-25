'use client'

import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { formatDate } from '@/lib/kali/utils/dates'
import SectionLabel from '../shared/SectionLabel'

export default function CardDueDate({ card }: { card: Card }) {
  const { updateCard, addActivity } = useStore()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(card.dueDate ?? '')

  const setDue = (raw: string) => {
    setEditing(false)
    const due = raw || null
    if (due === card.dueDate) return
    updateCard(card.id, { dueDate: due })
    addActivity(card.id, due ? `set a due date (${formatDate(due)})` : 'removed the due date')
  }

  return (
    <section>
      <SectionLabel icon={<CalendarDays size={14} />}>Due date</SectionLabel>

      {card.dueDate && !editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded-md bg-surface-alt px-2.5 py-1 font-mono text-[11px] font-medium text-text-secondary">
            {formatDate(card.dueDate)}
          </span>
          <button
            type="button"
            title="Edit"
            onClick={() => {
              setValue(card.dueDate ?? '')
              setEditing(true)
            }}
            className="text-xs font-semibold text-primary-hover hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            title="Remove due date"
            aria-label="Remove due date"
            onClick={() => setDue('')}
            className="text-text-muted transition-colors duration-150 hover:text-danger-text"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setDue(value)}
            autoFocus
            className="rounded-md border border-border-strong bg-surface px-2 py-1 font-mono text-[11px] text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {card.dueDate && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                setDue('')
              }}
              className="text-xs font-semibold text-text-secondary hover:text-danger-text"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </section>
  )
}
