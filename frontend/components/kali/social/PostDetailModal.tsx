'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Ban,
  ExternalLink,
  CalendarDays,
  Hash,
  Play,
  Globe,
  Camera,
  Music,
} from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { SocialPost, Platform, PlatformStatus } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS } from '@/lib/kali/store/schema'
import Button from '../shared/Button'
import { useToast } from '../shared/useToastState'

const PLATFORM_ICONS: Record<Platform, typeof Play> = {
  youtube: Play,
  facebook: Globe,
  instagram: Camera,
  tiktok: Music,
}

const STATUS_META: Record<PlatformStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'text-text-muted' },
  scheduled: { label: 'Scheduled', icon: Clock, className: 'text-info-text' },
  publishing: { label: 'Publishing', icon: Loader2, className: 'text-warning-text' },
  posted: { label: 'Posted', icon: CheckCircle2, className: 'text-success-text' },
  failed: { label: 'Failed', icon: XCircle, className: 'text-danger-text' },
  cancelled: { label: 'Cancelled', icon: Ban, className: 'text-text-muted' },
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PostDetailModal({ postId, onClose, onEdit }: {
  postId: string
  onClose: () => void
  onEdit?: (post: SocialPost) => void
}) {
  const { socialPosts, socialJobs, cancelSocialPost, retrySocialPost, refreshSocialJobs } = useStore()
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const post = socialPosts.find((p) => p.id === postId)
  const jobs = socialJobs.filter((j) => j.socialPostId === postId)

  const loadJobs = useCallback(() => {
    refreshSocialJobs(postId)
  }, [postId, refreshSocialJobs])

  useEffect(() => {
    loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = useCallback(() => onClose(), [onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  if (!post) return null

  const handleCancelAll = async () => {
    setBusy('all')
    const ok = await cancelSocialPost(post.id)
    if (ok) toast('Post cancelled', 'success')
    else toast('Failed to cancel (offline)', 'error')
    setBusy(null)
  }

  const handleRetryAll = async () => {
    setBusy('all')
    const ok = await retrySocialPost(post.id)
    if (ok) toast('Retry queued', 'success')
    else toast('Failed to retry (offline)', 'error')
    setBusy(null)
  }

  const handleCancelPlatform = async (platform: Platform) => {
    setBusy(platform)
    await cancelSocialPost(post.id, platform)
    setBusy(null)
  }

  const handleRetryPlatform = async (platform: Platform) => {
    setBusy(platform)
    await retrySocialPost(post.id, platform)
    setBusy(null)
  }

  const enabledPlatforms = post.platforms.filter((p) => p.enabled)
  const hasFailed = enabledPlatforms.some((p) => p.status === 'failed')
  const isActive = post.status === 'scheduled' || post.status === 'publishing'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="post-detail-title">
      <div className="absolute inset-0 bg-[#0f1a19]/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto p-3 pt-8 sm:pt-16">
        <div className="animate-in flex w-full max-w-2xl flex-col rounded-[14px] border border-border bg-surface glass-heavy shadow-modal">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 id="post-detail-title" className="truncate text-base font-semibold text-text-primary">
                {post.title || 'Untitled Post'}
              </h2>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-muted">
                <Clock size={11} />
                {post.status}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close details"
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
            >
              <X size={18} />
            </button>
          </div>

          <div className="scroll-slim flex-1 overflow-y-auto p-4 space-y-5">
            {post.caption && (
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{post.caption}</p>
            )}

            {/* Schedule */}
            <div className="rounded-lg border border-border bg-surface-alt p-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-text-secondary">
                  <CalendarDays size={14} />
                  {post.scheduledDate
                    ? `${post.scheduledDate}${post.scheduledTime ? ` ${post.scheduledTime}` : ''}${post.timezone ? ` (${post.timezone})` : ''}`
                    : 'Not scheduled'}
                </span>
                {post.scheduledAt && (
                  <span className="text-xs text-text-muted">UTC: {formatDateTime(post.scheduledAt)}</span>
                )}
                {post.tags.length > 0 && (
                  <span className="inline-flex flex-wrap items-center gap-1 text-xs text-text-muted">
                    <Hash size={12} />
                    {post.tags.map((t) => <span key={t} className="rounded bg-elevated px-1.5 py-0.5">#{t}</span>)}
                  </span>
                )}
              </div>
            </div>

            {/* Per-platform status */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Platform Status</h3>
                <div className="flex gap-1.5">
                  {isActive && (
                    <Button size="sm" variant="danger" onClick={handleCancelAll} disabled={busy !== null}>
                      {busy === 'all' ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                      Cancel
                    </Button>
                  )}
                  {hasFailed && (
                    <Button size="sm" variant="primary" onClick={handleRetryAll} disabled={busy !== null}>
                      {busy === 'all' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Retry Failed
                    </Button>
                  )}
                </div>
              </div>

              {enabledPlatforms.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No platforms enabled on this post.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {enabledPlatforms.map((p) => {
                    const Icon = PLATFORM_ICONS[p.platform]
                    const meta = STATUS_META[p.status] ?? STATUS_META.pending
                    const StatusIcon = meta.icon
                    return (
                      <div key={p.platform} className="rounded-lg border border-border bg-surface-alt p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: PLATFORM_COLORS[p.platform] }}
                          >
                            <Icon size={12} />
                          </span>
                          <span className="text-sm font-medium capitalize text-text-primary">{p.platform}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
                            <StatusIcon size={12} className={p.status === 'publishing' ? 'animate-spin' : ''} />
                            {meta.label}
                          </span>
                          {p.platformPostId && (
                            <span className="text-[11px] text-text-muted">ID: {p.platformPostId}</span>
                          )}
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-text-secondary sm:grid-cols-2">
                          {p.caption && (
                            <span className="truncate" title={p.caption}>Caption: {p.caption.length} chars</span>
                          )}
                          {p.hashtags.length > 0 && (
                            <span>Hashtags: {p.hashtags.join(', ')}</span>
                          )}
                          {(p.retryCount ?? 0) > 0 && (
                            <span>Retries: {p.retryCount}</span>
                          )}
                          {p.lastAttemptAt && (
                            <span>Last attempt: {formatDateTime(p.lastAttemptAt)}</span>
                          )}
                          {p.publishedAt && (
                            <span>Published: {formatDateTime(p.publishedAt)}</span>
                          )}
                        </div>

                        {p.error && (
                          <div className="mt-2 rounded-md bg-danger-subtle px-2.5 py-1.5 text-xs text-danger-text">
                            <span className="font-semibold">{p.errorCode ? `${p.errorCode}: ` : ''}</span>
                            {p.error}
                          </div>
                        )}

                        {p.publishedUrl && (
                          <a
                            href={p.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <ExternalLink size={12} />
                            View post
                          </a>
                        )}

                        {(p.status === 'scheduled' || p.status === 'publishing') && (
                          <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="danger" onClick={() => handleCancelPlatform(p.platform)} disabled={busy !== null}>
                              {busy === p.platform ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                              Cancel
                            </Button>
                          </div>
                        )}
                        {p.status === 'failed' && (
                          <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="primary" onClick={() => handleRetryPlatform(p.platform)} disabled={busy !== null}>
                              {busy === p.platform ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Job history */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Publishing History</h3>
              {jobs.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No publishing jobs recorded yet.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {jobs.map((job) => (
                    <div key={job._id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-xs">
                      <span className="font-medium capitalize text-text-primary">{job.platform}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        job.status === 'completed' ? 'bg-success-bg text-success-text'
                        : job.status === 'failed' ? 'bg-danger-bg text-danger-text'
                        : job.status === 'cancelled' ? 'bg-elevated text-text-muted'
                        : job.status === 'publishing' ? 'bg-warning-bg text-warning-text'
                        : 'bg-info-bg text-info-text'
                      }`}>
                        {job.status}
                      </span>
                      <span className="text-text-muted">
                        {job.startedAt ? formatDateTime(job.startedAt) : job.createdAt ? formatDateTime(job.createdAt) : 'queued'}
                      </span>
                      {job.retryCount > 0 && <span className="text-text-muted">attempt {job.retryCount + 1}</span>}
                      {job.error && (
                        <span className="ml-auto max-w-[50%] truncate text-danger-text" title={job.error}>{job.error}</span>
                      )}
                      {job.publishResult?.publishedUrl && (
                        <a href={job.publishResult.publishedUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink size={11} /> view
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
            {onEdit && (
              <Button variant="secondary" onClick={() => onEdit(post)}>Edit</Button>
            )}
            <Button variant="ghost" onClick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
