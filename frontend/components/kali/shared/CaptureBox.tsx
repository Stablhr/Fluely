'use client'

import { useEffect, useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { useToast } from '@/components/kali/shared/useToastState'
import { YOU_ID } from '@/lib/kali/store/schema'
import Link from 'next/link'

const LAST_BOARD_KEY = 'fluely:lastCaptureBoard'

export default function CaptureBox({ autoFocus = false, variant = 'sidebar' }: { autoFocus?: boolean; variant?: 'sidebar' | 'dash' }) {
  const store = useStore()
  const { toast } = useToast()
  const { data } = store

  const writableBoards = Object.values(data.boards)
    .filter((b) => store.canWrite(b.id))
    .sort((a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt))

  const [text, setText] = useState('')
  const [boardId, setBoardId] = useState<string>('')

  useEffect(() => {
    if (writableBoards.length === 0) {
      setBoardId('')
      return
    }
    const userId = data.members[YOU_ID]?.id ?? 'anon'
    const last = typeof window !== 'undefined' ? window.localStorage.getItem(`${LAST_BOARD_KEY}:${userId}`) : null
    if (last && writableBoards.some((b) => b.id === last)) {
      setBoardId(last)
      return
    }
    setBoardId(writableBoards[0].id)
  }, [writableBoards.map((b) => b.id).join(','), data.members[YOU_ID]?.id])

  const submit = () => {
    const t = text.trim()
    if (!t || !boardId) return
    const lists = store.getLists(boardId)
    const firstList = lists[0]
    if (!firstList) {
      toast('This board has no lists yet.', 'info')
      return
    }
    const cardId = store.addCard(firstList.id, t)
    const board = data.boards[boardId]
    const boardName = board?.name ?? 'board'
    if (typeof window !== 'undefined') {
      const userId = data.members[YOU_ID]?.id ?? 'anon'
      window.localStorage.setItem(`${LAST_BOARD_KEY}:${userId}`, boardId)
    }
    setText('')
    toast(`Added to ${boardName}`, 'success', {
      action: {
        label: 'Undo',
        onClick: () => store.deleteCard(cardId),
      },
      duration: 5000,
    })
  }

  if (writableBoards.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border bg-surface p-2 text-sm text-text-muted ${
          variant === 'dash' ? 'max-w-md' : ''
        }`}
      >
        <span>No boards you can write to yet.</span>
        <Link href="/boards" className="font-semibold text-primary-text underline underline-offset-2">
          Create a board
        </Link>
      </div>
    )
  }

  const containerClass =
    variant === 'sidebar'
      ? 'rounded-lg border bg-surface p-1.5'
      : 'rounded-card bg-base-surface p-2 shadow-card transition-shadow duration-150 focus-within:ring-2 focus-within:ring-primary/30 hover:shadow-card-hover'

  return (
    <div
      className={`flex items-center gap-1 transition-colors duration-150 focus-within:border-primary ${containerClass}`}
      style={variant === 'sidebar' ? { borderColor: 'var(--surface-border)' } : undefined}
    >
      <button
        type="button"
        onClick={submit}
        title="Capture a task"
        className={`flex shrink-0 items-center justify-center rounded-md text-primary transition-colors duration-150 hover:bg-primary-subtle active:scale-[0.98] ${
          variant === 'sidebar' ? 'h-7 w-7' : 'h-8 w-8'
        }`}
      >
        <Plus size={16} />
      </button>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="Capture a task."
        autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
      />
      <label className="relative flex shrink-0 items-center">
        <select
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          aria-label="Capture board"
          className="appearance-none bg-transparent pr-4 text-xs font-medium text-text-secondary outline-none"
        >
          {writableBoards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-0 text-text-muted" />
      </label>
    </div>
  )
}
