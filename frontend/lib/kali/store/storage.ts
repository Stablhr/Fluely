import type { AppData, Board, SocialPost, SocialPostPlatform } from './schema'
import { emptyData } from './schema'

const STORAGE_KEY = 'kali_data'
const SCHEMA_VERSION = 1

function migrateBoard(board: Board): void {
  if (!board.settings) {
    board.settings = { commentPermission: 'members', selfJoin: false }
  }
  if (!Array.isArray(board.activity)) {
    board.activity = []
  }
  if (!Array.isArray(board.archivedLists)) {
    board.archivedLists = []
  }
  if (!Array.isArray(board.shares)) {
    board.shares = []
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as AppData
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
      return emptyData()
    }
    if (!parsed.ui) parsed.ui = emptyData().ui
    for (const board of Object.values(parsed.boards)) {
      migrateBoard(board)
    }
    return parsed
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    throw new Error(
      'Could not save — browser storage is full. Remove large attachments or reset data to continue.',
    )
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/* ── Social Posts persistence ─────────────────────────────── */

const SOCIAL_POSTS_KEY = 'kali-social-posts'
const SOCIAL_POSTS_VERSION = 1

function migrateSocialPostPlatform(p: Record<string, unknown>): SocialPostPlatform {
  return {
    platform: (p.platform as SocialPostPlatform['platform']) ?? 'facebook',
    enabled: p.enabled !== false,
    status: (p.status as SocialPostPlatform['status']) ?? 'pending',
    caption: (p.caption as string) ?? '',
    hashtags: Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [],
    mentions: Array.isArray(p.mentions) ? (p.mentions as string[]) : [],
    location: p.location as string | undefined,
    altText: p.altText as string | undefined,
    visibility: (p.visibility as SocialPostPlatform['visibility']) ?? 'public',
    deepLink: p.deepLink as string | undefined,
    publishedUrl: p.publishedUrl as string | undefined,
    platformPostId: p.platformPostId as string | undefined,
    error: p.error as string | undefined,
    publishedAt: p.publishedAt as string | undefined,
  }
}

function migrateSocialPosts(data: unknown): SocialPost[] {
  if (!Array.isArray(data)) return []
  return data.map((post: Record<string, unknown>) => {
    const migrated: SocialPost = {
      id: (post.id as string) ?? '',
      title: (post.title as string) ?? '',
      caption: (post.caption as string) ?? '',
      platforms: Array.isArray(post.platforms)
        ? (post.platforms as Record<string, unknown>[]).map(migrateSocialPostPlatform)
        : [],
      media: Array.isArray(post.media) ? (post.media as SocialPost['media']) : [],
      cardId: post.cardId as string | undefined,
      scheduledDate: post.scheduledDate as string | undefined,
      scheduledTime: post.scheduledTime as string | undefined,
      status: (post.status as SocialPost['status']) ?? 'draft',
      repeat: (post.repeat as SocialPost['repeat']) ?? 'none',
      repeatUntil: post.repeatUntil as string | undefined,
      analytics: Array.isArray(post.analytics) ? (post.analytics as SocialPost['analytics']) : undefined,
      aiGeneration: (post.aiGeneration as SocialPost['aiGeneration']) ?? undefined,
      tags: Array.isArray(post.tags) ? (post.tags as string[]) : [],
      createdAt: (post.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (post.updatedAt as string) ?? new Date().toISOString(),
    }
    return migrated
  })
}

export function loadSocialPosts(): SocialPost[] {
  try {
    const raw = localStorage.getItem(SOCIAL_POSTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { version?: number; data?: unknown }
    if (!parsed || typeof parsed !== 'object') return []
    if (parsed.version !== SOCIAL_POSTS_VERSION) {
      return migrateSocialPosts(parsed.data)
    }
    return Array.isArray(parsed.data) ? (parsed.data as SocialPost[]) : []
  } catch {
    return []
  }
}

export function saveSocialPosts(posts: SocialPost[]): void {
  try {
    const payload = { version: SOCIAL_POSTS_VERSION, data: posts }
    localStorage.setItem(SOCIAL_POSTS_KEY, JSON.stringify(payload))
  } catch {
    throw new Error(
      'Could not save social posts — browser storage is full. Remove large media attachments to continue.',
    )
  }
}
