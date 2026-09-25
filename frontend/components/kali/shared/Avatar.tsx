'use client'

import type { Member } from '@/lib/kali/store/schema'

interface AvatarProps {
  member: Member
  size?: number
  stacked?: boolean
}

export default function Avatar({ member, size = 20, stacked = false }: AvatarProps) {
  const initials = member.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${stacked ? 'border-2 border-surface' : ''}`}
      style={{ width: size, height: size, background: member.color, fontSize: Math.max(9, size * 0.4) }}
      title={member.name}
    >
      {initials}
    </span>
  )
}
