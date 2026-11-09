'use client'

import { useState } from 'react'
import { FolderInput, ArrowRight } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

interface MoveCardDialogProps {
  card: Card
  onClose: () => void
}

export default function MoveCardDialog({ card, onClose }: MoveCardDialogProps) {
  const store = useStore()

  const boards = Object.values(store.data.boards).sort(
    (a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt),
  )

  const [boardId, setBoardId] = useState(boards[0]?.id ?? '')
  const lists = store.getLists(boardId)
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const targetCards = store.getCards(listId)
  const [position, setPosition] = useState(targetCards.length)

  const inputClass =
    'w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20'

  const handleBoardMove = () => {
    if (!listId) return
    store.moveCard(card.id, listId, position)
    // moveCard only updates listId — also update boardId when moving across boards
    const targetBoardId = store.data.lists[listId]?.boardId
    if (targetBoardId && targetBoardId !== card.boardId) {
      store.updateCard(card.id, { boardId: targetBoardId })
    }
    onClose()
  }

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-subtle text-primary-hover">
            <ArrowRight size={18} />
          </span>
          <h2 className="text-[17px] font-semibold text-text-primary">Move card</h2>
        </div>
        <p className="mt-1.5 truncate text-sm text-text-secondary" title={card.title}>
          &ldquo;{card.title}&rdquo;
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              Board
            </label>
            <select
              value={boardId}
              onChange={(e) => {
                const next = e.target.value
                setBoardId(next)
                const nextLists = store.getLists(next)
                setListId(nextLists[0]?.id ?? '')
                setPosition(store.getCards(nextLists[0]?.id ?? '').length)
              }}
              className={inputClass}
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.id === card.boardId ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              List
            </label>
            <select
              value={listId}
              onChange={(e) => {
                setListId(e.target.value)
                setPosition(store.getCards(e.target.value).length)
              }}
              className={inputClass}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className={inputClass}
            >
              {Array.from({ length: targetCards.length + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? 'Top' : i === targetCards.length ? 'Bottom' : `${i + 1}${ordinal(i + 1)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleBoardMove}
          disabled={!listId}
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
        >
          <ArrowRight size={15} />
          Move
        </button>
      </div>
    </Modal>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}