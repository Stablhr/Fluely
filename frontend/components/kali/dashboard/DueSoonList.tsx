'use client'

import Link from 'next/link'
import { AlarmClock, Star } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import DueBadge from '../shared/DueBadge'

export default function DueSoonList({ limit = 8 }: { limit?: number }) {
  const { data } = useStore()

  const cards = Object.values(data.cards)
    .filter((c) => !c.archived && !c.done && c.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, limit)

  return (
    <div className="rounded-card bg-base-surface p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-danger-subtle">
          <AlarmClock size={14} className="text-danger-text" />
        </span>
        <h2 className="text-label uppercase text-ink-500">Due soon</h2>
      </div>

      {cards.length === 0 ? (
        <p className="mt-4 rounded-md px-2 py-3 text-center text-body font-medium text-ink-500">
          Nothing due soon.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {cards.map((card) => {
            const board = data.boards[card.boardId]
            return (
              <li key={card.id}>
                <Link
                  href={`/boards/${card.boardId}`}
                  className="group flex items-center gap-3 rounded-md px-2 py-3 transition-colors duration-150 hover:bg-base-surface-alt"
                >
                  <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-900">
                    {card.title}
                  </span>
                  <span className="hidden max-w-32 truncate rounded-chip bg-base-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-500 sm:block">
                    {board?.name}
                  </span>
                  <DueBadge due={card.dueDate!} />
                  {card.watching && (
                    <Star size={14} className="shrink-0 fill-warning text-warning" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}