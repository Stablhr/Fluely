'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { SocialPost, SocialPostStatus } from '@/lib/kali/store/schema'
import { formatDate } from '@/lib/kali/utils/dates'
import PlatformIcon from '../social/PlatformIcon'
import {
  columnForStatus,
  columnMeta,
  enabledPlatforms,
  platformColor,
  platformLabel,
  postDate,
  postTitle,
  sortPosts,
  statusLabel,
  type SortDir,
  type SortKey,
} from './planner-model'

export interface ContentPlannerTableProps {
  posts: SocialPost[]
  onOpenPost: (id: string) => void
}

interface Column {
  key: SortKey | null
  label: string
  className?: string
}

const COLUMNS: Column[] = [
  { key: 'title', label: 'Title' },
  { key: 'platform', label: 'Platform' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Scheduled' },
  { key: null, label: 'Tags' },
  { key: null, label: 'Linked board' },
]

export default function ContentPlannerTable({ posts, onOpenPost }: ContentPlannerTableProps) {
  const { boards, getCard } = useStore()
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const boardName = (cardId?: string) => {
    if (!cardId) return null
    const card = getCard(cardId)
    if (!card) return null
    const board = boards.find((b) => b.id === card.boardId)
    return board?.name ?? null
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = posts.filter((post) => {
      if (q) {
        const haystack = [
          postTitle(post),
          post.caption,
          post.notes ?? '',
          ...post.tags,
          ...enabledPlatforms(post),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      // Range filter deliberately keeps undated posts out: a date window is a
      // question about scheduled work, and silently including ideas would
      // misreport how much is actually planned for that window.
      if (from || to) {
        const date = postDate(post)
        if (!date) return false
        if (from && date < from) return false
        if (to && date > to) return false
      }
      return true
    })
    return sortPosts(filtered, sortKey, sortDir)
  }, [posts, query, from, to, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const hasFilters = query !== '' || from !== '' || to !== ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, caption, notes, tags…"
            aria-label="Search posts"
            className="w-[220px] rounded-md border border-border-strong bg-surface py-1.5 pl-7 pr-2 text-[12px] text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <label className="flex items-center gap-1 text-[11px] text-text-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Range start"
            className="rounded-md border border-border-strong bg-surface px-1.5 py-1 text-[11px] text-text-primary outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Range end"
            className="rounded-md border border-border-strong bg-surface px-1.5 py-1 text-[11px] text-text-primary outline-none focus:border-primary"
          />
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFrom('')
              setTo('')
            }}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-primary-text transition-colors duration-150 hover:bg-primary-subtle"
          >
            <X size={11} />
            Clear
          </button>
        )}

        <span className="ml-auto text-[11px] text-text-muted">
          {rows.length} of {posts.length}
        </span>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border">
              {COLUMNS.map((col) => {
                const active = col.key != null && sortKey === col.key
                const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th
                    key={col.label}
                    scope="col"
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                  >
                    {col.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key as SortKey)}
                        className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-text-primary"
                      >
                        {col.label}
                        <Icon size={11} className={active ? 'text-primary' : ''} />
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-[12px] text-text-muted">
                  {posts.length === 0 ? 'No posts yet.' : 'No posts match these filters.'}
                </td>
              </tr>
            )}

            {rows.map((post) => {
              const platforms = enabledPlatforms(post)
              const date = postDate(post)
              const stage = columnMeta(columnForStatus(post.status))
              const linked = boardName(post.cardId)

              return (
                <tr
                  key={post.id}
                  onClick={() => onOpenPost(post.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenPost(post.id)
                  }}
                  aria-label={`Edit post: ${postTitle(post)}`}
                  className="cursor-pointer border-b border-border transition-colors duration-150 hover:bg-surface-alt focus-visible:bg-primary-subtle focus-visible:outline-none"
                >
                  <td className="max-w-[280px] px-3 py-2">
                    <p className="truncate text-[12px] font-medium text-text-primary">{postTitle(post)}</p>
                    {post.caption && (
                      <p className="truncate text-[11px] text-text-muted">{post.caption}</p>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <p className="flex flex-wrap items-center gap-1">
                      {platforms.length === 0 && <span className="text-[11px] text-text-muted">—</span>}
                      {platforms.map((platform) => (
                        <span
                          key={platform}
                          title={platformLabel(platform)}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                          style={{ background: platformColor(platform) }}
                        >
                          <PlatformIcon platform={platform} size={9} />
                        </span>
                      ))}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        stage.pill
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                      {statusLabel(post.status as SocialPostStatus)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-text-secondary">
                    {date ? `${formatDate(date)}${post.scheduledTime ? ` ${post.scheduledTime}` : ''}` : '—'}
                  </td>

                  <td className="max-w-[160px] px-3 py-2">
                    <p className="flex flex-wrap gap-1">
                      {post.tags.length === 0 && <span className="text-[11px] text-text-muted">—</span>}
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </p>
                  </td>

                  <td className="max-w-[140px] px-3 py-2">
                    <p className="truncate text-[11px] text-text-secondary">
                      {linked ?? (post.cardId ? 'Removed board' : '—')}
                    </p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
