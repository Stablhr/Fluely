'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Monitor, Trash2, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useStore } from '@/lib/kali/store/useStore'
import { meQueryKey, useMeQuery } from '@/lib/hooks/auth/useMeQuery'
import { getDisplayName } from '@/lib/api/authApi'
import { MAX_AVATAR_BYTES, removeAvatar, uploadAvatar } from '@/lib/api/accountApi'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { formatSize } from '@/lib/kali/utils/format'

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-surface-alt px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover active:scale-[0.98] disabled:opacity-40'

export default function SettingsView() {
  const { data, socialPosts } = useStore()
  const { data: me } = useMeQuery()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const user = me?.user
  const avatarUrl = user?.avatarUrl ?? null
  const displayName = getDisplayName(user)
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const stats = [
    { label: 'Boards', value: Object.keys(data.boards).length },
    { label: 'Lists', value: Object.keys(data.lists).length },
    { label: 'Cards', value: Object.keys(data.cards).length },
    { label: 'Inbox', value: data.inbox.length },
    { label: 'Posts', value: socialPosts.length },
  ]

  /** Both actions change the account, so both refetch `/auth/me` when done. */
  const refreshAccount = () => queryClient.invalidateQueries({ queryKey: meQueryKey })

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      setError(`"${file.name}" is ${formatSize(file.size)} — profile pictures are capped at ${formatSize(MAX_AVATAR_BYTES)}.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await uploadAvatar(file)
      await refreshAccount()
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not upload that picture. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError(null)
    try {
      await removeAvatar()
      await refreshAccount()
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not remove your profile picture.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scroll-slim mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Settings</h1>
      <p className="mt-1 text-sm text-text-secondary">Preferences for this workspace and your account.</p>

      <div className="mt-4 space-y-4 sm:mt-6">
        <Section title="Profile" description="Your picture is stored on Cloudinary and shown next to your boards and posts.">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName ? `${displayName}'s profile picture` : 'Profile picture'}
                className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-alt text-[17px] font-semibold text-text-secondary"
              >
                {initials || '—'}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-text-primary">
                {displayName || 'Your account'}
              </p>
              {user?.email && (
                <p className="truncate text-[12px] text-text-secondary">{user.email}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={13} />
                  {busy ? 'Uploading…' : avatarUrl ? 'Replace picture' : 'Upload picture'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => void handleRemove()}
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            aria-label="Upload profile picture"
            onChange={(e) => {
              void handleUpload(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          {error && (
            <p className="animate-in mt-3 flex items-center gap-1.5 rounded-md bg-danger-subtle px-3 py-2 text-xs font-medium text-danger-text">
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </p>
          )}
        </Section>

        <Section title="Storage" description="Your boards, cards, and scheduled posts are kept in this browser.">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-chip bg-surface-alt px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">{stat.label}</dt>
                <dd className="font-mono text-[15px] font-semibold text-text-primary">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Monitor size={13} />
            Signing out keeps this data here. Clear your browser storage to remove it.
          </p>
        </Section>
      </div>
    </div>
  )
}