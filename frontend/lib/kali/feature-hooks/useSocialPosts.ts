'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { socialPostsApi, publishingJobsApi } from '@/lib/kali/api/social-posts'
import { uploadFile } from '@/lib/kali/api/client'
import { loadSocialPosts, saveSocialPosts } from '@/lib/kali/store/storage'
import { localToUTC } from '@/lib/kali/utils/timezones'
import type { SocialPost, SocialPostPlatform, SocialMediaAttachment, SocialAnalytics, PublishingJob, Platform } from '@/lib/kali/store/schema'

type AnyRecord = Record<string, unknown>

function toSocialPost(raw: AnyRecord): SocialPost {
  const id = (raw.id as string) ?? (raw._id as string) ?? ''
  const scheduledAt = raw.scheduledAt ? new Date(raw.scheduledAt as string).toISOString() : undefined
  const derivedDate = scheduledAt ? scheduledAt.slice(0, 10) : undefined
  const derivedTime = scheduledAt ? scheduledAt.slice(11, 16) : undefined
  return {
    ...(raw as unknown as SocialPost),
    id,
    scheduledDate: (raw.scheduledDate as string) ?? derivedDate,
    scheduledTime: (raw.scheduledTime as string) ?? derivedTime,
    scheduledAt,
  }
}

/**
 * React hook that manages social posts with API-first + localStorage fallback.
 * Provides the same interface as the store methods so StoreProvider can delegate to it.
 */
