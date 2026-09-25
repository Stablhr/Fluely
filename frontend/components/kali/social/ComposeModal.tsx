'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Calendar, Tag, Sparkles, AlertTriangle, CheckCircle2, Clock, Loader2, Library } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { SocialPost, SocialPostPlatform, SocialMediaAttachment, Platform } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS, PLATFORM_DEFAULTS, PLATFORM_LIMITS } from '@/lib/kali/store/schema'
import Button from '../shared/Button'
import { Input, Textarea } from '../shared/Input'
import SectionLabel from '../shared/SectionLabel'
import AIGenerateModal from './AIGenerateModal'
import { uploadFile } from '@/lib/kali/api/client'
import { COMMON_TIMEZONES, getBrowserTimezone } from '@/lib/kali/utils/timezones'
import { useMediaLibrary } from '@/lib/kali/feature-hooks/useMediaLibrary'
import MediaLibraryPanel from './MediaLibraryPanel'
import PlatformIcon from './PlatformIcon'

const ALL_PLATFORMS: Platform[] = ['youtube', 'facebook', 'tiktok', 'instagram']

function PlatformChip({ platform, enabled, onToggle }: {
  platform: Platform
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={`${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${enabled ? 'enabled' : 'disabled'}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
        enabled
          ? 'border-transparent text-white shadow-subtle'
          : 'border-border bg-surface text-text-secondary hover:bg-surface-alt'
      }`}
      style={enabled ? { background: PLATFORM_COLORS[platform] } : undefined}
    >
      <PlatformIcon platform={platform} size={13} />
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </button>
  )
}

