'use client'

import { Droppable } from '@hello-pangea/dnd'
import type { Card } from '@/lib/kali/store/schema'
import { toISODate } from '@/lib/kali/utils/dates'
import PlannerCard from './PlannerCard'

interface DayColumnProps {
  date: Date
  isToday: boolean
  cards: Card[]
  showFullDate?: boolean
  minWidth?: boolean
}

export default function DayColumn({ date, isToday, cards, showFullDate = false, minWidth = false }: DayColumnProps) {
  const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' })
  const dayNum = showFullDate
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : date.getDate()

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col ${minWidth ? 'min-w-[150px] sm:min-w-[170px]' : ''}`}
    >
      <div
        className={`mb-2 rounded-md px-2 py-1.5 text-center ${
          isToday ? 'bg-primary text-primary-foreground' : 'bg-surface-alt'
        }`}
      >
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.05em] ${
            isToday ? 'text-primary-foreground' : 'text-text-secondary'
          }`}
        >
          {dayLabel}
        </p>
        <p className={`font-mono text-lg font-semibold ${isToday ? 'text-primary-foreground' : 'text-text-primary'}`}>
          {dayNum}
        </p>
      </div>

      <Droppable droppableId={`day-${toISODate(date)}`} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`scroll-slim min-h-[120px] flex-1 rounded-lg p-1.5 transition-colors duration-150 ${
              snapshot.isDraggingOver
                ? 'bg-primary-subtle/60 ring-2 ring-inset ring-primary'
                : 'ring-1 ring-border'
            }`}
          >
            <div className="flex flex-col gap-1.5">
              {cards.map((card, i) => (
                <PlannerCard key={card.id} card={card} index={i} />
              ))}
              {cards.length === 0 && <p className="py-2 text-center text-xs text-text-muted">—</p>}
            </div>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
