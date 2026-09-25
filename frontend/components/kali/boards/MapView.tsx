'use client'

import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { Card } from '@/lib/kali/store/schema'
import type { BoardFilter } from './FilterPanel'

interface MapViewProps {
  boardId: string
  search: string
  filter: BoardFilter
  onOpenCard: (cardId: string) => void
}

interface LocatedCard extends Card {
  listName: string
}

export default function MapView({ boardId, search, filter, onOpenCard }: MapViewProps) {
  const { data } = useStore()
  const board = data.boards[boardId]

  const cards = useMemo(() => {
    if (!board) return []
    const lists = board.listOrder.map((id) => data.lists[id]).filter(Boolean)
    let result: LocatedCard[] = []
    for (const list of lists) {
      for (const cardId of list.cardOrder) {
        const card = data.cards[cardId]
        if (card && !card.archived) {
          result.push({ ...card, listName: list.name })
        }
      }
    }

    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (c) => c.title.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query),
      )
    }
    if (filter.labelIds.length > 0) {
      result = result.filter((c) => c.labelIds.some((id) => filter.labelIds.includes(id)))
    }
    if (filter.memberIds.length > 0) {
      result = result.filter((c) => c.memberIds.some((id) => filter.memberIds.includes(id)))
    }

    return result
  }, [board, data.lists, data.cards, search, filter])

  const withLocation = useMemo(() => cards.filter((c) => c.location.trim()), [cards])
  const withoutLocation = useMemo(() => cards.filter((c) => !c.location.trim()), [cards])

  const groupedByLocation = useMemo(() => {
    const map = new Map<string, LocatedCard[]>()
    for (const card of withLocation) {
      const loc = card.location.trim()
      const existing = map.get(loc) ?? []
      existing.push(card)
      map.set(loc, existing)
    }
    return Array.from(map.entries())
  }, [withLocation])

  const isFiltering = search.trim().length > 0 || filter.labelIds.length > 0 || filter.memberIds.length > 0

  if (!board) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-3 sm:px-4">
        <h2 className="text-lg font-semibold text-text-primary">Map</h2>
        <span className="font-mono text-xs text-text-secondary">
          {withLocation.length} with location, {withoutLocation.length} without
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Map area */}
        <div className="relative flex-1 bg-surface-alt">
          {withLocation.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-subtle">
                <MapPin size={28} className="text-primary-hover" />
              </div>
              <p className="text-sm font-medium text-text-primary">
                {isFiltering ? 'No location matches your filters' : 'No cards have locations yet'}
              </p>
              <p className="max-w-xs text-center text-sm text-text-secondary">
                {isFiltering
                  ? 'Try adjusting your search or filters to see cards with locations.'
                  : 'Add a location to a card from its detail view to see it on the map.'}
              </p>
            </div>
          ) : (
            <div className="h-full overflow-auto p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupedByLocation.map(([location, groupCards]) => (
                  <div key={location} className="overflow-hidden rounded-lg border border-border bg-surface shadow-subtle">
                    <div className="flex items-center gap-2 border-b border-border bg-surface-alt/60 px-3 py-2">
                      <MapPin size={13} className="shrink-0 text-primary-hover" />
                      <span className="truncate text-xs font-semibold text-text-primary">{location}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                        {groupCards.length}
                      </span>
                    </div>
                    <div className="space-y-0.5 p-1.5">
                      {groupCards.map((card) => {
                        const label = card.labelIds[0] ? board.labels[card.labelIds[0]] : null
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => onOpenCard(card.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-primary-subtle/40 active:scale-[0.99]"
                          >
                            {label ? (
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: label.color }}
                              />
                            ) : (
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-border-strong" />
                            )}
                            <span className={`truncate text-sm font-medium ${card.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                              {card.title}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: cards without location */}
        {withoutLocation.length > 0 && (
          <div className="w-[240px] shrink-0 overflow-auto border-l border-border bg-surface p-3 hidden lg:block">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Without Location
              </p>
              <span className="rounded-full bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                {withoutLocation.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {withoutLocation.slice(0, 20).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onOpenCard(card.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
                >
                  <MapPin size={12} className="shrink-0 text-text-muted" />
                  <span className="truncate">{card.title}</span>
                </button>
              ))}
              {withoutLocation.length > 20 && (
                <p className="px-2 text-[10px] text-text-muted">
                  +{withoutLocation.length - 20} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
