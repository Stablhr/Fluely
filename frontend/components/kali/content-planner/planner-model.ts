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

export const ALL_PLATFORMS: Platform[] = ['facebook', 'linkedin', 'tiktok', 'youtube']

/**
 * Header strip for the overview cards. One neutral treatment for every card —
 * the platform's own colour is reserved for its icon, so the cards read as one
 * set in both themes.
 */
export const OVERVIEW_HEADER = 'bg-surface-alt text-text-primary'

const PLATFORM_NAMES: Record<Platform, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

export function platformLabel(platform: Platform): string {
  return PLATFORM_NAMES[platform] ?? platform
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

/* ── Publishing moment ───────────────────────────────────────── */

export type PostMomentKind = 'scheduled' | 'publishing' | 'posted' | 'partial' | 'failed' | 'reminder'

export interface PostMoment {
  kind: PostMomentKind
  /** When it goes out (scheduled) or went out (posted); null when unknown. */
  at: Date | null
  label: string
}

/** The local wall-clock time a post is set for, from its date and time fields. */
function plannedAt(post: SocialPost): Date | null {
  if (post.scheduledAt) return new Date(post.scheduledAt)
  if (!post.scheduledDate) return null
  const d = new Date(`${post.scheduledDate}T${post.scheduledTime || '00:00'}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Where a post is in publishing, for the badges on the board, table and
 * editor. Only the server moves a post into these states (scheduling queues
 * it; the publisher marks it posted or failed), so this reads them rather
 * than offering them as choices.
 */
export function postMoment(post: SocialPost): PostMoment | null {
  const enabled = post.platforms.filter((p) => p.enabled)
  const latestPublished = enabled
    .map((p) => (p.status === 'posted' && p.publishedAt ? new Date(p.publishedAt) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null

  // Its time came for a platform you post to yourself: that comes first.
  if (enabled.some((p) => p.status === 'reminder')) {
    return { kind: 'reminder', at: plannedAt(post), label: 'Your turn to post' }
  }

  switch (post.status) {
    case 'scheduled':
      return { kind: 'scheduled', at: plannedAt(post), label: 'Scheduled' }
    case 'publishing':
      return { kind: 'publishing', at: plannedAt(post), label: 'Publishing' }
    case 'posted':
      return { kind: 'posted', at: latestPublished ?? plannedAt(post), label: 'Posted' }
    case 'partially_published':
      return { kind: 'partial', at: latestPublished, label: 'Partly posted' }
    case 'failed':
      return { kind: 'failed', at: null, label: 'Failed' }
    default:
      return null
  }
}

const MOMENT_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

/** Caption plus hashtags, as it should be pasted on a platform by hand. */
export function postTextFor(post: SocialPost, platform: Platform): string {
  const target = post.platforms.find((p) => p.platform === platform)
  const caption = (target?.caption?.trim() ? target.caption : post.caption) ?? ''
  const tags = (target?.hashtags ?? [])
    .map((t) => t.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .filter((t) => !new RegExp(`#${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(caption))
  return [caption.trim(), tags.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n\n')
}

/** Where to post by hand on each platform. */
export const MANUAL_POST_URL: Record<Platform, string> = {
  facebook: 'https://www.facebook.com/',
  linkedin: 'https://www.linkedin.com/feed/?shareActive=true',
  tiktok: 'https://www.tiktok.com/upload',
  youtube: 'https://studio.youtube.com/',
}

/** e.g. "Thu, 19 Nov, 10:20 PM" in the viewer's own time zone. */
export function formatMoment(at: Date): string {
  return MOMENT_FORMAT.format(at)
}
