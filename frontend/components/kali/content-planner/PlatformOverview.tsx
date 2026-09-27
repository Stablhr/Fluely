'use client'

import { useMemo } from 'react'
import type { Platform, SocialPost } from '@/lib/kali/store/schema'
import PlatformIcon from '../social/PlatformIcon'
import {
  ALL_PLATFORMS,
  OVERVIEW_BLOCKS,
  OVERVIEW_BLOCK_INK,
  columnForStatus,
  enabledPlatforms,
  platformLabel,
  postDate,
} from './planner-model'

export interface PlatformOverviewProps {
  posts: SocialPost[]
  /** The current filter, so the active card reads as selected. */
  active: Platform | 'all'
  onSelect: (platform: Platform | 'all') => void
}

const TOTAL_BLOCK = 'bg-brand-ink'

interface Counts {
  total: number
  scheduled: number
  posted: number
  draft: number
  /** Distinct days that carry at least one post for this platform. */
  activeDays: number
}

const EMPTY: Counts = { total: 0, scheduled: 0, posted: 0, draft: 0, activeDays: 0 }

function countFor(posts: SocialPost[], platform: Platform | 'all'): Counts {
  const relevant =
    platform === 'all' ? posts : posts.filter((p) => enabledPlatforms(p).includes(platform))
  if (relevant.length === 0) return EMPTY

  const days = new Set<string>()
  for (const post of relevant) {
    const date = postDate(post)
    if (date) days.add(date)
  }

  let scheduled = 0
  let posted = 0
  let draft = 0
  for (const post of relevant) {
    const stage = columnForStatus(post.status)
    if (stage === 'posted') posted += 1
    else if (stage === 'scheduled') scheduled += 1
    else draft += 1
  }

  return { total: relevant.length, scheduled, posted, draft, activeDays: days.size }
}

export default function PlatformOverview({ posts, active, onSelect }: PlatformOverviewProps) {
  const counts = useMemo(
    () => ({
      all: countFor(posts, 'all'),
      byPlatform: Object.fromEntries(
        ALL_PLATFORMS.map((platform) => [platform, countFor(posts, platform)]),
      ) as Record<Platform, Counts>,
    }),
    [posts],
  )

  return (
    <section aria-label="Platform overview" className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
      {(['all', ...ALL_PLATFORMS] as const).map((key) => {
        const countsForKey = key === 'all' ? counts.all : counts.byPlatform[key]
        const isActive = active === key
        // The "all" card is ink, not one of the rotating brand blocks, so its
        // ink colour is decided alongside the block rather than looked up.
        const block = key === 'all' ? null : OVERVIEW_BLOCKS[ALL_PLATFORMS.indexOf(key)]
        const ink = block ? OVERVIEW_BLOCK_INK[block] : 'text-brand-ivory'

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={isActive}
            className={`group flex flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-all duration-150 ${
              isActive
                ? 'border-primary ring-2 ring-primary/25'
                : 'border-border hover:border-border-strong'
            }`}
          >
            <span className={`flex items-center gap-2 px-3 py-2 ${block ?? TOTAL_BLOCK} ${ink}`}>
              {key === 'all' ? (
                <span className="text-[13px] font-semibold">All channels</span>
              ) : (
                <>
                  <PlatformIcon platform={key} size={14} />
                  <span className="text-[13px] font-semibold">{platformLabel(key)}</span>
                </>
              )}
            </span>

            <span className="flex items-baseline gap-1.5 px-3 pt-2">
              <span className="font-heading text-2xl font-bold leading-none text-text-primary">
                {countsForKey.total}
              </span>
              <span className="text-[11px] text-text-muted">
                {countsForKey.total === 1 ? 'post' : 'posts'}
              </span>
            </span>

            <span className="mt-2 flex flex-wrap gap-1 px-3 pb-2.5">
              <Stat label="Scheduled" value={countsForKey.scheduled} tone="text-primary-text" />
              <Stat label="Posted" value={countsForKey.posted} tone="text-success-text" />
              <Stat label="In progress" value={countsForKey.draft} tone="text-text-secondary" />
            </span>

            {countsForKey.activeDays > 0 && (
              <span className="mt-auto border-t border-border px-3 py-1.5 text-[11px] text-text-muted">
                {countsForKey.activeDays} {countsForKey.activeDays === 1 ? 'day' : 'days'} with posts
              </span>
            )}
          </button>
        )
      })}
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
      <span className={tone}>{value}</span> {label}
    </span>
  )
}
