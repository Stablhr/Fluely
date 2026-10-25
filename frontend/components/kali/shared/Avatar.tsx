'use client'

import { useState } from 'react'

/**
 * Brand palette for initials swatches. Matches `ProfileCard` and the settings
 * accent pickers so a person's initials card keeps the same tint everywhere.
 */
export const AVATAR_INITIALS_PALETTE = [
  '#3971b8',
  '#c8d69b',
  '#f6e6a5',
  '#ff8b5e',
  '#8b7cf6',
  '#33b27a',
  '#ff5e6c',
  '#4aa8ff',
]

export function colorFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_INITIALS_PALETTE[hash % AVATAR_INITIALS_PALETTE.length]
}

/**
 * Delivers an already-cropped square avatar from Cloudinary.
 *
 * `c_fill,g_face` centers the crop on a detected face (falls back to center),
 * `f_auto,q_auto,dpr_auto` keeps it light and sharp. Requesting a size close to
 * the display size means a huge original is never rendered in a tiny chip.
 */
export function avatarDisplayUrl(url: string | null | undefined, size: number): string | null {
  if (!url) return null
  const marker = '/image/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  const transform = `c_fill,g_face,w_${size},h_${size},f_auto,q_auto,dpr_auto`
  return url.slice(0, idx + marker.length) + transform + '/' + url.slice(idx + marker.length)
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export type AvatarMember = {
  id: string
  name: string
  color?: string | null
  avatarUrl?: string | null
}

type Props = {
  member?: AvatarMember | null
  size?: number
  className?: string
  name?: string
  color?: string | null
  src?: string | null
  /** Overlaps the previous chip (presence stack). The caller still spaces chips. */
  stacked?: boolean
}

export default function Avatar({
  member,
  size = 36,
  className = '',
  name,
  color,
  src,
  stacked,
}: Props) {
  const [failed, setFailed] = useState(false)
  const resolvedName = name ?? member?.name ?? null
  const resolvedColor = color ?? member?.color ?? (member?.id ? colorFromId(member.id) : '#3971b8')
  const resolvedSrc = src ?? member?.avatarUrl ?? null
  const showImage = !!resolvedSrc && !failed
  const displaySrc = showImage ? avatarDisplayUrl(resolvedSrc, Math.max(40, size * 2)) : null
  const px = size

  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{
        width: px,
        height: px,
        background: showImage ? undefined : resolvedColor,
        fontSize: Math.max(9, size * 0.4),
        ...(stacked ? { marginLeft: Math.round(-px * 0.55) } : {}),
      }}
      title={resolvedName ?? undefined}
      aria-label={resolvedName ?? undefined}
    >
      {showImage ? (
        <img
          src={displaySrc!}
          alt={resolvedName ?? 'Avatar'}
          className="h-full w-full object-cover object-center"
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white font-semibold">
          {initials(resolvedName)}
        </span>
      )}
    </span>
  )
}
