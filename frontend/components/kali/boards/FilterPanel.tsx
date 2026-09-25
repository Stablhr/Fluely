'use client'

import { useEffect, useRef } from 'react'
import { Tag, Users } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'

export interface BoardFilter {
  labelIds: string[]
  memberIds: string[]
}

interface FilterPanelProps {
  board: Board
  filter: BoardFilter
  onChange: (filter: BoardFilter) => void
  open: boolean
  onClose: () => void
}

export default function FilterPanel({ board, filter, onChange, open, onClose }: FilterPanelProps) {
  const { members } = useStore()
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

  const labels = Object.values(board.labels ?? {})
  const isActive = filter.labelIds.length > 0 || filter.memberIds.length > 0
  const clear = () => onChange({ labelIds: [], memberIds: [] })

  const toggleLabel = (id: string) =>
    onChange({
      ...filter,
      labelIds: filter.labelIds.includes(id)
        ? filter.labelIds.filter((x) => x !== id)
        : [...filter.labelIds, id],
    })

  const toggleMember = (id: string) =>
    onChange({
      ...filter,
      memberIds: filter.memberIds.includes(id)
        ? filter.memberIds.filter((x) => x !== id)
        : [...filter.memberIds, id],
    })

  return (
    <div
      ref={ref}
      className="animate-in absolute right-0 top-11 z-30 w-56 rounded-lg border border-border-strong bg-surface-elevated p-3 shadow-subtle sm:w-64"
    >
      <div className="flex items-center justify-between px-1 py-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">Filter</p>
        {isActive && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-primary-text hover:underline dark:text-primary-hover"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-2">
        <p className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
          <Tag size={12} />
          Labels
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {labels.length === 0 && <span className="text-xs text-text-muted">No labels on this board.</span>}
          {labels.map((label) => {
            const active = filter.labelIds.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => toggleLabel(label.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition ${
                  active ? 'ring-2 ring-ink' : 'ring-1 ring-transparent'
                }`}
                style={{ background: `${label.color}21`, color: label.color }}
              >
                {label.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3">
        <p className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary">
          <Users size={12} />
          Members
        </p>
        <div className="mt-1.5 space-y-0.5">
          {members.map((member) => {
            const active = filter.memberIds.includes(member.id)
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleMember(member.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors duration-150 hover:bg-surface-alt ${
                  active ? 'bg-primary-subtle font-semibold text-primary-hover' : 'font-medium text-text-primary'
                }`}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: member.color }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </span>
                {member.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
