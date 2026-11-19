'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, Link2, ImageIcon, ExternalLink, CalendarClock, Copy, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type {
  MediaType,
  Platform,
  SocialMediaAttachment,
  SocialPost,
  SocialPostPlatform,
  SocialPostStatus,
} from '@/lib/kali/store/schema'
import { deleteMedia, uploadMediaFile } from '@/lib/api/mediaApi'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { isReminderAccount, socialAccountsApi, type SocialAccount } from '@/lib/kali/api/social-accounts'
import { socialPostsApi } from '@/lib/kali/api/social-posts'
import Button from '../shared/Button'
import { Input, Textarea } from '../shared/Input'
import SectionLabel from '../shared/SectionLabel'
import PlatformIcon from '../social/PlatformIcon'
import {
  ALL_PLATFORMS,
  PLANNER_STAGES,
  formatMoment,
  MANUAL_POST_URL,
  platformColor,
  postTextFor,
  platformLabel,
  postMoment,
} from './planner-model'
import PostMomentBadge from './PostMomentBadge'

/**
 * Stages a person sets while planning. "Scheduled" and "Posted" are not
 * choices here: Schedule post queues the post, and the publisher marks it
 * posted (or failed) when it really goes out.
 */
const PLANNING_STAGES = PLANNER_STAGES.filter((s) => ['idea', 'draft', 'in_review'].includes(s.value))
const isPlanning = (status: SocialPostStatus) => ['idea', 'draft', 'in_review'].includes(status)

interface Draft {
  title: string
  caption: string
  status: SocialPostStatus
  platforms: Platform[]
  date: string
  time: string
  tags: string
  notes: string
  cardId: string
  media: SocialMediaAttachment[]
  /** Chosen account per platform, when a platform has more than one connected. */
  accounts: Partial<Record<Platform, string>>
}

export interface PostDetailPanelProps {
  /** null opens the panel in create mode. */
  postId: string | null
  /** Prefill for create mode — the calendar `+` passes the tapped day. */
  defaultDate?: string
  defaultTime?: string
  onClose: () => void
}

function mediaTypeFor(file: File): MediaType {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'image'
}

function draftFromPost(post: SocialPost): Draft {
  return {
    title: post.title,
    caption: post.caption,
    status: post.status,
    platforms: post.platforms.filter((p) => p.enabled).map((p) => p.platform),
    date: post.scheduledDate ?? '',
    time: post.scheduledTime ?? '',
    tags: post.tags.join(', '),
    notes: post.notes ?? '',
    cardId: post.cardId ?? '',
    media: post.media,
    accounts: Object.fromEntries(
      post.platforms.filter((p) => p.enabled && p.accountId).map((p) => [p.platform, p.accountId as string]),
    ),
  }
}

function emptyDraft(defaultDate?: string, defaultTime?: string): Draft {
  return {
    title: '',
    caption: '',
    status: 'draft',
    platforms: ['instagram'],
    date: defaultDate ?? '',
    time: defaultTime ?? '',
    tags: '',
    notes: '',
    cardId: '',
    media: [],
    accounts: {},
  }
}

/** Builds the platform entries, preserving per-platform overrides already on the post. */
function buildPlatforms(
  draft: Draft,
  existing: SocialPostPlatform[],
  accountFor: (platform: Platform) => string | undefined,
): SocialPostPlatform[] {
  return draft.platforms.map((platform) => {
    const override = existing.find((p) => p.platform === platform)
    const base: SocialPostPlatform = override ?? {
      platform,
      enabled: true,
      status: 'pending' as const,
      caption: '',
      hashtags: [],
      mentions: [],
      visibility: 'public' as const,
    }
    return { ...base, accountId: accountFor(platform) ?? base.accountId ?? null }
  })
}

