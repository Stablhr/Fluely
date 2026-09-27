'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import type { SocialPost } from '@/lib/kali/store/schema'
import { addDays, formatDate, startOfWeek, toISODate } from '@/lib/kali/utils/dates'
import PlatformIcon from '../social/PlatformIcon'
import {
  columnMeta,
  columnForStatus,
  enabledPlatforms,
  platformColor,
  postDate,
  postTitle,
} from './planner-model'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_CELLS = 42
/** Pills shown per day before collapsing into a "+N more" trigger. */
const MAX_PILLS = 3

type Mode = 'month' | 'week'

export interface ContentPlannerCalendarProps {
  posts: SocialPost[]
  onOpenPost: (id: string) => void
  /** Opens the editor in create mode, prefilled with the tapped day. */
  onCreateOn: (date: string) => void
}

export default function ContentPlannerCalendar({ posts, onOpenPost, onCreateOn }: ContentPlannerCalendarProps) {
  const [mode, setMode] = useState<Mode>('month')
  const [anchor, setAnchor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [popover, setPopover] = useState<string | null>(null)

  const today = toISODate(new Date())

  const byDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const post of posts) {
      const date = postDate(post)
      if (!date) continue
      const list = map.get(date)
      if (list) list.push(post)
      else map.set(date, [post])
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? ''))
    }
    return map
  }, [posts])

  const step = (dir: 1 | -1) =>
    setAnchor((a) => (mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * 7)))

  const goToday = () => {
    const now = new Date()
    setAnchor(mode === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : startOfWeek(now))
  }

  const label =
    mode === 'month'
      ? anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `${formatDate(toISODate(startOfWeek(anchor)))} – ${formatDate(toISODate(addDays(startOfWeek(anchor), 6)))}`

  // Close the day popover on any outside click.
  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!popover) return
    const onDown = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setPopover(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [popover])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous" onClick={() => step(-1)}>
            <ChevronLeft size={15} />
          </IconButton>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-primary-text transition-colors duration-150 hover:bg-primary-subtle"
          >
            Today
          </button>
          <IconButton label="Next" onClick={() => step(1)}>
            <ChevronRight size={15} />
          </IconButton>
        </div>

        <span className="font-heading text-sm font-semibold text-text-primary">{label}</span>

        <div className="ml-auto flex items-center gap-0.5 rounded-md bg-surface-alt p-0.5">
          {(['month', 'week'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize transition-colors duration-150 ${
                mode === m ? 'bg-surface text-text-primary shadow-subtle' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-auto">
        {mode === 'month' ? (
          <MonthGrid
            anchor={anchor}
            today={today}
            byDate={byDate}
            popover={popover}
            popoverRef={popoverRef}
            onTogglePopover={setPopover}
            onOpenPost={onOpenPost}
            onCreateOn={onCreateOn}
          />
        ) : (
          <WeekGrid
            anchor={anchor}
            today={today}
            byDate={byDate}
            onOpenPost={onOpenPost}
            onCreateOn={onCreateOn}
          />
        )}
      </div>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary active:scale-[0.98]"
    >
      {children}
    </button>
  )
}

function PostPill({ post, onClick }: { post: SocialPost; onClick: () => void }) {
  const platforms = enabledPlatforms(post)
  const dot = columnMeta(columnForStatus(post.status)).dot
  const accent = platforms.length === 1 ? platformColor(platforms[0]) : platformColor(platforms[0] ?? 'instagram')

  return (
    <button
      type="button"
      onClick={onClick}
      title={postTitle(post)}
      className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors duration-150 hover:bg-surface-alt"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {platforms.length > 0 && (
        <span
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: accent }}
        >
          <PlatformIcon platform={platforms[0]} size={8} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] text-text-primary">{postTitle(post)}</span>
    </button>
  )
}

interface GridProps {
  anchor: Date
  today: string
  byDate: Map<string, SocialPost[]>
  onOpenPost: (id: string) => void
  onCreateOn: (date: string) => void
}

