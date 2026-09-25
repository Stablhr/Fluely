'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, ChevronsLeft, ChevronsRight, Archive, UserPlus, Palette } from 'lucide-react'
import type { List } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'

const LIST_COLORS = [
  '', '#FFFFFF', '#0DABA3', '#33B27A', '#FF8B5E', '#E8A93D',
  '#FF5E6C', '#7C5CFC', '#3B82F6', '#E879F9',
]

export default function ListMenu({ list }: { list: List }) {
  const { toggleListCollapsed, archiveList, setListAssignee, setListBackgroundColor } = useStore()
  const [open, setOpen] = useState(false)
  const [assignee, setAssignee] = useState(list.assignee)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="List actions"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-150"
        style={{ color: 'var(--surface-text-muted)' }}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div className="animate-in absolute right-0 top-8 z-20 w-56 rounded-lg border border-border-strong bg-surface-elevated p-1.5 shadow-subtle">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
            onClick={() => {
              toggleListCollapsed(list.id)
              setOpen(false)
            }}
          >
            {list.collapsed ? <ChevronsRight size={15} className="opacity-60" /> : <ChevronsLeft size={15} className="opacity-60" />}
            {list.collapsed ? 'Expand list' : 'Collapse list'}
          </button>

          <div className="my-1 h-px bg-border" />

          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <UserPlus size={15} className="shrink-0 text-text-secondary" />
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setListAssignee(list.id, assignee.trim())
                  setOpen(false)
                }
              }}
              placeholder="Assignee"
              className="w-full rounded-md border border-border-strong bg-surface px-1.5 py-0.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="my-1 h-px bg-border" />

          <div className="px-2.5 py-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              <Palette size={12} />
              List color
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {LIST_COLORS.map((color) => (
                <button
                  key={color || 'default'}
                  type="button"
                  title={color ? 'Set list color' : 'Reset to default'}
                  onClick={() => {
                    setListBackgroundColor(list.id, color)
                  }}
                  className={`h-6 rounded-md ring-2 ring-surface transition-transform duration-150 active:scale-[0.98] ${
                    list.backgroundColor === color ? 'ring-offset-1 ring-primary' : ''
                  }`}
                  style={{ background: color || '#FFFFFF' }}
                />
              ))}
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
            onClick={() => {
              if (window.confirm(`Archive the "${list.name}" list and all of its cards?`)) {
                archiveList(list.id)
              }
              setOpen(false)
            }}
          >
            <Archive size={15} />
            Archive list
          </button>
        </div>
      )}
    </div>
  )
}
