'use client'

import { useState } from 'react'
import { X, RotateCcw, Trash2, List } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

type Tab = 'cards' | 'lists'

export default function ArchivedPanel({ board, onClose }: { board: Board; onClose: () => void }) {
  const { data, restoreCard, deleteCard, restoreList } = useStore()
  const [tab, setTab] = useState<Tab>('cards')

  const archivedCards = Object.values(data.cards).filter(
    (c) => c.boardId === board.id && c.archived,
  )

  const archivedLists = board.archivedLists ?? []

  const tabBtn = (t: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
        tab === t
          ? 'bg-primary text-primary-foreground'
          : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
      }`}
    >
      {label}
      <span className="ml-1 font-mono text-[10px]">{count}</span>
    </button>
  )

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="flex items-start justify-between px-6 pt-5">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Archived items</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{board.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close archived items"
          className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-6 pt-4">
        <div className="flex gap-1">
          {tabBtn('cards', 'Cards', archivedCards.length)}
          {tabBtn('lists', 'Lists', archivedLists.length)}
        </div>
      </div>

      <div className="scroll-slim max-h-[50vh] overflow-y-auto px-6 py-4">
        {tab === 'cards' && (
          <div className="space-y-1.5">
            {archivedCards.length === 0 && (
              <p className="rounded-md bg-surface-alt px-3 py-3 text-center text-xs text-text-muted">
                No archived cards.
              </p>
            )}
            {archivedCards.map((card) => (
              <div key={card.id} className="flex items-center gap-2 rounded-md bg-surface-alt px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{card.title}</p>
                  <p className="truncate font-mono text-[11px] text-text-secondary">
                    {data.lists[card.listId]?.name ?? 'Unknown list'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreCard(card.id)}
                  title="Restore to board"
                  className="rounded-md p-1.5 text-primary-hover transition-colors duration-150 hover:bg-primary-subtle"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${card.title}"?`)) deleteCard(card.id)
                  }}
                  title="Delete permanently"
                  className="rounded-md p-1.5 text-text-muted transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'lists' && (
          <div className="space-y-1.5">
            {archivedLists.length === 0 && (
              <p className="rounded-md bg-surface-alt px-3 py-3 text-center text-xs text-text-muted">
                No archived lists.
              </p>
            )}
            {archivedLists.map((entry, index) => (
              <div key={entry.list.id} className="flex items-center gap-2 rounded-md bg-surface-alt px-3 py-2">
                <List size={15} className="shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{entry.list.name}</p>
                  <p className="font-mono text-[11px] text-text-secondary">
                    {entry.cards.length} card{entry.cards.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreList(board.id, index)}
                  title="Restore list to board"
                  className="rounded-md p-1.5 text-primary-hover transition-colors duration-150 hover:bg-primary-subtle"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end px-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
