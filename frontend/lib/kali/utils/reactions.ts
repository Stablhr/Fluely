import type { Reactions } from '@/lib/kali/store/schema'

/**
 * Reads a comment's reactions in either shape: per person (`{count, userIds}`,
 * what the server sends now) or the older bare count (`{"👍": 1}`), which
 * becomes an anonymous count. Used for server responses *and* for data cached
 * in the browser before reactions were per person.
 */
export function normalizeReactions(raw: unknown): Reactions {
  const out: Reactions = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [emoji, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number') {
      if (value > 0) out[emoji] = { count: value, userIds: [] }
    } else if (value && typeof value === 'object') {
      const v = value as { count?: unknown; userIds?: unknown }
      const userIds = Array.isArray(v.userIds) ? v.userIds.map(String) : []
      const count = typeof v.count === 'number' ? v.count : userIds.length
      if (count > 0) out[emoji] = { count, userIds }
    }
  }
  return out
}
