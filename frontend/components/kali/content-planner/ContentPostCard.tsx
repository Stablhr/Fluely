'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { SocialPost } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS } from '@/lib/kali/store/schema'
import { Clock, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react'
import PlatformIcon from '../social/PlatformIcon'

const STATUS_ICONS: Record<string, typeof Clock> = {
  draft: FileText,
  scheduled: Clock,
  publishing: AlertCircle,
  posted: CheckCircle2,
  failed: XCircle,
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-text-muted',
  scheduled: 'text-info-text',
  publishing: 'text-warning-text',
  posted: 'text-success-text',
  failed: 'text-danger-text',
}

interface ContentPostCardProps {
  post: SocialPost
  index: number
  onClick: () => void
  compact?: boolean
}

export default function ContentPostCard({ post, index, onClick, compact }: ContentPostCardProps) {
  const enabledPlatforms = post.platforms.filter((p) => p.enabled)
  const StatusIcon = STATUS_ICONS[post.status] ?? Clock
  const statusColor = STATUS_COLORS[post.status] ?? 'text-text-muted'
  const thumb = post.media.find((m) => m.type === 'image')

  return (
    <Draggable draggableId={post.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Post: ${post.title || 'Untitled'}`}
          aria-roledescription="draggable"
          className={`flex items-start gap-1.5 rounded-md border border-border bg-surface p-1.5 cursor-grab active:cursor-grabbing ${
            snapshot.isDragging
              ? 'z-50 shadow-modal ring-2 ring-primary/40'
              : 'transition-colors duration-150 hover:bg-surface-alt'
          }`}
          style={provided.draggableProps.style}
        >
          {thumb && !compact && (
            <img
              src={thumb.dataUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-cover"
              loading="lazy"
            />
          )}
          {!thumb && !compact && (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] text-white"
              style={{ background: enabledPlatforms[0] ? PLATFORM_COLORS[enabledPlatforms[0].platform] : '#8a9068' }}
            >
              {enabledPlatforms[0] && <PlatformIcon platform={enabledPlatforms[0].platform} size={14} />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <StatusIcon size={10} className={`shrink-0 ${statusColor}`} />
              <p className="truncate text-[11px] font-medium leading-tight text-text-primary">
                {post.title || 'Untitled'}
              </p>
            </div>
            {!compact && (
              <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                {post.scheduledTime ?? 'time TBD'}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-0.5">
              {enabledPlatforms.map((p) => (
                <span
                  key={p.platform}
                  className="inline-flex h-3 w-3 items-center justify-center rounded-full text-white"
                  style={{ background: PLATFORM_COLORS[p.platform] }}
                >
                  <PlatformIcon platform={p.platform} size={7} />
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}