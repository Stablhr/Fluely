'use client'

import Link from 'next/link'
import { Clock3, Columns3, Star } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { formatDate } from '@/lib/kali/utils/dates'
import { Panel } from './Panel'

function swatch(bg?: string): React.CSSProperties {
  if (!bg) return { background: 'var(--color-surface-alt)' }
  if (bg.startsWith('data:') || bg.startsWith('http')) return { background: `url(${bg}) center/cover` }
  return { background: bg }
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso.slice(0, 10))
}

export default function RecentBoardsList({ boards }: { boards: Board[] }) {
  return (
    <Panel>
      <Panel.Header icon={Clock3} title="Recent boards" action={<Panel.Link href="/boards">All</Panel.Link>} />
      {boards.length === 0 ? (
        <Panel.Empty
          icon={Columns3}
          title="No boards yet"
          description="Create a board to start planning your work."
        />
      ) : (
        <ul className="flex-1 py-1">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="group flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span aria-hidden className="h-7 w-7 shrink-0 rounded-chip ring-1 ring-inset ring-black/10" style={swatch(board.background)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text-primary group-hover:text-primary-text">
                    {board.name}
                  </span>
                  <span className="block text-[12px] text-text-muted">Updated {relativeTime(board.updatedAt)}</span>
                </span>
                {board.starred && <Star size={14} aria-label="Starred" className="shrink-0 fill-warning text-warning" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
