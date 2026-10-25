'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Trash2, Upload, User, Briefcase, Clock, Globe } from 'lucide-react'
import AvatarCropModal from './AvatarCropModal'
import { useQueryClient } from '@tanstack/react-query'
import { meQueryKey, useMeQuery } from '@/lib/hooks/auth/useMeQuery'
import { getDisplayName } from '@/lib/api/authApi'
import { MAX_AVATAR_BYTES, removeAvatar, uploadAvatar } from '@/lib/api/accountApi'
import {
  getMyProfile,
  updateMyProfile,
  checkUsernameAvailable,
  type MyProfile,
} from '@/lib/api/profileApi'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { formatSize } from '@/lib/kali/utils/format'
import { ProfileCard, colorFromId } from '@/components/kali/shared/ProfileCard'
import { useQuery } from '@tanstack/react-query'

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

const inputClass =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20'

const AVATAR_COLORS = [
  { label: 'Celtic Blue', value: '#3971b8' },
  { label: 'Tea Green', value: '#c8d69b' },
  { label: 'Vanilla', value: '#f6e6a5' },
  { label: 'Warm rose', value: '#ff8b5e' },
  { label: 'Lavender', value: '#8b7cf6' },
  { label: 'Mint', value: '#33b27a' },
]

const PRONOUNS_OPTIONS = ['', 'he/him', 'she/her', 'they/them', 'custom']
const ACCENT_SWATCHES = ['#3971b8', '#c8d69b', '#f6e6a5', '#ff8b5e', '#8b7cf6', '#33b27a', '#ff5e6c']