function PlatformOverridePanel({ platform, postPlatform, onChange }: {
  platform: Platform
  postPlatform: SocialPostPlatform | undefined
  onChange: (patch: Partial<SocialPostPlatform>) => void
}) {
  if (!postPlatform) return null
  const limits = PLATFORM_LIMITS[platform]

  return (
    <div className="rounded-lg border border-border bg-surface-alt p-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: PLATFORM_COLORS[platform] }}
        >
          <PlatformIcon platform={platform} size={12} />
        </span>
        <span className="text-xs font-semibold text-text-primary">
          {platform.charAt(0).toUpperCase() + platform.slice(1)} Override
        </span>
      </div>
      <div className="mt-2 space-y-2">
        <div>
          <label className="text-[11px] font-medium text-text-secondary">Caption</label>
          <Textarea
            rows={3}
            value={postPlatform.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder={`Platform-specific caption for ${platform}...`}
            className="mt-1 text-xs"
          />
          <p className="mt-0.5 text-[10px] text-text-muted">
            {postPlatform.caption.length}/{limits.maxCaption} chars
          </p>
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-secondary">Hashtags</label>
          <Input
            value={postPlatform.hashtags.join(', ')}
            onChange={(e) => onChange({ hashtags: e.target.value.split(',').map((h) => h.trim()).filter(Boolean) })}
            placeholder="tag1, tag2, tag3"
            className="mt-1 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-secondary">Visibility</label>
          <select
            value={postPlatform.visibility}
            onChange={(e) => onChange({ visibility: e.target.value as SocialPostPlatform['visibility'] })}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="friends">Friends</option>
            <option value="unlisted">Unlisted</option>
          </select>
      </div>
      </div>
    </div>
  )
}

export default function ComposeModal({ post, initialDate, initialTime, initialCardId, onClose }: {
  post: SocialPost | null
  initialDate?: string
  initialTime?: string
  initialCardId?: string
  onClose: () => void
}) {
  const { addSocialPost, updateSocialPost, removeMediaFromPost, scheduleSocialPost } = useStore()

  const [title, setTitle] = useState(post?.title ?? '')
  const [caption, setCaption] = useState(post?.caption ?? '')
  const [enabledPlatforms, setEnabledPlatforms] = useState<Set<Platform>>(
    new Set(post?.platforms.filter((p) => p.enabled).map((p) => p.platform) ?? [])
  )
  const [platformOverrides, setPlatformOverrides] = useState<Map<Platform, SocialPostPlatform>>(
    new Map(post?.platforms.map((p) => [p.platform, p]) ?? [])
  )
  const [scheduledDate, setScheduledDate] = useState(post?.scheduledDate ?? initialDate ?? '')
  const [scheduledTime, setScheduledTime] = useState(post?.scheduledTime ?? initialTime ?? '')
  const [timezone, setTimezone] = useState(post?.timezone ?? getBrowserTimezone())
  const [repeat, setRepeat] = useState<SocialPost['repeat']>(post?.repeat ?? 'none')
  const [repeatUntil, setRepeatUntil] = useState(post?.repeatUntil ?? '')
  const [tags, setTags] = useState(post?.tags.join(', ') ?? '')
  const [media, setMedia] = useState<SocialMediaAttachment[]>(post?.media ?? [])
  const [aiOpen, setAiOpen] = useState(false)
  const [scheduling, setScheduling] = useState<'idle' | 'scheduling' | 'done'>('idle')
  const [scheduleResult, setScheduleResult] = useState<{ ok: boolean; errors?: string[] } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const { addToLibrary } = useMediaLibrary()

  const isEditing = !!post

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose()
  }, [handleClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const togglePlatform = (platform: Platform) => {
    setEnabledPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) {
        next.delete(platform)
      } else {
        next.add(platform)
        if (!platformOverrides.has(platform)) {
          const defaults = PLATFORM_DEFAULTS[platform]
          setPlatformOverrides((prevMap) => {
            const nextMap = new Map(prevMap)
            nextMap.set(platform, {
              platform,
              enabled: true,
              status: 'pending',
              caption: defaults.caption ?? '',
              hashtags: defaults.hashtags ? [...defaults.hashtags] : [],
              mentions: [],
              visibility: defaults.visibility ?? 'public',
            })
            return nextMap
          })
        }
      }
      return next
    })
  }

  const updateOverride = (platform: Platform, patch: Partial<SocialPostPlatform>) => {
    setPlatformOverrides((prev) => {
      const next = new Map(prev)
      const existing = next.get(platform)
      if (existing) {
        next.set(platform, { ...existing, ...patch })
      }
      return next
    })
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const uploadPromises = Array.from(files).map(async (file) => {
      const mediaType: SocialMediaAttachment['type'] = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'image'
      try {
        const result = await uploadFile(file)
        return {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: mediaType,
          name: file.name,
          dataUrl: result.storageUrl,
          storageUrl: result.storageUrl,
          size: file.size,
          mimeType: result.mimeType,
          platformCompat: ALL_PLATFORMS,
        } as SocialMediaAttachment
      } catch {
        // Fallback to base64 if API is unavailable
        return new Promise<SocialMediaAttachment>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: mediaType,
              name: file.name,
              dataUrl: reader.result as string,
              size: file.size,
              platformCompat: ALL_PLATFORMS,
            })
          }
          reader.readAsDataURL(file)
        })
      }
    })
    const results = await Promise.all(uploadPromises)
    setMedia((prev) => [...prev, ...results])
    e.target.value = ''
  }

  const buildPostData = (status: 'draft' | 'scheduled') => {
    const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const platforms: SocialPostPlatform[] = ALL_PLATFORMS
      .filter((p) => enabledPlatforms.has(p))
      .map((p) => {
        const override = platformOverrides.get(p)
        return override ?? {
          platform: p,
          enabled: true,
          status: 'pending' as const,
          caption: '',
          hashtags: [],
          mentions: [],
          visibility: 'public' as const,
        }
      })

    return {
      title: title.trim() || 'Untitled Post',
      caption,
      platforms,
      media,
      cardId: isEditing ? post?.cardId : initialCardId,
      scheduledDate: status === 'scheduled' ? scheduledDate || undefined : undefined,
      scheduledTime: status === 'scheduled' ? scheduledTime || undefined : undefined,
      scheduledAt: status === 'scheduled' && scheduledDate ? undefined : undefined,
      timezone: status === 'scheduled' ? timezone : undefined,
      status,
      repeat,
      repeatUntil: repeat !== 'none' && repeatUntil ? repeatUntil : undefined,
      tags: parsedTags,
    }
  }

  const handleSaveDraft = () => {
    const postData = buildPostData('draft')
    if (isEditing && post) {
      updateSocialPost(post.id, postData)
    } else {
      addSocialPost(postData)
    }
    onClose()
  }

  const handleSchedule = async () => {
    if (!scheduledDate) {
      setScheduleResult({ ok: false, errors: ['Please set a schedule date'] })
      setShowPreview(true)
      return
    }
    setScheduling('scheduling')
    setShowPreview(true)
    setScheduleResult(null)

    const postData = buildPostData('scheduled')
    let id: string
    if (isEditing && post) {
      updateSocialPost(post.id, postData)
      id = post.id
    } else {
      const created = addSocialPost(postData)
      id = created.id
    }

    const result = await scheduleSocialPost(id, {
      scheduledDate,
      scheduledTime: scheduledTime || undefined,
      timezone,
      repeat,
      repeatUntil: repeat !== 'none' && repeatUntil ? repeatUntil : undefined,
    })
    setScheduleResult(result)
    setScheduling('done')
    if (result.ok) {
      // Keep modal open to show success + preview.
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="compose-modal-title">
      <div className="absolute inset-0 bg-[#0f1a19]/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto p-3 pt-8 sm:pt-16">
      <div className="animate-in flex w-full max-w-2xl flex-col rounded-[14px] border border-border bg-surface shadow-modal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="compose-modal-title" className="text-base font-semibold text-text-primary">
            {isEditing ? 'Edit Social Post' : 'Compose Social Post'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close compose dialog"
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-slim flex-1 overflow-y-auto p-4 space-y-5">
          {/* Platform Selector */}
          <div>
            <SectionLabel>Platforms</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => (
                <PlatformChip
                  key={p}
                  platform={p}
                  enabled={enabledPlatforms.has(p)}
                  onToggle={() => togglePlatform(p)}
                />
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <SectionLabel>Title</SectionLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Internal post title..."
              className="mt-2"
            />
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between">
              <SectionLabel>Default Caption</SectionLabel>
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                aria-label="Generate caption with AI"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary-subtle"
              >
                <Sparkles size={12} />
                AI Generate
              </button>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here..."
              rows={5}
              className="mt-2"
            />
            <p className="mt-1 text-xs text-text-muted">{caption.length} characters</p>
          </div>

          {/* Media */}
          <div>
            <div className="flex items-center justify-between">
              <SectionLabel icon={<Plus size={12} />}>Media</SectionLabel>
              <button
                type="button"
                onClick={() => setLibOpen(true)}
                aria-label="Open media library"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary-subtle"
              >
                <Library size={12} />
                Library
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((m) => (
                <div key={m.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                  {m.type === 'image' ? (
                    <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-alt text-[10px] text-text-muted">
                      {m.type === 'video' ? '🎬' : '🎵'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMediaFromPost(post?.id ?? '', m.id)}
                    aria-label={`Remove ${m.name}`}
                    className="absolute right-0.5 top-0.5 rounded-full bg-danger p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => addToLibrary(m)}
                    aria-label={`Save ${m.name} to library`}
                    className="absolute bottom-0.5 right-0.5 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Library size={10} />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border-strong bg-surface-alt transition-colors hover:border-primary">
                <input type="file" accept="image/*,video/*,audio/*" multiple onChange={handleMediaUpload} className="hidden" aria-label="Upload media file" />
                <Plus size={20} className="text-text-muted" />
              </label>
            </div>
          </div>

          {/* Per-Platform Overrides */}
          {enabledPlatforms.size > 0 && (
            <div>
              <SectionLabel>Per-Platform Overrides</SectionLabel>
              <div className="mt-2 space-y-2">
                {Array.from(enabledPlatforms).map((p) => (
                  <PlatformOverridePanel
                    key={p}
                    platform={p}
                    postPlatform={platformOverrides.get(p)}
                    onChange={(patch) => updateOverride(p, patch)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scheduling */}
          <div>
            <SectionLabel icon={<Calendar size={12} />}>Scheduling</SectionLabel>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[11px] font-medium text-text-secondary">Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary">Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="min-w-[220px] flex-1">
                <label className="text-[11px] font-medium text-text-secondary">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  aria-label="Schedule timezone"
                  className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
                >
                  <option value={getBrowserTimezone()}>Browser timezone ({getBrowserTimezone() || 'UTC'})</option>
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-secondary">Repeat</label>
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as SocialPost['repeat'])}
                  aria-label="Repeat frequency"
                  className="mt-1 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            {repeat !== 'none' && (
              <div className="mt-2">
                <label className="text-[11px] font-medium text-text-secondary">Repeat until (optional)</label>
                <Input
                  type="date"
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            {scheduledDate && (
              <p className="mt-2 flex items-center gap-1 text-xs text-text-muted">
                <Clock size={12} />
                Fires at {scheduledDate}{scheduledTime ? ` ${scheduledTime}` : ' 00:00'} ({timezone || 'UTC'})
                {repeat !== 'none' && ` · repeats ${repeat}`}
              </p>
            )}
          </div>

          {/* Publishing Preview / Result */}
          {(showPreview || scheduleResult) && (
            <div className="rounded-lg border border-border bg-surface-alt p-3">
              <div className="flex items-center justify-between">
                <SectionLabel icon={<AlertTriangle size={12} />}>Publishing Preview</SectionLabel>
                {scheduling === 'done' && scheduleResult?.ok && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text">
                    <CheckCircle2 size={13} />
                    Scheduled
                  </span>
                )}
              </div>

              {scheduling === 'scheduling' && (
                <p className="mt-2 text-sm text-text-muted">Scheduling and validating against platform rules…</p>
              )}

              {scheduling === 'done' && scheduleResult && (
                <div className="mt-2 space-y-1">
                  {scheduleResult.ok ? (
                    <p className="flex items-center gap-1.5 text-sm text-success-text">
                      <CheckCircle2 size={14} />
                      Validated and queued for publishing.
                    </p>
                  ) : (
                    <div className="rounded-md bg-danger-subtle px-2.5 py-1.5 text-xs text-danger-text">
                      {scheduleResult.errors?.map((e, i) => <div key={i}>• {e}</div>)}
                    </div>
                  )}
                </div>
              )}

              {enabledPlatforms.size === 0 && (
                <p className="mt-2 text-xs text-text-muted">Enable at least one platform to schedule.</p>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <SectionLabel icon={<Tag size={12} />}>Tags</SectionLabel>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="marketing, launch, promo"
              className="mt-2"
            />
            <p className="mt-1 text-[10px] text-text-muted">Comma-separated tags for filtering</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="secondary" onClick={handleSaveDraft}>Save Draft</Button>
          <Button
            variant="primary"
            onClick={scheduleResult?.ok ? onClose : handleSchedule}
            disabled={scheduling === 'scheduling'}
          >
            {scheduling === 'scheduling' ? (
              <><Loader2 size={14} className="animate-spin" />Scheduling…</>
            ) : scheduleResult?.ok ? (
              <>Done</>
            ) : (
              <>Schedule</>
            )}
          </Button>
        </div>
      </div>
      </div>

      {aiOpen && (
        <AIGenerateModal
          onUse={(generated) => setCaption(generated)}
          onClose={() => setAiOpen(false)}
        />
      )}

      {libOpen && (
        <MediaLibraryPanel
          onClose={() => setLibOpen(false)}
          onUse={(item) => {
            setMedia((prev) => [
              ...prev,
              {
                id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: item.type as SocialMediaAttachment['type'],
                name: item.name,
                dataUrl: item.dataUrl,
                size: 0,
                platformCompat: (item.platformCompat as Platform[]) ?? ALL_PLATFORMS,
              } as SocialMediaAttachment,
            ])
            setLibOpen(false)
          }}
        />
      )}
    </div>
  )
}
