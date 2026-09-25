'use client'

import { useState } from 'react'
import { Tag, Check } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import SectionLabel from '../shared/SectionLabel'
import LabelChip from '../shared/Chip'

export default function CardLabels({ card }: { card: Card }) {
  const store = useStore()
  const [open, setOpen] = useState(false)
  const board = store.data.boards[card.boardId]
  const labels = Object.values(board?.labels ?? {})

  const toggle = (labelId: string) => {
    const has = card.labelIds.includes(labelId)
    const labelIds = has
      ? card.labelIds.filter((id) => id !== labelId)
      : [...card.labelIds, labelId]
    store.updateCard(card.id, { labelIds })
    store.addActivity(card.id, has ? 'removed a label' : 'added a label')
  }

  const activeLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))

  return (
    <section>
      <SectionLabel icon={<Tag size={14} />}>Labels</SectionLabel>

      <div className="mt-2 flex flex-wrap gap-1">
        {activeLabels.length === 0 ? (
          <span className="text-xs text-text-muted">No labels</span>
        ) : (
          activeLabels.map((label) => <LabelChip key={label.id} label={label} />)
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 text-xs font-semibold text-primary-hover hover:underline"
      >
        {open ? 'Done' : 'Add labels'}
      </button>

      {open && (
        <div className="animate-in mt-2 space-y-0.5 rounded-lg border border-border-strong bg-surface-elevated p-1.5 shadow-subtle">
          {labels.length === 0 && (
            <p className="px-2 py-1 text-xs text-text-muted">No labels on this board yet.</p>
          )}
          {labels.map((label) => {
            const active = card.labelIds.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => toggle(label.id)}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-surface-alt"
              >
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: `${label.color}21`, color: label.color }}
                >
                  {label.name}
                </span>
                {active && <Check size={14} className="text-primary-hover" />}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
