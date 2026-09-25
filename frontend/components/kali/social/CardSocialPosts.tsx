'use client'

import { useState } from 'react'
import { Share2, Plus, X, Clock, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { SocialPost, SocialPostStatus } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS } from '@/lib/kali/store/schema'
import ComposeModal from './ComposeModal'
import PlatformIcon from './PlatformIcon'

const STATUS_ICONS: Record<SocialPostStatus, typeof Clock> = {
  draft: FileText,
  scheduled: Clock,
  publishing: AlertCircle,
  posted: CheckCircle2,
  partially_published: AlertCircle,
  failed: XCircle,
  cancelled: XCircle,
}

const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft: 'text-text-muted',
  scheduled: 'text-info-text',
  publishing: 'text-warning-text',
  posted: 'text-success-text',
  partially_published: 'text-warning-text',
  failed: 'text-danger-text',
  cancelled: 'text-text-muted',
}

function LinkedPostRow({ post, onUnlink }: { post: SocialPost; onUnlink: () => void }) {
  const StatusIcon = STATUS_ICONS[post.status]
  const statusColor = STATUS_COLORS[post.status]
  const enabledPlatforms = post.platforms.filter((p) => p.enabled)

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
      <StatusIcon size={13} className={`shrink-0 ${statusColor}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-text-primary">{post.title || 'Untitled'}</p>
        <div className="mt-0.5 flex items-center gap-1">
          {enabledPlatforms.map((p) => (
            <span
              key={p.platform}
              className="inline-flex h-3 w-3 items-center justify-center rounded-full text-white"
              style={{ background: PLATFORM_COLORS[p.platform] }}
            >
              <PlatformIcon platform={p.platform} size={7} />
            </span>
          ))}
          {post.scheduledDate && (
            <span className="text-[10px] text-text-muted">{post.scheduledDate}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onUnlink}
        aria-label="Unlink post"
        className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:bg-danger-subtle hover:text-danger-text"
        title="Unlink post"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function CardSocialPosts({ cardId }: { cardId: string }) {
  const { socialPosts, updateSocialPost } = useStore()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)

  const linkedPosts = socialPosts.filter((p) => p.cardId === cardId)
  const unlinkedPosts = socialPosts.filter((p) => !p.cardId)

  const handleLink = (postId: string) => {
    updateSocialPost(postId, { cardId })
    setLinkModalOpen(false)
  }

  const handleUnlink = (postId: string) => {
    updateSocialPost(postId, { cardId: undefined })
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Share2 size={14} className="text-text-secondary" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">Social Posts</h3>
        {linkedPosts.length > 0 && (
          <span className="font-mono text-[10px] text-text-muted">{linkedPosts.length}</span>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {linkedPosts.map((post) => (
          <LinkedPostRow key={post.id} post={post} onUnlink={() => handleUnlink(post.id)} />
        ))}

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            aria-label="Create new social post for this card"
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Plus size={12} />
            Create Post
          </button>
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            aria-label="Link existing social post to this card"
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <Share2 size={12} />
            Link Existing
          </button>
        </div>
      </div>

      {composeOpen && (
        <ComposeModal
          post={null}
          initialCardId={cardId}
          onClose={() => setComposeOpen(false)}
        />
      )}

      {linkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="link-social-post-title">
          <div className="absolute inset-0 bg-brand-ink/50" onClick={() => setLinkModalOpen(false)} />
          <div className="animate-in relative z-10 w-full max-w-sm rounded-[14px] border border-border bg-surface shadow-modal">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 id="link-social-post-title" className="text-sm font-semibold text-text-primary">Link Social Post</h3>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                aria-label="Close link modal"
                className="rounded p-1 text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto p-3" aria-label="Available social posts to link">
              {unlinkedPosts.length === 0 ? (
                <p className="py-4 text-center text-xs text-text-muted">No unlinked posts available.</p>
              ) : (
                <div className="space-y-1.5">
                  {unlinkedPosts.map((post) => {
                    const StatusIcon = STATUS_ICONS[post.status]
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => handleLink(post.id)}
                        className="flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left transition-colors hover:bg-surface-alt"
                      >
                        <StatusIcon size={13} className={`shrink-0 ${STATUS_COLORS[post.status]}`} />
                        <span className="truncate text-[12px] font-medium text-text-primary">
                          {post.title || 'Untitled'}
                        </span>
                        <span className="ml-auto text-[10px] text-text-muted">
                          {post.platforms.filter((p) => p.enabled).length} platforms
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
