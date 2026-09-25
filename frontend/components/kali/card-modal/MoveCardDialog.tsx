'use client'

import { useState } from 'react'
import { FolderInput, Inbox, ArrowRight } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

interface MoveCardDialogProps {
  card: Card
  onClose: () => void
}

export default function MoveCardDialog({ card, onClose }: MoveCardDialogProps) {
  const store = useStore()
  const [tab, setTab] = useState<'board' | 'inbox'>('board')
  const [confirmInbox, setConfirmInbox] = useState(false)

  const boards = Object.values(store.data.boards).sort(
    (a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt),
  )

  const currentBoard = store.data.boards[card.boardId]
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

  const handleInboxMove = () => {
    if (!confirmInbox) {
      setConfirmInbox(true)
      return
    }
    store.addActivity(card.id, 'moved to Inbox')
    store.addInboxItem(card.title)
    store.deleteCard(card.id)
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

        {/* Tabs */}
        <div className="mt-5 flex gap-1 rounded-lg bg-surface-alt p-0.5">
          <button
            type="button"
            onClick={() => setTab('board')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              tab === 'board'
                ? 'bg-surface text-text-primary shadow-subtle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FolderInput size={13} className="mr-1 inline" />
            Board
          </button>
          <button
            type="button"
            onClick={() => setTab('inbox')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              tab === 'inbox'
                ? 'bg-surface text-text-primary shadow-subtle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Inbox size={13} className="mr-1 inline" />
            Inbox
          </button>
        </div>

        {tab === 'board' && (
          <>
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
          </>
        )}

        {tab === 'inbox' && (
          <>
            <div className="mt-5 rounded-md bg-surface-alt p-4">
              <p className="text-sm text-text-secondary">
                This will remove the card from <span className="font-semibold text-text-primary">{currentBoard?.name ?? 'its board'}</span> and
                convert it to a plain Inbox item.
              </p>
              <p className="mt-2 text-xs text-text-muted">
                All labels, cover, attachments, comments, and reactions will be discarded.
                {/* MVP: discards card data on demotion. Preserve for re-promotion in a future iteration. */}
              </p>
            </div>

            <button
              type="button"
              onClick={handleInboxMove}
              className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] ${
                confirmInbox
                  ? 'bg-danger-button text-white hover:bg-danger-button/90'
                  : 'bg-warning-subtle text-warning-text hover:brightness-95 dark:hover:brightness-110'
              }`}
            >
              <Inbox size={15} />
              {confirmInbox ? 'Confirm move to Inbox' : 'Move to Inbox'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
