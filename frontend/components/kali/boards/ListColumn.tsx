'use client'

import { useMemo, useState } from 'react'
import { Droppable } from '@hello-pangea/dnd'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import { Check, GripVertical } from 'lucide-react'
import type { Card, List } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { useAdaptiveTheme, adaptiveVars } from '@/lib/kali/hooks/useAdaptiveTheme'
import CardFace from './Card'
import AddCardForm from './AddCardForm'
import ListMenu from './ListMenu'
import type { BoardFilter } from './FilterPanel'

interface ListColumnProps {
  list: List
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined
  search: string
  filter: BoardFilter
  onOpenCard: (cardId: string) => void
}

export default function ListColumn({ list, dragHandleProps, search, filter, onOpenCard }: ListColumnProps) {
  const { data, renameList, toggleListCollapsed } = useStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(list.name)

  // Default list container color — mirrors --color-list-default (src/index.css).
  // Resolved at runtime so the contrast engine sees the same hex as the render.
  const defaultListBg = useMemo(
    () =>
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--color-list-default')
        .trim() || '#ffffff',
    [],
  )
  const bg = list.backgroundColor || defaultListBg
  const theme = useAdaptiveTheme(bg)
  const vars = adaptiveVars(theme)

  const allCards = ((data.lists[list.id]?.cardOrder ?? [])
    .map((id) => data.cards[id])
    .filter(Boolean) as Card[]).filter((c) => !c.archived)

  const query = search.trim().toLowerCase()
  const matchesQuery = (c: Card) =>
    !query || c.title.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query)
  const matchesFilter = (c: Card) => {
    const labelMatch =
      filter.labelIds.length === 0 || c.labelIds.some((id) => filter.labelIds.includes(id))
    const memberMatch =
      filter.memberIds.length === 0 || c.memberIds.some((id) => filter.memberIds.includes(id))
    return labelMatch && memberMatch
  }
  const cards = allCards.filter((c) => matchesQuery(c) && matchesFilter(c))

  const commitRename = () => {
    setEditing(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== list.name) renameList(list.id, trimmed)
    else setName(list.name)
  }

  return (
    <div
      className={`relative shrink-0 flex-col rounded-xl transition-[width] duration-200 ease-in-out ${
        list.collapsed ? 'w-[46px] overflow-hidden' : 'w-[272px]'
      }`}
      style={{ ...vars, background: bg, border: `1px solid ${theme.border}` }}
    >
      {/* Collapsed name overlay */}
      <div
        {...(list.collapsed ? dragHandleProps : undefined)}
        onClick={list.collapsed ? () => { setName(list.name); setEditing(false); toggleListCollapsed(list.id) } : undefined}
        title={list.collapsed ? (list.name ? `${list.name} — click to expand` : 'Click to expand') : undefined}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 ${
          list.collapsed ? 'opacity-100 cursor-pointer' : 'pointer-events-none opacity-0'
        }`}
      >
        <span
          className="whitespace-nowrap text-xs font-semibold"
          style={{ color: 'var(--surface-text-muted)', writingMode: 'vertical-rl' }}
        >
          {list.name}
        </span>
      </div>

      {/* Expanded content (always rendered for layout height) */}
      <div className={`flex min-h-full flex-col transition-opacity duration-200 ${
        list.collapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}>
        <div
          {...(!list.collapsed ? dragHandleProps : undefined)}
          className="group flex cursor-grab items-center gap-1 px-2 pb-1 pt-2.5 active:cursor-grabbing"
        >
          <GripVertical size={14} className="opacity-70" style={{ color: 'var(--surface-text-faint)' }} />
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') {
                    setName(list.name)
                    setEditing(false)
                  }
                }}
                onBlur={commitRename}
                autoFocus
                className="w-32 rounded-md px-1 py-0.5 text-sm font-semibold outline-none ring-2 ring-primary/30"
                style={{ color: 'var(--surface-text)', background: 'var(--surface-bg-subtle)' }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitRename}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <h3
              onClick={() => {
                setName(list.name)
                setEditing(true)
              }}
              title="Click to rename"
              className="flex-1 cursor-text truncate text-sm font-semibold"
              style={{ color: 'var(--surface-text)' }}
            >
              {list.name}
            </h3>
          )}
          <span className="font-mono text-[10.5px]" style={{ color: 'var(--surface-text-faint)' }}>{allCards.length}</span>
          <ListMenu list={list} />
        </div>

        {list.assignee && (
          <p className="px-3 pb-1.5 text-[11px]" style={{ color: 'var(--surface-text-muted)' }}>by {list.assignee}</p>
        )}

        <Droppable droppableId={list.id} type="CARD">
          {(droppableProvided, snapshot) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className={`scroll-slim flex max-h-[calc(100vh-220px)] min-h-2 flex-1 flex-col gap-1.5 overflow-y-auto rounded-b-xl px-2 pb-2 sm:max-h-[calc(100vh-180px)] ${
                snapshot.isDraggingOver ? 'bg-black/[0.04] ring-2 ring-inset ring-primary dark:bg-white/[0.06]' : ''
              }`}
              style={{
                transition: 'background-color 0.15s ease',
              }}
            >
              {cards.map((card, index) => (
                <CardFace key={card.id} card={card} index={index} onOpenCard={onOpenCard} />
              ))}
              {droppableProvided.placeholder}
              <AddCardForm listId={list.id} />
            </div>
          )}
        </Droppable>
      </div>
    </div>
  )
}
