'use client'

import Link from 'next/link'
import { Star, Clock3, LayoutGrid } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { formatDate } from '@/lib/kali/utils/dates'

function boardColor(bg?: string): string {
  if (!bg || bg.startsWith('data:') || bg.startsWith('http') || bg.startsWith('linear-') || bg.startsWith('radial-')) {
    return 'var(--color-primary)'
  }
  return bg
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso.slice(0, 10))
}

export default function RecentBoardsList({ limit = 4 }: { limit?: number }) {
  const { data } = useStore()

  const boards = Object.values(data.boards)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)

  return (
    <div className="rounded-card bg-base-surface p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-accent-teal-bg">
          <Clock3 size={14} className="text-accent-teal-text" />
        </span>
        <h2 className="text-label uppercase text-ink-500">Recently active</h2>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {boards.map((board) => {
          const color = boardColor(board.background)
          return (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className="flex items-center gap-3 rounded-card bg-base-surface-alt p-4 transition-shadow duration-150 hover:shadow-card"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip"
                style={{ background: `${color}1A`, color }}
              >
                <LayoutGrid size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-card-title text-ink-900">{board.name}</span>
                <span className="block text-[11px] text-ink-500">
                  Updated {relativeTime(board.updatedAt)}
                </span>
              </span>
              {board.starred && (
                <Star size={14} className="shrink-0 fill-warning text-warning" />
              )}
            </Link>
          )
        })}
        {boards.length === 0 && (
          <p className="col-span-full rounded-md px-2 py-3 text-center text-body font-medium text-ink-500">
            No boards yet.
          </p>
        )}
      </div>
    </div>
  )
}