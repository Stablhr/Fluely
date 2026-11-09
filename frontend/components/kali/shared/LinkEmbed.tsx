'use client'

import { useState } from 'react'
import { ExternalLink, Play, Video } from 'lucide-react'
import type { EmbedDescriptor, EmbedProvider } from '@/lib/kali/utils/embed'

/**
 * Inline preview for a link that sits alone on its own line.
 *
 * The player is collapsed until the person presses play. Nothing from the
 * provider is requested before then apart from the YouTube poster, so opening a
 * card with a link in it stays cheap. The frame's source is always the
 * validated URL built by `parseEmbed`, never the raw pasted address.
 */

const PROVIDER_LABEL: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  'google-drive': 'Google Drive',
  video: 'Video',
}

const OPEN_LABEL: Record<EmbedProvider, string> = {
  youtube: 'Open on YouTube',
  vimeo: 'Open on Vimeo',
  'google-drive': 'Open in Google Drive',
  video: 'Open video',
}

const ASPECT_CLASS: Record<EmbedDescriptor['aspectRatio'], string> = {
  '16/9': 'aspect-video',
  '9/16': 'aspect-[9/16]',
  '4/3': 'aspect-[4/3]',
}

function ProviderIcon({ provider, size }: { provider: EmbedProvider; size: number }) {
  if (provider === 'google-drive') return <Play size={size} className="translate-x-[1px]" aria-hidden="true" />
  if (provider === 'video') return <Video size={size} aria-hidden="true" />
  return <Play size={size} className="translate-x-[1px]" aria-hidden="true" />
}

export default function LinkEmbed({
  descriptor,
  interactive = true,
}: {
  descriptor: EmbedDescriptor
  interactive?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const label = PROVIDER_LABEL[descriptor.provider]
  const openLabel = OPEN_LABEL[descriptor.provider]
  const portrait = descriptor.aspectRatio === '9/16'

  return (
    <span
      className={`my-2 mx-auto block w-full overflow-hidden rounded-2xl border border-border bg-surface ${
        portrait ? 'max-w-[320px]' : 'max-w-[560px]'
      }`.trim()}
    >
      <span className={`relative block w-full bg-surface-alt ${ASPECT_CLASS[descriptor.aspectRatio]}`}>
        {expanded ? (
          descriptor.provider === 'video' ? (
            <video
              controls
              preload="metadata"
              src={descriptor.sourceUrl}
              className="absolute inset-0 h-full w-full bg-brand-ink object-contain"
            />
          ) : (
            <iframe
              src={descriptor.embedUrl}
              title={`${label} preview`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          )
        ) : (
          <>
            {descriptor.thumbnailUrl ? (
              <img
                src={descriptor.thumbnailUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center bg-surface-alt text-text-muted">
                <ProviderIcon provider={descriptor.provider} size={30} />
              </span>
            )}

            {interactive ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={`Play ${label} preview`}
                className="absolute inset-0 flex items-center justify-center bg-brand-ink/25 transition-colors hover:bg-brand-ink/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <ProviderIcon provider={descriptor.provider} size={24} />
                </span>
              </button>
            ) : (
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-brand-ink/25">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <ProviderIcon provider={descriptor.provider} size={24} />
                </span>
              </span>
            )}
          </>
        )}
      </span>

      {descriptor.provider !== 'youtube' &&
        descriptor.provider !== 'google-drive' &&
        descriptor.provider !== 'video' && (
        <span className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2">
          <span className="min-w-0 truncate text-xs text-text-muted">{label}</span>
          {interactive ? (
            <a
              href={descriptor.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              title={descriptor.sourceUrl}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-semibold text-primary-text underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {openLabel}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-text">
              {openLabel}
              <ExternalLink size={12} aria-hidden="true" />
            </span>
          )}
        </span>
      )}
    </span>
  )
}
