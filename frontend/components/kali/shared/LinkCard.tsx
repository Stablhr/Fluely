'use client'

import { useState } from 'react'
import { ExternalLink, Globe } from 'lucide-react'
import { useLinkPreview } from '@/lib/hooks/useLinkPreview'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import type { LinkPreviewDto } from '@/lib/api/embedsApi'

/**
 * Compact card for a link that sits alone on its own line but has no local
 * provider preview.
 *
 * The metadata is fetched once per address and cached; a failed lookup is not
 * an error state for the text. Read views fall back to the ordinary link the
 * person would have seen before cards existed, while the composer — where the
 * preview was explicitly requested — shows a skeleton and a short explanation.
 */

const LINK_CLASS =
  'rounded-sm text-primary-text underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

interface LinkCardProps {
  href: string
  /** The address as it appeared in the text, used for the fallback link. */
  label: string
  /** Set false in preview mocks so the card cannot navigate away from the app. */
  interactive?: boolean
  /**
   * `read` keeps the current link visible while loading or after a failure.
   * `composer` was opted into, so it shows a skeleton and an error note.
   */
  variant?: 'read' | 'composer'
}

function hostnameOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return href
  }
}

function isHttpImage(url: string | null): url is string {
  if (!url) return false
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function LinkFallback({
  href,
  label,
  interactive,
}: {
  href: string
  label: string
  interactive: boolean
}) {
  if (!interactive) return <span className={LINK_CLASS}>{label}</span>

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      title={href}
      className={LINK_CLASS}
    >
      {label}
    </a>
  )
}

const CARD_CLASS =
  'my-2 flex w-full overflow-hidden rounded-2xl border border-border bg-surface'

function CardBody({ preview, href }: { preview: LinkPreviewDto; href: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const hostname = hostnameOf(href)
  const title = preview.title?.trim() || hostname
  const description = preview.description?.trim() || null
  const showImage = isHttpImage(preview.thumbnailUrl) && !imageFailed

  return (
    <>
      <span className="relative block h-[72px] w-[96px] shrink-0 overflow-hidden bg-surface-alt">
        {showImage ? (
          <img
            src={preview.thumbnailUrl ?? ''}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-text-muted">
            <Globe size={22} aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {hostname}
        </span>
        <span className="line-clamp-2 block text-xs font-semibold leading-snug text-text-primary">
          {title}
        </span>
        {description && (
          <span className="line-clamp-2 block text-[11px] leading-snug text-text-secondary">
            {description}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center pr-3 text-text-muted">
        <ExternalLink size={13} aria-hidden="true" />
      </span>
    </>
  )
}

function SkeletonCard() {
  return (
    <span
      aria-hidden="true"
      className="my-2 flex w-full animate-pulse overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <span className="block h-[72px] w-[96px] shrink-0 bg-surface-alt" />
      <span className="flex flex-1 flex-col justify-center gap-1.5 px-3 py-2">
        <span className="block h-2 w-16 rounded-full bg-surface-alt" />
        <span className="block h-2.5 w-3/4 rounded-full bg-surface-alt" />
        <span className="block h-2 w-1/2 rounded-full bg-surface-alt" />
      </span>
    </span>
  )
}

export default function LinkCard({
  href,
  label,
  interactive = true,
  variant = 'read',
}: LinkCardProps) {
  const { data, isPending, isError, error } = useLinkPreview(href)
  const fallback = <LinkFallback href={href} label={label} interactive={interactive} />

  if (isPending) {
    if (variant === 'composer') return <SkeletonCard />
    return <span className="block">{fallback}</span>
  }

  if (isError || !data) {
    if (variant === 'composer') {
      return (
        <span className="my-2 flex flex-col gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2">
          <span className="text-[11px] text-text-muted">
            {getFriendlyErrorMessage(error, "This link can't be previewed right now.")}
          </span>
          <span className="block truncate">{fallback}</span>
        </span>
      )
    }
    return <span className="block">{fallback}</span>
  }

  if (!interactive) {
    return (
      <span className={CARD_CLASS}>
        <CardBody key={`${href}-${data.thumbnailUrl ?? ''}`} preview={data} href={href} />
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      title={href}
      className={`${CARD_CLASS} transition-colors hover:border-border-strong hover:bg-surface-alt/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
    >
      <CardBody key={`${href}-${data.thumbnailUrl ?? ''}`} preview={data} href={href} />
    </a>
  )
}
