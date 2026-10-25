'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { User, Briefcase, Mail, Phone, Clock } from 'lucide-react'
import { getPublicProfile, type PublicProfile } from '@/lib/api/profileApi'

export type { PublicProfile }

type Props = {
  profile: PublicProfile
  boardRole?: 'owner' | 'editor' | 'viewer' | null
  commonBoards?: number
  assignedCards?: number
  className?: string
}

export function colorFromId(id: string): string {
  const palette = ['#3971b8', '#c8d69b', '#f6e6a5', '#ff8b5e', '#8b7cf6', '#33b27a', '#ff5e6c', '#4aa8ff']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function localTime(timezone: string | null) {
  if (!timezone) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date())
  } catch {
    return null
  }
}

export function ProfileCard({
  profile,
  boardRole,
  commonBoards,
  assignedCards,
  className = '',
}: Props) {
  const name = profile.displayName
  const color = profile.avatarColor || colorFromId(profile.id)
  const accent = profile.accentColor || '#3971b8'
  const time = localTime(profile.timezone)

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-medium ${className}`}>
      <div className="h-16 w-full" style={{ background: accent }} />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={name}
              className="h-16 w-16 shrink-0 rounded-full border-4 border-surface object-cover shadow-subtle"
            />
          ) : (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-surface text-[18px] font-semibold text-white shadow-subtle"
              style={{ background: color }}
            >
              {initials(name)}
            </span>
          )}
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[17px] font-semibold text-text-primary">{name}</h3>
              {profile.pronouns && (
                <span className="text-[12px] text-text-muted">({profile.pronouns})</span>
              )}
            </div>
            {profile.username && (
              <p className="truncate text-[12px] font-medium text-primary-hover">@{profile.username}</p>
            )}
          </div>
        </div>

        {profile.jobTitle && (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-text-secondary">
            <Briefcase size={13} className="shrink-0" />
            {profile.jobTitle}
          </p>
        )}
        {profile.bio && (
          <p className="mt-2 text-[13px] leading-relaxed text-text-primary">{profile.bio}</p>
        )}

        <div className="mt-3 space-y-1.5 text-[12px] text-text-muted">
          {time && profile.timezone && (
            <p className="flex items-center gap-1.5">
              <Clock size={12} className="shrink-0" />
              Local time: {time} ({profile.timezone})
            </p>
          )}
          {boardRole && (
            <p className="flex items-center gap-1.5">
              <User size={12} className="shrink-0" />
              Role: {boardRole.charAt(0).toUpperCase() + boardRole.slice(1)}
            </p>
          )}
          {commonBoards !== undefined && <p>Shared boards: {commonBoards}</p>}
          {assignedCards !== undefined && <p>Cards assigned: {assignedCards}</p>}
          <p>Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
        </div>

        {(profile.email || profile.phone) && (
          <div className="mt-3 space-y-1 text-[12px] text-text-secondary">
            {profile.email && (
              <p className="flex items-center gap-1.5">
                <Mail size={12} className="shrink-0" />
                {profile.email}
              </p>
            )}
            {profile.phone && (
              <p className="flex items-center gap-1.5">
                <Phone size={12} className="shrink-0" />
                {profile.phone}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const publicProfileQueryKey = (userId: string, boardId?: string) =>
  ['publicProfile', userId, boardId ?? null] as const

export function usePublicProfile(userId: string | null, boardId?: string) {
  return useQuery({
    queryKey: publicProfileQueryKey(userId ?? '', boardId),
    queryFn: () => getPublicProfile(userId as string, boardId),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
