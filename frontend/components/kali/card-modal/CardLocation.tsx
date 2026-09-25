'use client'

import { useState } from 'react'
import { MapPin, X } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import SectionLabel from '../shared/SectionLabel'

export default function CardLocation({ card }: { card: Card }) {
  const { updateCard, addActivity } = useStore()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(card.location)

  const save = () => {
    setEditing(false)
    const v = value.trim()
    if (v !== card.location) {
      updateCard(card.id, { location: v })
      addActivity(card.id, v ? `set the location to ${v}` : 'removed the location')
    }
  }

  return (
    <section>
      <SectionLabel icon={<MapPin size={14} />}>Location</SectionLabel>

      {card.location && !editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="min-w-0 break-all rounded-md bg-surface-alt px-2.5 py-1 text-xs font-medium text-text-secondary">
            {card.location}
          </span>
          <button
            type="button"
            title="Edit"
            onClick={() => {
              setValue(card.location)
              setEditing(true)
            }}
            className="text-xs font-semibold text-primary-hover hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            title="Remove location"
            aria-label="Remove location"
            onClick={() => {
              setValue('')
              save()
            }}
            className="text-text-muted transition-colors duration-150 hover:text-danger-text"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="mt-2">
          {editing ? (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') {
                  setValue(card.location)
                  setEditing(false)
                }
              }}
              onBlur={save}
              placeholder="e.g. Studio, client office, remote…"
              autoFocus
              className="w-full rounded-md border border-border-strong bg-surface px-2 py-1 text-xs text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 text-xs font-semibold text-primary-hover hover:underline"
            >
              Add location
            </button>
          )}
        </div>
      )}
    </section>
  )
}
