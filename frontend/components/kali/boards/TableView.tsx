'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Check, LayoutList } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import DueBadge from '../shared/DueBadge'
import LabelChip from '../shared/Chip'
import Avatar from '../shared/Avatar'
import type { BoardFilter } from './FilterPanel'

interface TableViewProps {
  boardId: string
  search: string
  filter: BoardFilter
  onOpenCard: (cardId: string) => void
}

type SortKey = 'title' | 'list' | 'labels' | 'members' | 'dueDate' | 'status'
type SortDir = 'asc' | 'desc'

interface SortState {
  key: SortKey
  dir: SortDir
}

const COLUMNS: { key: SortKey; label: string; width: string }[] = [
  { key: 'title', label: 'Card', width: 'minmax(200px, 1fr)' },
  { key: 'list', label: 'List', width: '140px' },
  { key: 'labels', label: 'Labels', width: '180px' },
  { key: 'members', label: 'Members', width: '140px' },
  { key: 'dueDate', label: 'Due Date', width: '120px' },
  { key: 'status', label: 'Status', width: '90px' },
]

function SortIcon({ colKey, sort }: { colKey: SortKey; sort: SortState }) {
  if (sort.key !== colKey) return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-40" />
  return sort.dir === 'asc'
    ? <ArrowUp size={12} className="text-primary-hover" />
    : <ArrowDown size={12} className="text-primary-hover" />
}

export default function TableView({ boardId, search, filter, onOpenCard }: TableViewProps) {
  const { data } = useStore()
  const board = data.boards[boardId]
  const [sort, setSort] = useState<SortState>({ key: 'title', dir: 'asc' })

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  const cards = useMemo(() => {
    if (!board) return []

    const lists = board.listOrder.map((id) => data.lists[id]).filter(Boolean)

    let allCards: (Card & { listName: string })[] = []
    for (const list of lists) {
      for (const cardId of list.cardOrder) {
        const card = data.cards[cardId]
        if (card && !card.archived) {
          allCards.push({ ...card, listName: list.name })
        }
      }
    }

    const query = search.trim().toLowerCase()
    if (query) {
      allCards = allCards.filter(
        (c) => c.title.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query),
      )
    }

    if (filter.labelIds.length > 0) {
      allCards = allCards.filter((c) => c.labelIds.some((id) => filter.labelIds.includes(id)))
    }
    if (filter.memberIds.length > 0) {
      allCards = allCards.filter((c) => c.memberIds.some((id) => filter.memberIds.includes(id)))
    }

    allCards.sort((a, b) => {
      let cmp = 0
      switch (sort.key) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'list':
          cmp = a.listName.localeCompare(b.listName)
          break
        case 'labels': {
          const aLabel = board.labels[a.labelIds[0]]?.name ?? ''
          const bLabel = board.labels[b.labelIds[0]]?.name ?? ''
          cmp = aLabel.localeCompare(bLabel)
          break
        }
        case 'members': {
          const aMember = data.members[a.memberIds[0]]?.name ?? ''
          const bMember = data.members[b.memberIds[0]]?.name ?? ''
          cmp = aMember.localeCompare(bMember)
          break
        }
        case 'dueDate':
          cmp = (a.dueDate ?? 'z').localeCompare(b.dueDate ?? 'z')
          break
        case 'status':
          cmp = (a.done ? 1 : 0) - (b.done ? 1 : 0)
          break
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })

    return allCards
  }, [board, data, search, filter, sort])

  if (!board) return null

  const gridTemplate = COLUMNS.map((c) => c.width).join(' ')

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Table</h2>
          <span className="font-mono text-xs text-text-secondary">{cards.length} cards</span>
        </div>
      </div>

      <div className="scroll-slim flex-1 overflow-auto">
        {cards.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <LayoutList size={32} className="text-text-muted" />
            <p className="text-sm text-text-secondary">No cards match your filters.</p>
          </div>
        ) : (
          <div
            className="min-w-[700px]"
            style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
          >
            {/* Header */}
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleSort(col.key)}
                className="group sticky top-0 z-10 flex items-center gap-1.5 border-b border-r border-border bg-surface-alt/90 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary backdrop-blur-sm transition-colors duration-150 hover:bg-surface-alt"
              >
                <span>{col.label}</span>
                <SortIcon colKey={col.key} sort={sort} />
              </button>
            ))}

            {/* Rows */}
            {cards.map((card, idx) => {
              const labels = card.labelIds
                .map((id) => board.labels[id])
                .filter(Boolean)
              const members = card.memberIds
                .map((id) => data.members[id])
                .filter(Boolean)

              const stripe = idx % 2 === 1 ? 'bg-surface-alt/25' : ''
              const hover = 'hover:bg-primary-subtle/40'

              return (
                <div
                  key={card.id}
                  onClick={() => onOpenCard(card.id)}
                  className="contents cursor-pointer"
                  role="row"
                >
                  {/* Title */}
                  <div className={`flex items-center gap-2 border-b border-r border-border px-3 py-2.5 transition-colors duration-150 ${stripe} ${hover}`}>
                    {card.done && <Check size={14} className="shrink-0 text-success" />}
                    <span className={`truncate text-sm font-medium ${card.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                      {card.title}
                    </span>
                  </div>

                  {/* List */}
                  <div className={`flex items-center border-b border-r border-border px-3 py-2.5 transition-colors duration-150 ${stripe} ${hover}`}>
                    <span className="truncate rounded-md bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-secondary">
                      {card.listName}
                    </span>
                  </div>

                  {/* Labels */}
                  <div className={`flex flex-wrap items-center gap-1 border-b border-r border-border px-3 py-2 transition-colors duration-150 ${stripe} ${hover}`}>
                    {labels.slice(0, 3).map((label) => (
                      <LabelChip key={label.id} label={label} />
                    ))}
                    {labels.length > 3 && (
                      <span className="rounded-full bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">
                        +{labels.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Members */}
                  <div className={`flex items-center border-b border-r border-border px-3 py-2.5 transition-colors duration-150 ${stripe} ${hover}`}>
                    <span className="flex -space-x-1">
                      {members.slice(0, 4).map((m) => (
                        <Avatar key={m.id} member={m} stacked />
                      ))}
                    </span>
                  </div>

                  {/* Due Date */}
                  <div className={`flex items-center border-b border-r border-border px-3 py-2.5 transition-colors duration-150 ${stripe} ${hover}`}>
                    {card.dueDate ? <DueBadge due={card.dueDate} /> : <span className="text-xs text-text-muted">—</span>}
                  </div>

                  {/* Status */}
                  <div className={`flex items-center border-b border-border px-3 py-2.5 transition-colors duration-150 ${stripe} ${hover}`}>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.03em] ${
                      card.done
                        ? 'bg-success-subtle text-success-text'
                        : 'bg-surface-alt text-text-secondary'
                    }`}>
                      {card.done ? 'Done' : 'Active'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
