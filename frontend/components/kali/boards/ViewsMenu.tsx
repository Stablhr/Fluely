'use client'

import { useEffect, useRef } from 'react'
import { LayoutGrid, Table, CalendarDays, GanttChartSquare, Map, Check } from 'lucide-react'
import type { BoardViewType } from './BoardView'

const VIEWS: { id: BoardViewType; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'table', label: 'Table', icon: Table },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'map', label: 'Map', icon: Map },
]

interface ViewsMenuProps {
  open: boolean
  onClose: () => void
  activeView: BoardViewType
  onViewChange: (view: BoardViewType) => void
}

export default function ViewsMenu({ open, onClose, activeView, onViewChange }: ViewsMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} className="animate-in absolute right-0 top-11 z-30 w-52 rounded-lg border border-border-strong bg-surface-elevated p-1.5 shadow-subtle">
      <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
        View
      </p>
      {VIEWS.map((view) => {
        const Icon = view.icon
        const isActive = view.id === activeView
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => {
              onViewChange(view.id)
              onClose()
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
              isActive
                ? 'font-semibold text-primary-hover bg-primary-subtle'
                : 'font-medium text-text-primary hover:bg-surface-alt'
            }`}
          >
            <Icon size={15} />
            <span className="flex-1">{view.label}</span>
            {isActive && <Check size={14} className="text-primary-hover" />}
          </button>
        )
      })}
    </div>
  )
}