export default function PostDetailPanel({
  postId,
  defaultDate,
  defaultTime,
  onClose,
}: PostDetailPanelProps) {
  const { boards, socialPosts, addSocialPost, updateSocialPost, deleteSocialPost, refreshSocialPost } = useStore()
  const isCreate = postId == null
  const existing = useMemo(
    () => (postId ? socialPosts.find((p) => p.id === postId) ?? null : null),
    [postId, socialPosts],
  )

  // Seeded once on mount. The panel unmounts when it closes, so there is no
  // need to re-sync: re-seeding from the store on every snapshot would throw
  // away whatever the user was mid-way through typing.
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? draftFromPost(existing) : emptyDraft(defaultDate, defaultTime),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  // Connected accounts, for "Post to". null while loading or if it failed, in
  // which case the server picks the account as before.
  const [connected, setConnected] = useState<SocialAccount[] | null>(null)
  useEffect(() => {
    let cancelled = false
    socialAccountsApi
      .list()
      .then((rows) => {
        if (!cancelled) setConnected(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const accountsFor = (platform: Platform) =>
    (connected ?? []).filter((a) => a.platform === platform && a.status === 'active')
  /** The account a platform will post to: the one picked, else the first connected. */
  const accountFor = (platform: Platform): string | undefined => {
    const options = accountsFor(platform)
    const picked = draft.accounts[platform]
    return options.find((a) => a.id === picked)?.id ?? options[0]?.id ?? undefined
  }
  const accountName = (id: string | null | undefined) => connected?.find((a) => a.id === id)?.accountName
  const isReminder = (id: string | null | undefined) => {
    const account = connected?.find((a) => a.id === id)
    return account ? isReminderAccount(account) : false
  }

  // "Your turn to post": copy the caption, open the platform, mark it posted.
  const [markingFor, setMarkingFor] = useState<Platform | null>(null)
  const [postedUrl, setPostedUrl] = useState('')
  const [copiedFor, setCopiedFor] = useState<Platform | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)

  const copyCaption = async (platform: Platform) => {
    if (!existing) return
    try {
      await navigator.clipboard.writeText(postTextFor(existing, platform))
      setCopiedFor(platform)
    } catch {
      setMarkError('Could not copy. Select the caption below and copy it yourself.')
    }
  }

  const markPosted = async (platform: Platform) => {
    if (!existing) return
    const url = postedUrl.trim()
    if (url && !/^https?:\/\//.test(url)) {
      setMarkError('That link should start with https://')
      return
    }
    try {
      await socialPostsApi.markPosted(existing.id, { platform, url: url || undefined })
      await refreshSocialPost(existing.id)
      setMarkingFor(null)
      setPostedUrl('')
      setMarkError(null)
    } catch (error) {
      setMarkError(getFriendlyErrorMessage(error, 'Could not mark it as posted.'))
    }
  }
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreate) titleRef.current?.focus()
  }, [isCreate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setScheduleError(null)
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const togglePlatform = (platform: Platform) =>
    setDraft((d) => ({
      ...d,
      // Never let the last chip be switched off — a post with no destination
      // has nowhere to publish to.
      platforms: d.platforms.includes(platform)
        ? d.platforms.filter((p) => p !== platform)
        : [...d.platforms, platform],
    }))

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    try {
      const results = await Promise.all(
        Array.from(files).map(async (file): Promise<SocialMediaAttachment | null> => {
          try {
            const uploaded = await uploadMediaFile(file)
            return {
              id: uploaded.id,
              type: mediaTypeFor(file),
              name: file.name,
              dataUrl: uploaded.url,
              storageUrl: uploaded.url,
              mediaId: uploaded.id,
              mimeType: uploaded.mimeType,
              size: uploaded.sizeBytes,
              platformCompat: ALL_PLATFORMS,
            }
          } catch (error) {
            setUploadError(getFriendlyErrorMessage(error, `Could not upload "${file.name}".`))
            return null
          }
        }),
      )
      setDraft((d) => ({
        ...d,
        media: [...d.media, ...results.filter((m): m is SocialMediaAttachment => m !== null)],
      }))
    } finally {
      setUploading(false)
    }
  }

  const moment = existing ? postMoment(existing) : null
  const alreadyOut = moment?.kind === 'posted' || moment?.kind === 'partial' || moment?.kind === 'publishing'
  const isScheduled = moment?.kind === 'scheduled'

  const buildShared = () => {
    const tags = draft.tags.split(',').map((t) => t.trim()).filter(Boolean)
    // scheduledAt is left undefined whenever an explicit date is set — the two
    // are alternative ways to express the same thing and having both set makes
    // the calendar disagree with the board.
    const shared = {
      title: draft.title.trim() || 'Untitled post',
      caption: draft.caption,
      status: draft.status,
      platforms: buildPlatforms(draft, existing?.platforms ?? [], accountFor),
      media: draft.media,
      tags,
      notes: draft.notes.trim() || undefined,
      cardId: draft.cardId || undefined,
      scheduledDate: draft.date || undefined,
      scheduledTime: draft.time || undefined,
      scheduledAt: undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    return shared
  }

  const save = (status?: SocialPostStatus) => {
    const { status: _ignored, ...rest } = buildShared()
    void _ignored
    const patch = status ? { ...rest, status } : rest
    if (existing) {
      updateSocialPost(existing.id, patch)
    } else {
      addSocialPost({ ...rest, status: status ?? 'draft', repeat: 'none' })
    }
    onClose()
  }

  /** Planning save: keeps the chosen stage (moving a scheduled post back unschedules it). */
  const handleSaveDraft = () => save(isPlanning(draft.status) ? draft.status : 'draft')

  /** Edits to a post that already went out: content only, never its status. */
  const handleSaveChanges = () => save()

  /**
   * Queues the post for its date and time. The server checks each platform
   * (connected account, content rules) and the planner shows the outcome.
   */
  const handleSchedule = () => {
    if (draft.platforms.length === 0) return setScheduleError('Pick at least one platform.')
    if (connected) {
      const missing = draft.platforms.filter((p) => accountsFor(p).length === 0)
      if (missing.length > 0) {
        const names = missing.map(platformLabel).join(' and ')
        return setScheduleError(
          `Connect a ${names} account in Settings first (or add a reminder account to post it yourself), or turn ${names} off.`,
        )
      }
    }
    if (!draft.date || !draft.time) return setScheduleError('Pick a date and time to schedule this post.')
    const at = new Date(`${draft.date}T${draft.time}`)
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) {
      return setScheduleError('That time has passed. Pick a time in the future.')
    }
    setScheduleError(null)
    save('scheduled')
  }

  const handleDelete = () => {
    if (!existing) return
    deleteSocialPost(existing.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={isCreate ? 'New post' : 'Edit post'}>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
      />

      <aside className="relative flex h-full w-full max-w-[440px] flex-col border-l border-border bg-surface shadow-modal">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">
            {isCreate ? 'New post' : 'Edit post'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </header>

        <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {existing && moment && (
            <section
              aria-label="Publishing status"
              className="rounded-lg border border-border bg-surface-alt px-3 py-2.5"
            >
              <PostMomentBadge post={existing} />
              <ul className="mt-2 space-y-1.5">
                {existing.platforms
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <li key={p.platform} className="flex items-center gap-2 text-[12px] text-text-secondary">
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: platformColor(p.platform) }}
                      >
                        <PlatformIcon platform={p.platform} size={9} />
                      </span>
                      <span className="font-medium text-text-primary">
                        {platformLabel(p.platform)}
                        {accountName(p.accountId) ? ` · ${accountName(p.accountId)}` : ''}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {p.status === 'posted'
                          ? `Posted${p.publishedAt ? ` ${formatMoment(new Date(p.publishedAt))}` : ''}${p.dryRun ? ' (simulated)' : ''}${p.manual ? ' by you' : ''}`
                          : p.status === 'reminder'
                            ? 'Your turn to post'
                            : p.status === 'scheduled'
                            ? isReminder(p.accountId)
                              ? "We'll remind you at its time"
                              : p.retryCount ? 'Retrying soon' : 'Waiting for its time'
                            : p.status === 'publishing'
                              ? 'Publishing now'
                              : p.status === 'failed'
                                ? p.error || 'Failed'
                                : p.error || 'Not scheduled'}
                      </span>
                      {p.publishedUrl && (
                        <a
                          href={p.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          View <ExternalLink size={11} />
                        </a>
                      )}
                    </li>
                  ))}
              </ul>

              {existing.platforms
                .filter((p) => p.enabled && p.status === 'reminder')
                .map((p) => (
                  <div key={`turn-${p.platform}`} className="mt-3 space-y-2 border-t border-border pt-3">
                    <p className="text-[12px] text-text-secondary">
                      Post this on {platformLabel(p.platform)} yourself: copy the caption, paste it there, then mark it
                      as posted.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => copyCaption(p.platform)}>
                        <Copy size={12} />
                        {copiedFor === p.platform ? 'Copied' : 'Copy caption'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(MANUAL_POST_URL[p.platform], '_blank', 'noopener')}
                      >
                        <ExternalLink size={12} />
                        Open {platformLabel(p.platform)}
                      </Button>
                      {markingFor !== p.platform && (
                        <Button size="sm" variant="primary" onClick={() => { setMarkingFor(p.platform); setMarkError(null) }}>
                          <CheckCircle2 size={12} />
                          Mark as posted
                        </Button>
                      )}
                    </div>
                    {markingFor === p.platform && (
                      <div className="flex gap-1.5">
                        <input
                          value={postedUrl}
                          onChange={(e) => { setPostedUrl(e.target.value); setMarkError(null) }}
                          placeholder="Link to your post (optional)"
                          aria-label={`Link to your ${platformLabel(p.platform)} post`}
                          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] text-text-primary"
                        />
                        <Button size="sm" variant="primary" onClick={() => markPosted(p.platform)}>
                          Done
                        </Button>
                      </div>
                    )}
                    {markError && <p role="alert" className="text-[12px] font-medium text-danger-text">{markError}</p>}
                  </div>
                ))}
            </section>
          )}

          <Input
            ref={titleRef}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Post title"
            aria-label="Post title"
            className="text-base font-semibold"
          />

          <div>
            <SectionLabel>Stage</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLANNING_STAGES.map(({ value, label, dot }) => {
                const active = draft.status === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('status', value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-surface text-text-secondary hover:bg-surface-alt'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-brand-ivory' : dot}`} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Platforms</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALL_PLATFORMS.map((platform) => {
                const on = draft.platforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    aria-pressed={on}
                    aria-label={`${platformLabel(platform)}: ${on ? 'enabled' : 'disabled'}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                      on ? 'border-transparent text-white' : 'border border-border bg-surface text-text-secondary hover:bg-surface-alt'
                    }`}
                    style={on ? { background: platformColor(platform) } : undefined}
                  >
                    <PlatformIcon platform={platform} size={11} />
                    {platformLabel(platform)}
                  </button>
                )
              })}
            </div>
            {draft.platforms.length === 0 && (
              <p className="mt-1.5 text-[11px] text-text-muted">Pick at least one platform.</p>
            )}
            {connected && draft.platforms.length > 0 && (
              <div className="mt-3 space-y-1.5" aria-label="Post to">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">Post to</p>
                {draft.platforms.map((platform) => {
                  const options = accountsFor(platform)
                  const label = platformLabel(platform)
                  return (
                    <div key={platform} className="flex items-center gap-2 text-[12px]">
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: platformColor(platform) }}
                      >
                        <PlatformIcon platform={platform} size={9} />
                      </span>
                      {options.length === 0 ? (
                        <span className="text-text-muted">
                          No {label} account connected.{' '}
                          <a href="/settings?tab=accounts" className="font-semibold text-primary hover:underline">
                            Connect one
                          </a>
                        </span>
                      ) : options.length === 1 ? (
                        <span className="truncate text-text-secondary">
                          {options[0].accountName}
                          {options[0].demo ? ' (demo)' : ''}
                          {isReminderAccount(options[0]) ? ' (reminder: you post it yourself)' : ''}
                        </span>
                      ) : (
                        <select
                          value={accountFor(platform)}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, accounts: { ...d.accounts, [platform]: e.target.value } }))
                          }
                          aria-label={`${label} account to post to`}
                          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] text-text-primary"
                        >
                          {options.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.accountName}
                              {a.demo ? ' (demo)' : ''}
                              {isReminderAccount(a) ? ' (reminder: you post it yourself)' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel>Date</SectionLabel>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
                aria-label="Scheduled date"
                className="mt-2"
              />
            </div>
            <div>
              <SectionLabel>Time</SectionLabel>
              <Input
                type="time"
                value={draft.time}
                onChange={(e) => set('time', e.target.value)}
                aria-label="Scheduled time"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <SectionLabel>Caption</SectionLabel>
            <Textarea
              value={draft.caption}
              onChange={(e) => set('caption', e.target.value)}
              placeholder="Write the caption for this post…"
              aria-label="Caption"
              rows={5}
              className="mt-2"
            />
          </div>

          <div>
            <SectionLabel>Media</SectionLabel>
            {draft.media.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {draft.media.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface-alt"
                  >
                    {item.type === 'image' ? (
                      <img src={item.dataUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-muted">
                        <ImageIcon size={18} />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        set('media', draft.media.filter((m) => m.id !== item.id))
                        if (item.mediaId) void deleteMedia(item.mediaId).catch(() => undefined)
                      }}
                      aria-label={`Remove ${item.name}`}
                      className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-brand-ivory opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong py-2.5 text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary">
              {uploading ? 'Uploading…' : <Plus size={14} />}
              {uploading ? 'Uploading…' : 'Add media'}
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                className="hidden"
                aria-label="Upload media file"
                onChange={(e) => {
                  void handleUpload(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            {uploadError && (
              <p className="mt-2 rounded-md bg-danger-subtle px-2.5 py-1.5 text-[12px] font-medium text-danger-text">
                {uploadError}
              </p>
            )}
          </div>

          <div>
            <SectionLabel>Tags</SectionLabel>
            <Input
              value={draft.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="launch, evergreen"
              aria-label="Tags"
              className="mt-2"
            />
          </div>

          <div>
            <SectionLabel icon={<Link2 size={11} />}>Linked board</SectionLabel>
            <select
              value={draft.cardId}
              onChange={(e) => set('cardId', e.target.value)}
              aria-label="Linked board"
              className="mt-2 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">No linked board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {draft.cardId && !boards.some((b) => b.id === draft.cardId) && (
              <p className="mt-1.5 text-[11px] text-text-muted">The linked board was removed.</p>
            )}
          </div>

          <div>
            <SectionLabel>Notes</SectionLabel>
            <Textarea
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Internal notes — not published with the post."
              aria-label="Notes"
              rows={3}
              className="mt-2"
            />
          </div>
        </div>

        {scheduleError && (
          <p role="alert" className="shrink-0 border-t border-border bg-danger-subtle px-4 py-2 text-[12px] font-medium text-danger-text">
            {scheduleError}
          </p>
        )}
        <footer className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
          {!isCreate &&
            (confirmDelete ? (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 size={13} />
                Confirm delete
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} />
                Delete
              </Button>
            ))}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {alreadyOut ? (
              <Button variant="primary" size="sm" onClick={handleSaveChanges}>
                Save changes
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={draft.platforms.length === 0}>
                  {isScheduled ? 'Unschedule' : 'Save draft'}
                </Button>
                <Button variant="primary" size="sm" onClick={handleSchedule}>
                  <CalendarClock size={13} />
                  {isScheduled ? 'Update schedule' : 'Schedule post'}
                </Button>
              </>
            )}
          </div>
        </footer>
      </aside>
    </div>
  )
}
