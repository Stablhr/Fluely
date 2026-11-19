import { httpClient } from '@/lib/api/httpClient'
import type { SocialPost, Platform, PublishingJob } from '@/lib/kali/store/schema'

/**
 * Social posts on the server (`backend/api/routes/social.routes.ts`).
 *
 * Posts are shared by everyone in the workspace. Ids are the client's own
 * UUIDs, so an optimistic post keeps its id once the server has it. The
 * browser-only `dataUrl` previews of media are stripped before sending: the
 * server and the platforms only ever use `storageUrl`.
 */

export interface SchedulingValidation {
  platform: Platform
  valid: boolean
  errors: string[]
}

export interface ScheduleResult {
  post: SocialPost
  scheduledAt: string
  timezone: string
  jobsCreated: string[]
  jobsSkipped: string[]
  validation: SchedulingValidation[]
}

export interface CancelResult {
  post: SocialPost
}

export interface RetryResult {
  post: SocialPost
  retried: Platform[]
  jobsCreated: string[]
  jobsSkipped: string[]
}

/**
 * Writes to one post run one after another. The planner fires a create and,
 * a moment later, a schedule or an edit for the same post; without ordering
 * the second request can reach the server before the post exists.
 */
const pending = new Map<string, Promise<unknown>>()
function inOrder<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = pending.get(id) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(run)
  pending.set(id, next)
  void next.finally(() => {
    if (pending.get(id) === next) pending.delete(id)
  }).catch(() => undefined)
  return next
}

/** Fired when saving a post as "Scheduled" queued it (or could not). */
export const SCHEDULE_RESULT_EVENT = 'cadence:social-schedule-result'
export interface ScheduleResultEventDetail {
  postId: string
  ok: boolean
  errors: string[]
  /** UTC time it was queued for, when it was queued. */
  scheduledAt?: string
}

/** Fired when a scheduled post finishes publishing (posted, partly, or failed). */
export const POST_OUTCOME_EVENT = 'cadence:social-post-outcome'
export interface PostOutcomeEventDetail {
  postId: string
  title: string
  status: SocialPost['status']
  posted: { platform: Platform; url?: string; simulated?: boolean }[]
  failed: { platform: Platform; error?: string }[]
}

/** Drops what only the browser needs (inline previews) from a post payload. */
function toWire<T extends Partial<SocialPost>>(post: T): T {
  if (!post.media) return post
  return {
    ...post,
    media: post.media.map((item) => {
      const rest = { ...item } as Partial<typeof item>
      delete rest.dataUrl
      if (rest.thumbnail?.startsWith('data:')) delete rest.thumbnail
      return rest
    }),
  } as T
}

export const socialPostsApi = {
  list: async (params?: { status?: string; platform?: string; date?: string }) => {
    const { data } = await httpClient.get<{ posts: SocialPost[] }>('/social-posts', { params })
    return data.posts
  },
  get: async (id: string) => {
    const { data } = await httpClient.get<{ post: SocialPost }>(`/social-posts/${encodeURIComponent(id)}`)
    return data.post
  },
  create: (post: Omit<SocialPost, 'createdAt' | 'updatedAt'>) =>
    inOrder(post.id, async () => {
      const { data } = await httpClient.post<{ post: SocialPost }>('/social-posts', toWire(post))
      return data.post
    }),
  /** One-time upload of posts that so far lived only in this browser. */
  importLocal: async (posts: SocialPost[]) => {
    const { data } = await httpClient.post<{ imported: number; skipped: number }>(
      '/social-posts/import',
      { posts: posts.map(toWire) },
      { timeout: 60000 },
    )
    return data
  },
  update: (id: string, patch: Partial<SocialPost>) =>
    inOrder(id, async () => {
      const { data } = await httpClient.put<{ post: SocialPost }>(
        `/social-posts/${encodeURIComponent(id)}`,
        toWire(patch),
      )
      return data.post
    }),
  delete: (id: string) =>
    inOrder(id, async () => {
      await httpClient.delete(`/social-posts/${encodeURIComponent(id)}`)
    }),
  schedule: (
    id: string,
    input: { scheduledDate: string; scheduledTime?: string; timezone?: string; repeat?: string; repeatUntil?: string },
  ) =>
    inOrder(id, async () => {
      const { data } = await httpClient.post<ScheduleResult>(`/social-posts/${encodeURIComponent(id)}/schedule`, input)
      return data
    }),
  cancel: (id: string, input?: { platform?: Platform }) =>
    inOrder(id, async () => {
      const { data } = await httpClient.post<CancelResult>(`/social-posts/${encodeURIComponent(id)}/cancel`, input ?? {})
      return data
    }),
  retry: (id: string, input?: { platform?: Platform }) =>
    inOrder(id, async () => {
      const { data } = await httpClient.post<RetryResult>(`/social-posts/${encodeURIComponent(id)}/retry`, input ?? {})
      return data
    }),
}

export const publishingJobsApi = {
  list: async (params?: { socialPostId?: string; status?: string }) => {
    const { data } = await httpClient.get<{ jobs: PublishingJob[] }>('/publishing-jobs', { params })
    return data.jobs
  },
}