export function useSocialPosts() {
  const [posts, setPosts] = useState<SocialPost[]>(() => loadSocialPosts())
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [jobs, setJobs] = useState<PublishingJob[]>([])
  const postsRef = useRef(posts)

  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  // Load from API on mount, fallback to localStorage
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await socialPostsApi.list()
        if (!cancelled) {
          setPosts(data.map((p) => toSocialPost(p as unknown as AnyRecord)))
          saveSocialPosts(data)
          setIsOnline(true)
        }
      } catch {
        if (!cancelled) setIsOnline(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Debounced localStorage sync
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        saveSocialPosts(postsRef.current)
      } catch {
        // ignore
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [posts])

  const mutate = useCallback((fn: (prev: SocialPost[]) => SocialPost[]) => {
    setPosts(fn)
  }, [])

  const addPost = useCallback(async (input: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<SocialPost> => {
    const optimistic: SocialPost = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mutate((prev) => [optimistic, ...prev])
    try {
      const created = await socialPostsApi.create(input)
      mutate((prev) => prev.map((p) => (p.id === optimistic.id ? toSocialPost(created as unknown as AnyRecord) : p)))
      return created
    } catch {
      setIsOnline(false)
      return optimistic
    }
  }, [mutate])

  const updatePost = useCallback(async (id: string, patch: Partial<SocialPost>) => {
    mutate((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p))
    )
    try {
      await socialPostsApi.update(id, patch)
    } catch {
      setIsOnline(false)
    }
  }, [mutate])

  const deletePost = useCallback(async (id: string) => {
    mutate((p) => p.filter((x) => x.id !== id))
    try {
      await socialPostsApi.delete(id)
    } catch {
      setIsOnline(false)
    }
  }, [mutate])

  const duplicatePost = useCallback((id: string): SocialPost | null => {
    const original = postsRef.current.find((p) => p.id === id)
    if (!original) return null
    const copy: SocialPost = {
      ...original,
      id: crypto.randomUUID(),
      title: `${original.title} (copy)`,
      status: 'draft',
      scheduledDate: undefined,
      scheduledTime: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mutate((prev) => [copy, ...prev])
    // Fire-and-forget API call
    socialPostsApi.create(copy).catch(() => setIsOnline(false))
    return copy
  }, [mutate])

  const movePost = useCallback((id: string, newDate: string, newTime?: string) => {
    const existing = postsRef.current.find((p) => p.id === id)
    const timezone = existing?.timezone || undefined
    const time = newTime ?? existing?.scheduledTime
    const scheduledAt = newDate && timezone ? localToUTC(newDate, time, timezone) : undefined
    mutate((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, scheduledDate: newDate, scheduledTime: time, scheduledAt, updatedAt: new Date().toISOString() }
          : p
      )
    )
    try {
      socialPostsApi.update(id, { scheduledDate: newDate, scheduledTime: time, scheduledAt, timezone }).catch(() => setIsOnline(false))
    } catch {
      setIsOnline(false)
    }
  }, [mutate])

  const getByDate = useCallback((date: string): SocialPost[] =>
    postsRef.current.filter((p) => p.scheduledDate === date), [])

  const getByPlatform = useCallback((platform: Platform): SocialPost[] =>
    postsRef.current.filter((p) => p.platforms.some((pl) => pl.platform === platform && pl.enabled)), [])

  const getByStatus = useCallback((status: SocialPost['status']): SocialPost[] =>
    postsRef.current.filter((p) => p.status === status), [])

  const getByCard = useCallback((cardId: string): SocialPost[] =>
    postsRef.current.filter((p) => p.cardId === cardId), [])

  const getUnscheduled = useCallback((): SocialPost[] =>
    postsRef.current.filter((p) => !p.scheduledDate), [])

  const addPlatform = useCallback((postId: string, platform: Platform) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        if (p.platforms.some((pl) => pl.platform === platform)) return p
        const entry: SocialPostPlatform = {
          platform,
          enabled: true,
          status: 'pending',
          caption: '',
          hashtags: [],
          mentions: [],
          visibility: 'public',
        }
        return { ...p, platforms: [...p.platforms, entry], updatedAt: new Date().toISOString() }
      })
    )
  }, [mutate])

  const removePlatform = useCallback((postId: string, platform: Platform) => {
    mutate((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, platforms: p.platforms.filter((pl) => pl.platform !== platform), updatedAt: new Date().toISOString() }
          : p
      )
    )
  }, [mutate])

  const updatePlatform = useCallback((postId: string, platform: Platform, patch: Partial<SocialPostPlatform>) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        return {
          ...p,
          platforms: p.platforms.map((pl) => (pl.platform === platform ? { ...pl, ...patch } : pl)),
          updatedAt: new Date().toISOString(),
        }
      })
    )
  }, [mutate])

  const addMedia = useCallback((postId: string, media: Omit<SocialMediaAttachment, 'id'>) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const attachment: SocialMediaAttachment = { ...media, id: crypto.randomUUID() }
        return { ...p, media: [...p.media, attachment], updatedAt: new Date().toISOString() }
      })
    )
  }, [mutate])

  const removeMedia = useCallback((postId: string, mediaId: string) => {
    mutate((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, media: p.media.filter((m) => m.id !== mediaId), updatedAt: new Date().toISOString() }
          : p
      )
    )
  }, [mutate])

  const updateAnalytics = useCallback((postId: string, platform: Platform, analytics: SocialAnalytics) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const existing = p.analytics ?? []
        const updated = existing.filter((a) => a.platform !== platform)
        return { ...p, analytics: [...updated, analytics], updatedAt: new Date().toISOString() }
      })
    )
  }, [mutate])

  const applyPost = useCallback((id: string, patch: Partial<SocialPost>, platform?: Platform, platformPatch?: Partial<SocialPostPlatform>) => {
    mutate((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        let updated: SocialPost = { ...p, ...patch, updatedAt: new Date().toISOString() }
        if (platform && platformPatch) {
          updated = {
            ...updated,
            platforms: updated.platforms.map((pl) =>
              pl.platform === platform ? { ...pl, ...platformPatch } : pl,
            ),
          }
        }
        return updated
      })
    )
  }, [mutate])

  const refreshJobs = useCallback(async (postId?: string) => {
    try {
      if (postId) {
        const data = await publishingJobsApi.list({ socialPostId: postId })
        setJobs((prev) => [
          ...data,
          ...prev.filter((j) => j.socialPostId !== postId),
        ])
      } else {
        const data = await publishingJobsApi.list()
        setJobs(data)
      }
    } catch {
      // offline — ignore
    }
  }, [])

  const refreshPost = useCallback(async (postId: string): Promise<SocialPost | null> => {
    try {
      const fresh = await socialPostsApi.get(postId)
      mutate((prev) => prev.map((p) => (p.id === postId ? toSocialPost(fresh as unknown as AnyRecord) : p)))
      return fresh
    } catch {
      return null
    }
  }, [mutate])

  // Real-time polling: while any post is publishing, refresh its status every 10s.
  useEffect(() => {
    const activePosts = postsRef.current.filter(
      (p) => p.status === 'publishing' || p.platforms.some((pl) => pl.enabled && pl.status === 'publishing'),
    )
    if (activePosts.length === 0) return

    const timer = window.setInterval(() => {
      activePosts.forEach((p) => {
        refreshPost(p.id).then((fresh) => {
          if (fresh) refreshJobs(fresh.id)
        })
      })
    }, 10000)

    return () => window.clearInterval(timer)
  }, [posts, refreshPost, refreshJobs])

  const schedulePost = useCallback(async (
    id: string,
    input: { scheduledDate: string; scheduledTime?: string; timezone?: string; repeat?: SocialPost['repeat']; repeatUntil?: string },
  ): Promise<{ ok: boolean; errors?: string[] }> => {
    // Optimistic: mark local as scheduled so the UI reflects intent immediately.
    applyPost(id, { status: 'scheduled' })
    try {
      const result = await socialPostsApi.schedule(id, input)
      mutate((prev) => prev.map((p) => (p.id === id ? toSocialPost(result.post as unknown as AnyRecord) : p)))
      refreshJobs(id)
      // Surface validation errors even when the server still schedules.
      const invalid = result.validation?.filter((v) => !v.valid) ?? []
      return { ok: invalid.length === 0, errors: invalid.flatMap((v) => v.errors) }
    } catch (err) {
      setIsOnline(false)
      return { ok: false, errors: [err instanceof Error ? err.message : 'Failed to schedule'] }
    }
  }, [applyPost, mutate, refreshJobs])

  const cancelPost = useCallback(async (id: string, platform?: Platform): Promise<boolean> => {
    if (platform) {
      applyPost(id, {}, platform, { status: 'cancelled' })
    } else {
      applyPost(id, { status: 'cancelled' }, undefined, undefined)
    }
    try {
      const result = await socialPostsApi.cancel(id, platform ? { platform } : undefined)
      mutate((prev) => prev.map((p) => (p.id === id ? toSocialPost(result.post as unknown as AnyRecord) : p)))
      refreshJobs(id)
      return true
    } catch {
      setIsOnline(false)
      return false
    }
  }, [applyPost, mutate, refreshJobs])

  const retryPost = useCallback(async (id: string, platform?: Platform): Promise<boolean> => {
    if (platform) {
      applyPost(id, {}, platform, { status: 'scheduled', retryCount: 0, error: undefined })
    }
    try {
      const result = await socialPostsApi.retry(id, platform ? { platform } : undefined)
      mutate((prev) => prev.map((p) => (p.id === id ? toSocialPost(result.post as unknown as AnyRecord) : p)))
      refreshJobs(id)
      return true
    } catch {
      setIsOnline(false)
      return false
    }
  }, [applyPost, mutate, refreshJobs])

  return {
    posts,
    loading,
    isOnline,
    addPost,
    updatePost,
    deletePost,
    duplicatePost,
    movePost,
    getByDate,
    getByPlatform,
    getByStatus,
    getByCard,
    getUnscheduled,
    addPlatform,
    removePlatform,
    updatePlatform,
    addMedia,
    removeMedia,
    updateAnalytics,
    jobs,
    refreshJobs,
    refreshPost,
    schedulePost,
    cancelPost,
    retryPost,
    uploadFile,
  }
}
