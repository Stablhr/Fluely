'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderInput, CalendarPlus } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

interface InboxActionModalProps {
  itemId: string
  mode: 'move' | 'schedule'
  onClose: () => void
}

export default function InboxActionModal({ itemId, mode, onClose }: InboxActionModalProps) {
  const { data, getLists, moveInboxToBoard, scheduleInboxItem } = useStore()
  const item = data.inbox.find((i) => i.id === itemId)
  const boards = Object.values(data.boards).sort(
    (a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt),
  )
  const [boardId, setBoardId] = useState(boards[0]?.id ?? '')
  const lists = getLists(boardId)
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  if (!item) return null

  const inputClass =
    'w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20'

  const confirm = () => {
    if (mode === 'move') moveInboxToBoard(item.id, boardId, listId)
    else scheduleInboxItem(item.id, boardId, date)
    onClose()
  }

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-subtle text-primary-hover">
            {mode === 'move' ? <FolderInput size={18} /> : <CalendarPlus size={18} />}
          </span>
          <h2 className="text-[17px] font-semibold text-text-primary">
            {mode === 'move' ? 'Move to board' : 'Schedule'}
          </h2>
        </div>
        <p className="mt-1.5 truncate text-sm text-text-secondary" title={item.text}>
          &quot;{item.text}&quot;
        </p>

        {boards.length === 0 ? (
          <div className="mt-5 rounded-md bg-surface-alt p-6 text-center">
            <p className="text-sm text-text-secondary">
              No boards yet — create one to move this capture into.
            </p>
            <Link
              href="/boards"
              onClick={onClose}
              className="mt-3 inline-block text-sm font-semibold text-primary-hover hover:underline"
            >
              Go to Boards
            </Link>
          </div>
        ) : (
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
                    const nextLists = getLists(next)
                    setListId(nextLists[0]?.id ?? '')
                  }}
                  className={inputClass}
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'move' && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                    List
                  </label>
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className={inputClass}
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mode === 'schedule' && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={!boardId || (mode === 'move' && !listId)}
              className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
            >
              {mode === 'move' ? <FolderInput size={15} /> : <CalendarPlus size={15} />}
              {mode === 'move' ? 'Move to board' : 'Schedule'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