export default function SettingsView() {
  const { data: me } = useMeQuery()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)

  // Profile data (loaded from /account/me/profile)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: getMyProfile,
    staleTime: 30_000,
  })

  // Editable draft
  const [draft, setDraft] = useState<Partial<MyProfile>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Username availability check
  const [usernameQuery, setUsernameQuery] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  // Initialize draft from profile
  useEffect(() => {
    if (profile) {
      setDraft({
        displayName: profile.displayName ?? '',
        username: profile.username ?? '',
        jobTitle: profile.jobTitle ?? '',
        bio: profile.bio ?? '',
        pronouns: profile.pronouns ?? '',
        timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        accentColor: profile.accentColor ?? '#3971b8',
        avatarColor: profile.avatarColor ?? colorFromId(profile.id ?? user?.id ?? 'you'),
        phone: profile.phone ?? '',
        profileVisibility: profile.profileVisibility ?? { email: 'me', phone: 'me', others: 'boards' },
      })
      setUsernameQuery(profile.username ?? '')
    }
  }, [profile])

  // Debounced username availability check
  useEffect(() => {
    const u = usernameQuery.trim().toLowerCase()
    if (!u || u === (profile?.username ?? '')) {
      setUsernameAvailable(null)
      return
    }
    if (!/^[a-z0-9_.]{3,24}$/.test(u)) {
      setUsernameAvailable(null)
      return
    }
    setCheckingUsername(true)
    const t = setTimeout(async () => {
      try {
        const avail = await checkUsernameAvailable(u)
        setUsernameAvailable(avail)
      } catch {
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [usernameQuery, profile])

  const setField = (key: keyof MyProfile, value: any) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
    setSaveMessage(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const patch: Record<string, unknown> = {}
      if (draft.displayName !== (profile?.displayName ?? '')) patch.displayName = draft.displayName?.trim() || null
      if (draft.username !== (profile?.username ?? '')) patch.username = draft.username?.trim() || null
      if (draft.jobTitle !== (profile?.jobTitle ?? '')) patch.jobTitle = draft.jobTitle?.trim() || null
      if (draft.bio !== (profile?.bio ?? '')) patch.bio = draft.bio?.trim() || null
      if (draft.pronouns !== (profile?.pronouns ?? '')) patch.pronouns = draft.pronouns?.trim() || null
      if (draft.timezone !== (profile?.timezone ?? '')) patch.timezone = draft.timezone || null
      if (draft.accentColor !== (profile?.accentColor ?? '')) patch.accentColor = draft.accentColor
      if (draft.avatarColor !== (profile?.avatarColor ?? '')) patch.avatarColor = draft.avatarColor
      if (draft.phone !== (profile?.phone ?? '')) patch.phone = draft.phone?.trim() || null
      if (JSON.stringify(draft.profileVisibility) !== JSON.stringify(profile?.profileVisibility)) {
        patch.profileVisibility = draft.profileVisibility
      }
      await updateMyProfile(patch)
      queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      setDirty(false)
      setSaveMessage('Saved.')
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (profile) {
      setDraft({
        displayName: profile.displayName ?? '',
        username: profile.username ?? '',
        jobTitle: profile.jobTitle ?? '',
        bio: profile.bio ?? '',
        pronouns: profile.pronouns ?? '',
        timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        accentColor: profile.accentColor ?? '#3971b8',
        avatarColor: profile.avatarColor ?? colorFromId(profile.id ?? user?.id ?? 'you'),
        phone: profile.phone ?? '',
        profileVisibility: profile.profileVisibility ?? { email: 'me', phone: 'me', others: 'boards' },
      })
      setUsernameQuery(profile.username ?? '')
    }
    setDirty(false)
    setSaveMessage(null)
  }

  const handleUpload = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_AVATAR_BYTES) {
      setError(`"${file.name}" is ${formatSize(file.size)} — profile pictures are capped at ${formatSize(MAX_AVATAR_BYTES)}.`)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are allowed.')
      return
    }
    setError(null)
    setCropFile(file)
  }

  const handleCroppedUpload = async (blob: Blob) => {
    setCropFile(null)
    setBusy(true)
    setError(null)
    try {
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      await uploadAvatar(file)
      queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      queryClient.invalidateQueries({ queryKey: meQueryKey })
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not upload that picture. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setBusy(true)
    setError(null)
    try {
      await removeAvatar()
      queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      queryClient.invalidateQueries({ queryKey: meQueryKey })
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not remove your profile picture.'))
    } finally {
      setBusy(false)
    }
  }

  const user = me?.user
  const displayName = getDisplayName(user)
  const avatarUrl = profile?.avatarUrl ?? user?.avatarUrl ?? null
  const avatarColor = draft.avatarColor ?? profile?.avatarColor ?? colorFromId(profile?.id ?? user?.id ?? 'you')
  const accentColor = draft.accentColor ?? profile?.accentColor ?? '#3971b8'

  // Dirty-state navigation guard
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const previewProfile: any = {
    id: profile?.id ?? user?.id ?? 'you',
    displayName: (draft.displayName ?? profile?.displayName ?? displayName).trim() || displayName,
    username: (draft.username ?? profile?.username) || null,
    avatarUrl,
    avatarColor,
    accentColor,
    jobTitle: (draft.jobTitle ?? profile?.jobTitle) || null,
    bio: (draft.bio ?? profile?.bio) || null,
    pronouns: (draft.pronouns ?? profile?.pronouns) || null,
    timezone: (draft.timezone ?? profile?.timezone) || null,
    email: profile?.email ?? user?.email ?? null,
    phone: (draft.phone ?? profile?.phone) || null,
    createdAt: profile?.createdAt ?? new Date().toISOString(),
  }

  const localTime = useMemo(() => {
    const tz = draft.timezone ?? profile?.timezone
    if (!tz) return null
    try {
      return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date())
    } catch {
      return null
    }
  }, [draft.timezone, profile?.timezone])

  return (
    <>
    <div className="scroll-slim mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Settings</h1>
      <p className="mt-1 text-sm text-text-secondary">Preferences for this workspace and your account.</p>

      <div className="mt-4 space-y-4 sm:mt-6">
        {/* Picture */}
        <Section title="Profile picture" description="This is how you appear to people you collaborate with.">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full border border-border object-cover shadow-subtle" />
              ) : (
                <span
                  className="flex h-20 w-20 items-center justify-center rounded-full text-[20px] font-semibold text-white shadow-subtle"
                  style={{ background: avatarColor }}
                >
                  {displayName.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass} disabled={busy} onClick={() => fileRef.current?.click()}>
                    <Upload size={13} />
                    {busy ? 'Uploading…' : avatarUrl ? 'Replace picture' : 'Upload picture'}
                  </button>
                  {avatarUrl && (
                    <button type="button" className={buttonClass} disabled={busy} onClick={() => void handleRemoveAvatar()}>
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-text-muted">JPG, PNG, or WebP, up to 5 MB.</p>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">Initials color</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setField('avatarColor', c.value)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform duration-150 ${draft.avatarColor === c.value ? 'scale-110 border-text-primary' : 'border-border hover:scale-105'}`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
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

        {/* Name */}
        <Section title="Name" description="How you appear to collaborators.">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Display name
              </label>
              <input
                type="text"
                value={draft.displayName ?? ''}
                onChange={(e) => setField('displayName', e.target.value)}
                maxLength={50}
                className={inputClass}
                placeholder="Your name"
              />
              <p className="mt-1 text-[11px] text-text-muted">
                2–50 characters. Updates live across the app.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Username / handle
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">@</span>
                <input
                  type="text"
                  value={draft.username ?? ''}
                  onChange={(e) => {
                    setField('username', e.target.value)
                    setUsernameQuery(e.target.value)
                  }}
                  maxLength={24}
                  className={`${inputClass} pl-7`}
                  placeholder="handle"
                />
              </div>
              <p className="mt-1 text-[11px] text-text-muted">
                3–24 chars: lowercase letters, numbers, underscore, dot. Shown in the mention picker.
              </p>
              {checkingUsername && <p className="mt-1 text-[11px] text-text-muted">Checking availability…</p>}
              {!checkingUsername && usernameAvailable === true && (
                <p className="mt-1 text-[11px] text-success-text">Username is available.</p>
              )}
              {!checkingUsername && usernameAvailable === false && (
                <p className="mt-1 text-[11px] text-danger-text">That username is already taken.</p>
              )}
            </div>
          </div>
        </Section>

        {/* About you */}
        <Section title="About you" description="Optional details collaborators can see.">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Job title
              </label>
              <input
                type="text"
                value={draft.jobTitle ?? ''}
                onChange={(e) => setField('jobTitle', e.target.value)}
                maxLength={60}
                className={inputClass}
                placeholder="Social Media Manager"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Bio
              </label>
              <textarea
                value={draft.bio ?? ''}
                onChange={(e) => setField('bio', e.target.value)}
                maxLength={160}
                rows={3}
                className={inputClass}
              />
              <p className="mt-1 text-right text-[11px] text-text-muted">
                {(draft.bio ?? '').length}/160
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Pronouns
              </label>
              <select
                value={PRONOUNS_OPTIONS.includes(draft.pronouns ?? '') ? (draft.pronouns ?? '') : 'custom'}
                onChange={(e) => setField('pronouns', e.target.value === 'custom' ? '' : e.target.value)}
                className={inputClass}
              >
                {PRONOUNS_OPTIONS.map((p) => (
                  <option key={p || 'none'} value={p}>
                    {p || 'None'}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {(draft.pronouns === '' || !PRONOUNS_OPTIONS.includes(draft.pronouns ?? '')) && (
                <input
                  type="text"
                  value={draft.pronouns ?? ''}
                  onChange={(e) => setField('pronouns', e.target.value)}
                  maxLength={30}
                  className={`${inputClass} mt-2`}
                  placeholder="e.g. she/her"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Time zone
              </label>
              <select
                value={draft.timezone ?? ''}
                onChange={(e) => setField('timezone', e.target.value)}
                className={inputClass}
              >
                <option value="">Use browser default</option>
                {Intl.supportedValuesOf('timeZone').map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')} ({new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date())})
                  </option>
                ))}
              </select>
              {localTime && (
                <p className="mt-1 text-[11px] text-text-muted">Your local time: {localTime}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Accent color
              </label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setField('accentColor', c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform duration-150 ${draft.accentColor === c ? 'scale-110 border-text-primary' : 'border-border hover:scale-105'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Contact & visibility */}
        <Section title="Contact & visibility" description="Control what collaborators can see.">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Email
              </label>
              <input type="email" value={me?.user?.email ?? ''} readOnly className={`${inputClass} opacity-70`} />
              <p className="mt-1 text-[11px] text-text-muted">Email changes require verification — coming soon.</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => setField('phone', e.target.value)}
                maxLength={40}
                className={inputClass}
                placeholder="+1 555 0100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Who can see your email
              </label>
              <select
                value={draft.profileVisibility?.email ?? 'me'}
                onChange={(e) =>
                  setField('profileVisibility', { ...(draft.profileVisibility ?? {}), email: e.target.value as 'me' | 'boards' })
                }
                className={inputClass}
              >
                <option value="me">Only me</option>
                <option value="boards">People on my boards</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                Who can see your phone
              </label>
              <select
                value={draft.profileVisibility?.phone ?? 'me'}
                onChange={(e) =>
                  setField('profileVisibility', { ...(draft.profileVisibility ?? {}), phone: e.target.value as 'me' | 'boards' })
                }
                className={inputClass}
              >
                <option value="me">Only me</option>
                <option value="boards">People on my boards</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Live preview */}
        <Section title="Preview" description="This is how collaborators see your profile.">
          <ProfileCard profile={previewProfile} />
        </Section>
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-2 rounded-card border border-border-strong bg-surface-elevated px-4 py-3 shadow-medium">
          <span className="text-[12px] text-text-secondary">You have unsaved changes.</span>
          <div className="flex gap-2">
            <button type="button" className={buttonClass} onClick={handleDiscard}>
              Discard
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
              onClick={() => void handleSave()}
              disabled={saving || (usernameAvailable === false)}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
      {saveMessage && !dirty && (
        <p className="mt-2 text-center text-[12px] text-success-text">{saveMessage}</p>
      )}
    </div>

    {cropFile && (
      <AvatarCropModal
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onConfirm={(blob) => void handleCroppedUpload(blob)}
      />
    )}
    </>
  )
}
