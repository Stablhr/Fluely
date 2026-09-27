import type { Platform, SocialPost, SocialPostStatus } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS } from '@/lib/kali/store/schema'

/* ── Planning columns ────────────────────────────────────────── */

export type PostColumnId = 'idea' | 'draft' | 'in_review' | 'scheduled' | 'posted'

export interface PostColumn {
  id: PostColumnId
  label: string
  /** Tailwind classes for the column header dot and the card's left accent. */
  dot: string
  pill: string
  /** Resolved by POST_COLUMN_FOR_STATUS below — kept as data for the board. */
  primary: SocialPostStatus
}

/**
 * The five planning stages the board, table and detail panel all share.
 * Statuses not listed here (publishing, failed, cancelled, …) are folded into
 * the nearest stage by POST_COLUMN_FOR_STATUS so no post can fall out of the
 * board — a failed publish is still a post someone has to act on.
 */
export const POST_COLUMNS: PostColumn[] = [
  { id: 'idea', label: 'Idea', dot: 'bg-ink-faint', pill: 'bg-elevated text-text-secondary', primary: 'idea' },
  { id: 'draft', label: 'Draft', dot: 'bg-info', pill: 'bg-info-subtle text-info-text', primary: 'draft' },
  { id: 'in_review', label: 'In Review', dot: 'bg-warning', pill: 'bg-warning-subtle text-warning-text', primary: 'in_review' },
  { id: 'scheduled', label: 'Scheduled', dot: 'bg-primary', pill: 'bg-primary-subtle text-primary-text', primary: 'scheduled' },
  { id: 'posted', label: 'Posted', dot: 'bg-success', pill: 'bg-success-subtle text-success-text', primary: 'posted' },
]

const POST_COLUMN_FOR_STATUS: Record<SocialPostStatus, PostColumnId> = {
  idea: 'idea',
  draft: 'draft',
  in_review: 'in_review',
  scheduled: 'scheduled',
  // mid-flight
  publishing: 'scheduled',
  // went out, at least partially
  posted: 'posted',
  partially_published: 'posted',
  // never went out — stays in the pipeline for a human
  failed: 'scheduled',
  cancelled: 'draft',
}

export function columnForStatus(status: SocialPostStatus): PostColumnId {
  return POST_COLUMN_FOR_STATUS[status]
}

export function columnMeta(id: PostColumnId): PostColumn {
  return POST_COLUMNS.find((c) => c.id === id) ?? POST_COLUMNS[0]
}

/** Every selectable status, i.e. the three planning stages plus the two live ones. */
export const SELECTABLE_STATUSES: SocialPostStatus[] = ['idea', 'draft', 'in_review', 'scheduled', 'posted']

/**
 * The five stages as a plain `{ value, label, dot }` list, for pickers that want
 * a status rather than a column. Dot colours are the same brand tokens the
 * board uses for its column headers.
 */
export const PLANNER_STAGES: { value: SocialPostStatus; label: string; dot: string }[] = [
  { value: 'idea', label: 'Idea', dot: 'bg-ink-faint' },
  { value: 'draft', label: 'Draft', dot: 'bg-info' },
  { value: 'in_review', label: 'In Review', dot: 'bg-warning' },
  { value: 'scheduled', label: 'Scheduled', dot: 'bg-primary' },
  { value: 'posted', label: 'Posted', dot: 'bg-success' },
]


export const STATUS_LABELS: Record<SocialPostStatus, string> = {
  idea: 'Idea',
  draft: 'Draft',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  posted: 'Posted',
  partially_published: 'Partially Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function statusLabel(status: SocialPostStatus): string {
  return STATUS_LABELS[status] ?? status
}

/* ── Platforms ───────────────────────────────────────────────── */

export const ALL_PLATFORMS: Platform[] = ['instagram', 'facebook', 'tiktok', 'youtube']

/**
 * Flat colour blocks for the overview cards, rotating through the brand palette
 * rather than each platform's own brand colour — the platform's real colour is
 * reserved for the icons and accents, so the cards read as one set.
 */
export const OVERVIEW_BLOCKS = [
  'bg-brand-blue',
  'bg-brand-green',
  'bg-brand-vanilla',
  'bg-blue-deep',
] as const

/** Text that stays legible on each block above. */
export const OVERVIEW_BLOCK_INK: Record<(typeof OVERVIEW_BLOCKS)[number], string> = {
  'bg-brand-blue': 'text-brand-ivory',
  'bg-brand-green': 'text-brand-ink',
  'bg-brand-vanilla': 'text-brand-ink',
  'bg-blue-deep': 'text-brand-ivory',
}

export function platformLabel(platform: Platform): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export function platformColor(platform: Platform): string {
  return PLATFORM_COLORS[platform]
}

/* ── Post helpers ────────────────────────────────────────────── */

export function enabledPlatforms(post: SocialPost): Platform[] {
  return post.platforms.filter((p) => p.enabled).map((p) => p.platform)
}

export function hasPlatform(post: SocialPost, platform: Platform): boolean {
  return post.platforms.some((p) => p.enabled && p.platform === platform)
}

/** The date the post sits on, or null when it is still an unscheduled idea. */
export function postDate(post: SocialPost): string | null {
  if (post.scheduledDate) return post.scheduledDate
  if (post.scheduledAt) return post.scheduledAt.slice(0, 10)
  return null
}

export function postThumbnail(post: SocialPost): string | null {
  const image = post.media.find((m) => m.type === 'image' && (m.thumbnail || m.dataUrl))
  if (!image) return null
  return image.thumbnail || image.dataUrl
}

export function postTitle(post: SocialPost): string {
  return post.title.trim() || 'Untitled post'
}

/* ── Sorting ─────────────────────────────────────────────────── */

export type SortKey = 'title' | 'status' | 'date' | 'platform'
export type SortDir = 'asc' | 'desc'

export function sortPosts(posts: SocialPost[], key: SortKey, dir: SortDir): SocialPost[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...posts].sort((a, b) => {
    switch (key) {
      case 'title':
        return sign * postTitle(a).localeCompare(postTitle(b))
      case 'status':
        return sign * columnForStatus(a.status).localeCompare(columnForStatus(b.status))
      case 'platform': {
        const pa = enabledPlatforms(a)[0] ?? ''
        const pb = enabledPlatforms(b)[0] ?? ''
        return sign * pa.localeCompare(pb)
      }
      case 'date': {
        // Undated posts always sort last regardless of direction, otherwise
        // they'd dominate the top of an ascending list.
        const da = postDate(a)
        const db = postDate(b)
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return sign * da.localeCompare(db)
      }
    }
  })
}
