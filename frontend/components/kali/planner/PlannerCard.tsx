'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import DueBadge from '../shared/DueBadge'

export default function PlannerCard({ card, index }: { card: Card; index: number }) {
  const { data } = useStore()
  const board = data.boards[card.boardId]

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`cursor-grab rounded-lg border border-border bg-surface p-2 active:cursor-grabbing ${
            snapshot.isDragging
              ? 'z-50 shadow-modal ring-2 ring-primary/40'
              : 'transition-colors duration-150 hover:bg-surface-alt'
          }`}
          style={provided.draggableProps.style}
        >
          <p className="truncate text-[13px] font-medium leading-snug text-text-primary">{card.title}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
              {board?.name}
            </span>
            {card.dueDate && <DueBadge due={card.dueDate} />}
          </div>
        </div>
      )}
    </Draggable>
  )
}
