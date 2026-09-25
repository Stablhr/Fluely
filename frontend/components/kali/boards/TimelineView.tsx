'use client'

import { useState, useMemo, useCallback } from 'react'
import { useStore } from '@/lib/kali/store/useStore'
import { addDays, toISODate, formatDate } from '@/lib/kali/utils/dates'
import type { Card, List } from '@/lib/kali/store/schema'
import type { BoardFilter } from './FilterPanel'

interface TimelineViewProps {
  boardId: string
  search: string
  filter: BoardFilter
  onOpenCard: (cardId: string) => void
}

type ZoomLevel = 'day' | 'week' | 'month'

const ZOOM_CONFIG = {
  day: { columnWidth: 60, label: 'Day', columns: 21 },
  week: { columnWidth: 100, label: 'Week', columns: 14 },
  month: { columnWidth: 140, label: 'Month', columns: 8 },
}

export default function TimelineView({ boardId, search, filter, onOpenCard }: TimelineViewProps) {
  const { data } = useStore()
  const board = data.boards[boardId]
  const [today] = useState(() => new Date())
  const [zoom, setZoom] = useState<ZoomLevel>('week')

  const config = ZOOM_CONFIG[zoom]

  const startDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - Math.floor(config.columns / 3))
    return d
  }, [today, config.columns])

  const timeColumns = useMemo(() => {
    const cols: Date[] = []
    for (let i = 0; i < config.columns; i++) {
      cols.push(addDays(startDate, i * (zoom === 'month' ? 30 : zoom === 'week' ? 7 : 1)))
    }
    return cols
  }, [startDate, config.columns, zoom])

  const totalWidth = config.columns * config.columnWidth

  const lists = useMemo(() => {
    if (!board) return []
    return board.listOrder.map((id) => data.lists[id]).filter(Boolean) as List[]
  }, [board, data.lists])

  const cardMatches = useCallback((card: Card) => {
    const query = search.trim().toLowerCase()
    if (query && !card.title.toLowerCase().includes(query) && !card.desc.toLowerCase().includes(query)) {
      return false
    }
    if (filter.labelIds.length > 0 && !card.labelIds.some((id) => filter.labelIds.includes(id))) {
      return false
    }
    if (filter.memberIds.length > 0 && !card.memberIds.some((id) => filter.memberIds.includes(id))) {
      return false
    }
    return true
  }, [search, filter])

  const cardsByList = useMemo(() => {
    const map = new Map<string, Card[]>()
    for (const list of lists) {
      const listCards: Card[] = []
      for (const cardId of list.cardOrder) {
        const card = data.cards[cardId]
        if (card && !card.archived && cardMatches(card)) {
          listCards.push(card)
        }
      }
      map.set(list.id, listCards)
    }
    return map
  }, [lists, data.cards, cardMatches])

  const unscheduledCards = useMemo(() => {
    if (!board) return []
    const result: Card[] = []
    for (const list of lists) {
      for (const cardId of list.cardOrder) {
        const card = data.cards[cardId]
        if (card && !card.archived && !card.dueDate && cardMatches(card)) {
          result.push(card)
        }
      }
    }
    return result
  }, [board, lists, data.cards, cardMatches])

  const todayOffset = useMemo(() => {
    const diffMs = today.getTime() - startDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays * config.columnWidth
  }, [today, startDate, config.columnWidth])

  const getCardPosition = (card: Card) => {
    const start = card.startDate ? new Date(card.startDate) : null
    const end = card.dueDate ? new Date(card.dueDate) : null

    if (!end) return null

    const endMs = end.getTime()
    const startMs = start ? start.getTime() : endMs

    const left = ((startMs - startDate.getTime()) / (1000 * 60 * 60 * 24)) * config.columnWidth
    const width = Math.max(
      config.columnWidth * 0.5,
      ((endMs - startMs) / (1000 * 60 * 60 * 24) + 1) * config.columnWidth,
    )

    return { left: Math.max(0, left), width }
  }

  if (!board) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-3 sm:px-4">
        <h2 className="text-lg font-semibold text-text-primary">Timeline</h2>

        <div className="ml-2 flex items-center gap-1 rounded-lg bg-surface-alt p-0.5">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              aria-pressed={zoom === z}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                zoom === z
                  ? 'bg-primary text-primary-foreground'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {ZOOM_CONFIG[z].label}
            </button>
          ))}
        </div>

        <span className="ml-1 font-mono text-[11px] text-text-secondary">
          {formatDate(toISODate(startDate))} – {formatDate(toISODate(addDays(startDate, config.columns - 1)))}
        </span>
      </div>

      <div className="scroll-slim flex-1 overflow-auto">
        <div className="min-w-[600px]">
          {/* Time header */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-surface-elevated">
            <div className="w-[140px] shrink-0 border-r border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              List
            </div>
            <div className="relative flex-1 overflow-hidden" style={{ height: 40 }}>
              <div className="flex" style={{ width: totalWidth }}>
                {timeColumns.map((col, i) => {
                  const isToday = toISODate(col) === toISODate(today)
                  return (
                    <div
                      key={i}
                      className={`shrink-0 border-r border-border px-2 py-2 text-[10px] font-medium ${
                        isToday ? 'bg-primary-subtle font-semibold text-primary-hover' : 'font-mono text-text-secondary'
                      }`}
                      style={{ width: config.columnWidth }}
                    >
                      {formatDate(toISODate(col))}
                    </div>
                  )
                })}
              </div>
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 z-10 w-[3px] bg-primary"
                style={{ left: todayOffset }}
              />
            </div>
          </div>

          {/* List rows */}
          {lists.map((list, li) => {
            const listCards = cardsByList.get(list.id) ?? []
            const zebra = li % 2 === 1
            return (
              <div key={list.id} className={`flex border-b border-border ${zebra ? 'bg-surface-alt/20' : ''}`}>
                <div className="w-[140px] shrink-0 border-r border-border px-3 py-2.5">
                  <span className="truncate text-xs font-semibold text-text-primary">{list.name}</span>
                  <span className="ml-1 font-mono text-[10px] text-text-muted">{listCards.length}</span>
                </div>
                <div className="relative flex-1 overflow-hidden" style={{ height: Math.max(44, listCards.length * 30 + 18) }}>
                  <div className="flex" style={{ width: totalWidth }}>
                    {timeColumns.map((_, i) => (
                      <div
                        key={i}
                        className="shrink-0 border-r border-border/50"
                        style={{ width: config.columnWidth }}
                      />
                    ))}
                  </div>
                  {/* Today line */}
                  <div
                    className="absolute top-0 bottom-0 z-5 w-[3px] bg-primary/40"
                    style={{ left: todayOffset }}
                  />
                  {/* Cards */}
                  {listCards.map((card, ci) => {
                    const pos = getCardPosition(card)
                    if (!pos) return null
                    const label = card.labelIds[0] ? board.labels[card.labelIds[0]] : null
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onOpenCard(card.id)}
                        title={card.title}
                        className={`absolute flex items-center rounded-lg px-2 text-[10px] font-semibold text-white shadow-subtle transition-[filter,box-shadow,transform] duration-150 hover:brightness-110 hover:shadow-medium active:scale-[0.98] ${
                          card.done ? 'opacity-60' : ''
                        }`}
                        style={{
                          left: pos.left,
                          width: pos.width,
                          top: ci * 30 + 8,
                          background: label ? label.color : '#0DABA3',
                          height: 24,
                          textShadow: '0 1px 2px rgb(0 0 0 / 0.35)',
                        }}
                      >
                        <span className="truncate">{card.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Unscheduled */}
          {unscheduledCards.length > 0 && (
            <div className="flex border-b border-border bg-surface-alt/30">
              <div className="w-[140px] shrink-0 border-r border-border px-3 py-2.5">
                <span className="truncate text-xs font-semibold text-text-secondary">Unscheduled</span>
                <span className="ml-1 font-mono text-[10px] text-text-muted">{unscheduledCards.length}</span>
              </div>
              <div className="flex-1 px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {unscheduledCards.slice(0, 8).map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onOpenCard(card.id)}
                      className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[10px] font-medium text-text-primary ring-1 ring-border transition-shadow duration-150 hover:ring-primary active:scale-[0.98]"
                    >
                      {card.labelIds[0] && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: board.labels[card.labelIds[0]]?.color ?? '#0DABA3' }}
                        />
                      )}
                      {card.title}
                    </button>
                  ))}
                  {unscheduledCards.length > 8 && (
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] font-semibold text-primary-hover transition-colors duration-150 hover:underline"
                    >
                      +{unscheduledCards.length - 8} more
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
