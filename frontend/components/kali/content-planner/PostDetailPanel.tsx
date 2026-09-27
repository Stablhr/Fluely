'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, Link2, ImageIcon } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type {
  MediaType,
  Platform,
  SocialMediaAttachment,
  SocialPost,
  SocialPostPlatform,
  SocialPostStatus,
} from '@/lib/kali/store/schema'
import { uploadFile } from '@/lib/kali/api/client'
import Button from '../shared/Button'
import { Input, Textarea } from '../shared/Input'
import SectionLabel from '../shared/SectionLabel'
import PlatformIcon from '../social/PlatformIcon'
import {
  ALL_PLATFORMS,
  PLANNER_STAGES,
  platformColor,
  platformLabel,
} from './planner-model'

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
  }
}

/** Builds the platform entries, preserving per-platform overrides already on the post. */
function buildPlatforms(draft: Draft, existing: SocialPostPlatform[]): SocialPostPlatform[] {
  return draft.platforms.map((platform) => {
    const override = existing.find((p) => p.platform === platform)
    return (
      override ?? {
        platform,
        enabled: true,
        status: 'pending' as const,
        caption: '',
        hashtags: [],
        mentions: [],
        visibility: 'public' as const,
      }
    )
  })
}

export default function PostDetailPanel({
  postId,
  defaultDate,
  defaultTime,
  onClose,
}: PostDetailPanelProps) {
  const { boards, socialPosts, addSocialPost, updateSocialPost, deleteSocialPost } = useStore()
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
  const [uploading, setUploading] = useState(false)
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

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

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
    try {
      const added = await Promise.all(
        Array.from(files).map(
          (file) =>
            new Promise<SocialMediaAttachment>((resolve) => {
              const base = {
                id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: mediaTypeFor(file),
                name: file.name,
                size: file.size,
                mimeType: file.type,
                platformCompat: ALL_PLATFORMS,
              }
              // Prefer the remote upload; fall back to an inline data URL so the
              // planner still works while the media API is inert.
              uploadFile(file)
                .then((res) =>
                  resolve({ ...base, dataUrl: res.storageUrl, storageUrl: res.storageUrl } as SocialMediaAttachment),
                )
                .catch(() => {
                  const reader = new FileReader()
                  reader.onload = () => resolve({ ...base, dataUrl: String(reader.result) } as SocialMediaAttachment)
                  reader.onerror = () => resolve({ ...base, dataUrl: '' } as SocialMediaAttachment)
                  reader.readAsDataURL(file)
                })
            }),
        ),
      )
      setDraft((d) => ({ ...d, media: [...d.media, ...added] }))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = () => {
    const tags = draft.tags.split(',').map((t) => t.trim()).filter(Boolean)
    // scheduledAt is left undefined whenever an explicit date is set — the two
    // are alternative ways to express the same thing and having both set makes
    // the calendar disagree with the board.
    const shared = {
      title: draft.title.trim() || 'Untitled post',
      caption: draft.caption,
      status: draft.status,
      platforms: buildPlatforms(draft, existing?.platforms ?? []),
      media: draft.media,
      tags,
      notes: draft.notes.trim() || undefined,
      cardId: draft.cardId || undefined,
      scheduledDate: draft.date || undefined,
      scheduledTime: draft.time || undefined,
      scheduledAt: undefined,
    }

    if (existing) {
      updateSocialPost(existing.id, shared)
    } else {
      addSocialPost({ ...shared, repeat: 'none' })
    }
    onClose()
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
        className="absolute inset-0 bg-brand-ink/20 backdrop-blur-[1px]"
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
          <Input
            ref={titleRef}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Post title"
            aria-label="Post title"
            className="text-base font-semibold"
          />

          <div>
            <SectionLabel>Status</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PLANNER_STAGES.map(({ value, label, dot }) => {
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
                      onClick={() => set('media', draft.media.filter((m) => m.id !== item.id))}
                      aria-label={`Remove ${item.name}`}
                      className="absolute right-1 top-1 rounded bg-brand-ink/70 p-0.5 text-brand-ivory opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
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
            <Button variant="primary" size="sm" onClick={handleSave} disabled={draft.platforms.length === 0}>
              {isCreate ? 'Create post' : 'Save changes'}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
