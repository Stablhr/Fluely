'use client'

import { useState } from 'react'
import type { Member } from '@/lib/kali/store/schema'

export function colorFromId(id: string): string {
  const palette = ['#3971b8', '#c8d69b', '#f6e6a5', '#ff8b5e', '#8b7cf6', '#33b27a', '#ff5e6c', '#4aa8ff']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

export function avatarDisplayUrl(url: string | null | undefined, size: number): string | null {
  if (!url) return null
  const marker = '/image/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  const transform = `c_fill,g_face,w_${size},h_${size},f_auto,q_auto,dpr_auto`
  return url.slice(0, idx + marker.length) + transform + '/' + url.slice(idx + marker.length)
}

interface AvatarProps {
  member?: Member
  src?: string | null
  name?: string | null
  color?: string | null
  id?: string | null
  size?: number
  stacked?: boolean
  className?: string
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

export function Avatar({ member, src, name, color, id, size = 20, stacked = false, className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const resolvedName = name ?? member?.name ?? null
  const resolvedColor = color ?? member?.color ?? (id ? colorFromId(id) : '#3971b8')
  const resolvedSrc = src ?? (member as any)?.avatarUrl ?? null
  const showImage = !!resolvedSrc && !failed
  const displaySrc = showImage ? avatarDisplayUrl(resolvedSrc, Math.max(40, size * 2)) : null

  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white ${stacked ? 'border-2 border-surface' : ''} ${className}`}
      style={{ width: size, height: size, background: showImage ? undefined : resolvedColor, fontSize: Math.max(9, size * 0.4) }}
      title={resolvedName ?? undefined}
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
        initials(resolvedName)
      )}
    </span>
  )
}


export default Avatar
