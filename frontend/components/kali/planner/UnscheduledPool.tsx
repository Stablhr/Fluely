'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Inbox } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import PlannerCard from './PlannerCard'

export default function UnscheduledPool({ cards }: { cards: Card[] }) {
  return (
    <Droppable droppableId="unscheduled-pool" type="CARD">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex w-[180px] shrink-0 flex-col rounded-lg p-2 sm:w-[230px] sm:p-3 ${
            snapshot.isDraggingOver
              ? 'bg-primary-subtle/60 ring-2 ring-inset ring-primary'
              : 'ring-1 ring-border'
          }`}
        >
          <div className="flex items-center gap-1.5 px-1 pb-2">
            <Inbox size={14} className="text-text-muted" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              Unscheduled
            </h2>
            <span className="ml-auto font-mono text-[10.5px] text-text-muted">{cards.length}</span>
          </div>
          <div className="scroll-slim flex max-h-[calc(100vh-170px)] min-h-2 flex-1 flex-col gap-1.5 overflow-y-auto">
            {cards.map((card, i) => (
              <PlannerCard key={card.id} card={card} index={i} />
            ))}
            {cards.length === 0 && (
              <p className="px-1 py-3 text-center text-xs text-text-muted">All cards scheduled</p>
            )}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}