function MonthGrid({
  anchor,
  today,
  byDate,
  popover,
  popoverRef,
  onTogglePopover,
  onOpenPost,
  onCreateOn,
}: GridProps & {
  popover: string | null
  popoverRef: React.RefObject<HTMLDivElement | null>
  onTogglePopover: (date: string | null) => void
}) {
  const cells = useMemo(() => {
    const start = startOfWeek(anchor)
    return Array.from({ length: MONTH_CELLS }, (_, i) => addDays(start, i))
  }, [anchor])

  return (
    <div className="min-w-[560px]">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const iso = toISODate(day)
          const dayPosts = byDate.get(iso) ?? []
              const outside = day.getMonth() !== anchor.getMonth()
          const isToday = iso === today
          const open = popover === iso

          return (
            <div
              key={iso}
              /* `group` is what makes the hover-revealed + button work, and it
                 is always visible on touch widths where there is no hover. */
              className={`group relative min-h-[104px] border-b border-r border-border p-1.5 ${
                outside ? 'bg-surface-alt/40' : 'bg-surface'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onTogglePopover(open ? null : iso)}
                  aria-label={`${formatDate(iso)} — ${dayPosts.length} posts`}
                  aria-expanded={open}
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold transition-colors duration-150 ${
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:bg-surface-alt'
                  }`}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={() => onCreateOn(iso)}
                  aria-label={`Add post on ${formatDate(iso)}`}
                  className="rounded p-0.5 text-text-muted transition-opacity duration-150 hover:bg-surface-alt hover:text-text-primary focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="space-y-0.5">
                {dayPosts.slice(0, MAX_PILLS).map((post) => (
                  <PostPill key={post.id} post={post} onClick={() => onOpenPost(post.id)} />
                ))}
                {dayPosts.length > MAX_PILLS && (
                  <button
                    type="button"
                    onClick={() => onTogglePopover(iso)}
                    className="px-1 text-[10px] font-semibold text-primary-text hover:underline"
                  >
                    +{dayPosts.length - MAX_PILLS} more
                  </button>
                )}
              </div>

              {open && (
                <div
                  ref={popoverRef}
                  className="absolute left-1 top-8 z-30 w-[248px] rounded-xl border border-border bg-surface p-2 shadow-modal"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-text-primary">
                      {formatDate(iso)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onTogglePopover(null)}
                      aria-label="Close day"
                      className="rounded p-0.5 text-text-muted hover:bg-surface-alt hover:text-text-primary"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {dayPosts.length === 0 ? (
                      <p className="px-1 py-1.5 text-[11px] text-text-muted">Nothing scheduled.</p>
                    ) : (
                      dayPosts.map((post) => (
                        <PostPill key={post.id} post={post} onClick={() => onOpenPost(post.id)} />
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateOn(iso)}
                    className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-primary-subtle py-1 text-[11px] font-semibold text-primary-text transition-colors duration-150 hover:bg-primary hover:text-primary-foreground"
                  >
                    <Plus size={11} />
                    Add post
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ anchor, today, byDate, onOpenPost, onCreateOn }: GridProps) {
  const start = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  return (
    <div className="grid h-full min-w-[560px] grid-cols-7 divide-x divide-border">
      {days.map((day) => {
        const iso = toISODate(day)
        const dayPosts = byDate.get(iso) ?? []
        const isToday = iso === today

        return (
          <div key={iso} className="flex min-h-0 flex-col">
            <div className="shrink-0 border-b border-border px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {WEEKDAYS[(day.getDay() + 6) % 7]}
                </span>
                <button
                  type="button"
                  onClick={() => onCreateOn(iso)}
                  aria-label={`Add post on ${formatDate(iso)}`}
                  className="rounded p-0.5 text-text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-text-secondary'
                }`}
              >
                {day.getDate()}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
              {dayPosts.length === 0 ? (
                <p className="px-1 py-1.5 text-[11px] text-text-muted">—</p>
              ) : (
                dayPosts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-md border border-border bg-surface p-1.5 transition-colors duration-150 hover:bg-surface-alt"
                  >
                    <PostPill post={post} onClick={() => onOpenPost(post.id)} />
                    {post.scheduledTime && (
                      <p className="mt-0.5 pl-1 font-mono text-[10px] text-text-muted">{post.scheduledTime}</p>
                    )}
                    {post.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary"
                          >
                            {tag}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
