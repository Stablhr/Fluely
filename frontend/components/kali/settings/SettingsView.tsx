'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Trash2, Upload, User, Briefcase, Clock, Globe, Lock, Palette, Bell, Shield } from 'lucide-react'
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
import { ProfileCard } from '@/components/kali/shared/ProfileCard'
import Modal from '@/components/kali/shared/Modal'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/components/kali/shared/useToastState'
import { avatarDisplayUrl, colorFromId } from '@/components/kali/shared/Avatar'
import { useStore } from '@/lib/kali/store/useStore'
import { YOU_ID } from '@/lib/kali/store/schema'

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

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, description: 'How you appear to collaborators.' },
  { id: 'account', label: 'Account & Security', icon: Lock, description: 'Password, sessions, and account access.' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, density, and motion.' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'In-app and email alerts.' },
  { id: 'sharing', label: 'Sharing & Privacy', icon: Shield, description: 'Default visibility and privacy.' },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, description: 'Destructive actions.' },
] as const

type TabId = (typeof SECTIONS)[number]['id']

export default function SettingsView() {
  const { data: me } = useMeQuery()
  const queryClient = useQueryClient()
  const store = useStore()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tab, setTabState] = useState<TabId>('profile')
  const setTab = (t: TabId) => {
    setTabState(t)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', t)
      window.history.replaceState({}, '', url.toString())
    }
  }
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab') as TabId | null
    if (t && SECTIONS.some((s) => s.id === t)) setTabState(t)
  }, [])

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: getMyProfile,
    staleTime: 30_000,
  })

  const [draft, setDraft] = useState<Partial<MyProfile>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)

  const [usernameQuery, setUsernameQuery] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

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
        avatarColor: profile.avatarColor ?? colorFromId(profile.id ?? me?.user?.id ?? 'you'),
        phone: profile.phone ?? '',
        profileVisibility: profile.profileVisibility ?? { email: 'me', phone: 'me', others: 'boards' },
      })
      setUsernameQuery(profile.username ?? '')
    }
  }, [profile, me?.user?.id])

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
      queryClient.invalidateQueries({ queryKey: meQueryKey })
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
        avatarColor: profile.avatarColor ?? colorFromId(profile.id ?? me?.user?.id ?? 'you'),
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
      setError(`"${file.name}" is ${formatSize(file.size)} - profile pictures are capped at ${formatSize(MAX_AVATAR_BYTES)}.`)
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
    setUploadStatus('preparing')
    setUploadProgress(0)
    setUploadError(null)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller

    // Timeout guard: never leave the avatar stuck loading.
    if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current)
    uploadTimerRef.current = setTimeout(() => {
      controller.abort()
      setUploadStatus('error')
      setUploadError('Upload timed out. Please try again.')
      toast('Upload timed out. Please try again.', 'error')
    }, 60_000)

    try {
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      setUploadStatus('uploading')
      const res = await uploadAvatar(file, (pct) => {
        setUploadProgress(pct)
        if (pct >= 100) setUploadStatus('processing')
      }, controller.signal)
      // Preload the new image before swapping to avoid a blank flash.
      if (res.avatarUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = res.avatarUrl as string
        })
      }
      queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      queryClient.invalidateQueries({ queryKey: meQueryKey })
      store.setCurrentUser({ avatarUrl: res.avatarUrl ?? null })
      setImgFailed(false)
      setUploadStatus('done')
      toast('Profile photo updated.', 'success')
      setTimeout(() => setUploadStatus('idle'), 1500)
    } catch (err) {
      if (controller.signal.aborted) {
        // handled by timeout or manual cancel
      } else {
        const msg = getFriendlyErrorMessage(err, 'Could not upload that picture. Please try again.')
        setUploadError(msg)
        setUploadStatus('error')
        toast(msg, 'error')
      }
    } finally {
      if (uploadTimerRef.current) {
        clearTimeout(uploadTimerRef.current)
        uploadTimerRef.current = null
      }
      abortRef.current = null
    }
  }

  const handleRemoveAvatar = async () => {
    setUploadStatus('processing')
    setUploadError(null)
    setError(null)
    try {
      await removeAvatar()
      queryClient.invalidateQueries({ queryKey: ['myProfile'] })
      queryClient.invalidateQueries({ queryKey: meQueryKey })
      store.setCurrentUser({ avatarUrl: null })
      setImgFailed(true)
      setUploadStatus('done')
      toast('Profile photo removed.', 'success')
      setTimeout(() => setUploadStatus('idle'), 1500)
    } catch (err) {
      const msg = getFriendlyErrorMessage(err, 'Could not remove your profile picture.')
      setUploadError(msg)
      setUploadStatus('error')
      toast(msg, 'error')
    }
  }

  const user = me?.user
  const displayName = getDisplayName(user)
  const avatarUrl = profile?.avatarUrl ?? user?.avatarUrl ?? null
  const avatarColor = draft.avatarColor ?? profile?.avatarColor ?? colorFromId(profile?.id ?? user?.id ?? 'you')
  const accentColor = draft.accentColor ?? profile?.accentColor ?? '#3971b8'

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const pronounsValue = draft.pronouns ?? ''
  const pronounsIsPreset = PRONOUNS_OPTIONS.includes(pronounsValue) && pronounsValue !== 'custom'
  const pronounsSelectValue = pronounsIsPreset ? pronounsValue : (pronounsValue === '' ? '' : 'custom')

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
    email: (draft.profileVisibility?.email === 'boards') ? (profile?.email ?? user?.email ?? null) : null,
    phone: (draft.profileVisibility?.phone === 'boards') ? ((draft.phone ?? profile?.phone) || null) : null,
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

  const activeSection = SECTIONS.find((s) => s.id === tab)!

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-surface px-6 py-3 lg:px-8">
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        <p className="text-xs text-text-secondary">Preferences for this workspace and your account.</p>
      </header>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:hidden">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const active = tab === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setTab(s.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                active ? 'bg-primary-subtle text-primary-hover' : 'bg-surface-alt text-text-secondary'
              }`}
            >
              <Icon size={13} />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[240px] shrink-0 overflow-y-auto border-r border-border bg-surface p-3 lg:flex lg:flex-col gap-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const active = tab === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-primary-subtle text-primary-hover'
                    : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                )}
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{activeSection.label}</h2>
                <p className="text-[12px] text-text-muted">{activeSection.description}</p>
              </div>
            </div>

            {tab === 'profile' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
                {/* Identity */}
                <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5 lg:col-start-1 lg:row-start-1">
                  <h2 className="text-[15px] font-semibold text-text-primary">Identity</h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">How you appear to collaborators.</p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex flex-col items-center gap-2 sm:w-[110px]">
                      <div className="group relative h-24 w-24 cursor-pointer" onClick={() => { if (uploadStatus === "idle" || uploadStatus === "done" || uploadStatus === "error") fileRef.current?.click() }} onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2","ring-primary") }} onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2","ring-primary") }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("ring-2","ring-primary"); const f = e.dataTransfer.files?.[0]; if (f) void handleUpload(f) }}>
                        {avatarUrl && !imgFailed ? (
                          <img
                            key={avatarUrl}
                            src={avatarDisplayUrl(avatarUrl, 192) ?? avatarUrl}
                            alt="Avatar"
                            className="h-24 w-24 rounded-full border border-border object-cover object-center shadow-subtle"
                            onError={() => setImgFailed(true)}
                          />
                        ) : (
                          <span
                            className="flex h-24 w-24 items-center justify-center rounded-full text-[22px] font-semibold text-white shadow-subtle"
                            style={{ background: avatarColor }}
                          >
                            {displayName.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'}
                          </span>
                        )}
                        {(uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'preparing') && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.25)" strokeWidth="4" fill="none" />
                              <circle
                                cx="32" cy="32" r="28"
                                stroke="#ffffff" strokeWidth="4" fill="none"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={uploadStatus === 'uploading' ? (2 * Math.PI * 28) * (1 - uploadProgress / 100) : 2 * Math.PI * 28 * 0.25}
                                className={uploadStatus !== 'uploading' ? 'animate-spin' : ''}
                                style={{ transformOrigin: 'center' }}
                              />
                            </svg>
                            <span className="absolute text-[10px] font-semibold text-white">
                              {uploadStatus === 'preparing' ? '...' : uploadStatus === 'processing' ? '...' : `${uploadProgress}%`}
                            </span>
                          </div>
                        )}
                        {uploadStatus === 'done' && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-success/40">
                            <span className="text-white text-xl">✓</span>
                          </div>
                        )}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                        <Upload size={20} className="text-white" />
                      </div>
                      </div>
                      {uploadStatus === 'error' && uploadError && (
                        <p className="mt-1 text-center text-[11px] text-danger-text">{uploadError}</p>
                      )}
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={uploadStatus !== 'idle' && uploadStatus !== 'done' && uploadStatus !== 'error'}
                          onClick={() => fileRef.current?.click()}
                        >
                          <Upload size={13} />
                          {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'processing' ? 'Processing...' : avatarUrl ? 'Replace' : 'Upload'}
                        </button>
                        {avatarUrl && (
                          <button
                            type="button"
                            className={buttonClass}
                            disabled={uploadStatus !== 'idle' && uploadStatus !== 'done' && uploadStatus !== 'error'}
                            onClick={() => void handleRemoveAvatar()}
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        )}
                        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() => { abortRef.current?.abort(); setUploadStatus('idle'); setUploadError(null) }}
                          >
                            Cancel
                          </button>
                        )}
                        {uploadStatus === 'error' && (
                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() => { setUploadStatus('idle'); setUploadError(null); fileRef.current?.click() }}
                          >
                            Try again
                          </button>
                        )}
                      </div>
                      <p className="text-center text-[11px] text-text-muted">JPG, PNG, or WebP up to 5 MB.</p>
                      <div aria-live="polite" className="sr-only">
                        {uploadStatus === 'uploading' && `Uploading your photo ${uploadProgress} percent`}
                        {uploadStatus === 'processing' && 'Processing your photo'}
                        {uploadStatus === 'done' && 'Profile photo updated'}
                        {uploadStatus === 'error' && (uploadError ?? 'Upload failed')}
                      </div>
                      {!avatarUrl && (
                        <div className="mt-1 w-full">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">Initials color</p>
                          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                            {AVATAR_COLORS.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                title={c.label}
                                aria-label={c.label}
                                onClick={() => setField('avatarColor', c.value)}
                                className={`h-7 w-7 rounded-full border-2 transition-transform duration-150 ${draft.avatarColor === c.value ? 'scale-110 border-text-primary ring-2 ring-primary/30' : 'border-border hover:scale-105'}`}
                                style={{ background: c.value }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                            aria-describedby="dn-help"
                          />
                          <p id="dn-help" className="mt-1 text-[11px] text-text-muted">2-50 characters. Updates live across the app.</p>
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
                              aria-describedby="un-help"
                            />
                          </div>
                          <p id="un-help" className="mt-1 text-[11px] text-text-muted">3-24 chars: lowercase, numbers, underscore, dot. Shown in the mention picker.</p>
                          {checkingUsername && <p className="mt-1 text-[11px] text-text-muted">Checking availability...</p>}
                          {!checkingUsername && usernameAvailable === true && (
                            <p className="mt-1 text-[11px] text-success-text">Available.</p>
                          )}
                          {!checkingUsername && usernameAvailable === false && (
                            <p className="mt-1 text-[11px] text-danger-text">Taken.</p>
                          )}
                        </div>
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
                              aria-label={`Accent color ${c}`}
                              onClick={() => setField('accentColor', c)}
                              className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${draft.accentColor === c ? 'scale-110 border-text-primary ring-2 ring-primary/30' : 'border-border hover:scale-105'}`}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
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
                </section>

                {/* Preview (mobile: right after identity; desktop: right column sticky) */}
                <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4">
                  <h2 className="text-[15px] font-semibold text-text-primary">Preview</h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">This is how collaborators see your profile.</p>
                  <p className="mt-1 text-[11px] text-text-muted">Previewing as: a collaborator</p>
                  <div className="mt-4">
                    <ProfileCard profile={previewProfile} />
                  </div>
                </section>

                {/* About you */}
                <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5 lg:col-start-1 lg:row-start-2">
                  <h2 className="text-[15px] font-semibold text-text-primary">About you</h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">Optional details collaborators can see.</p>
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          Pronouns
                        </label>
                        <select
                          value={pronounsSelectValue}
                          onChange={(e) => {
                            if (e.target.value === 'custom') {
                              setField('pronouns', '')
                            } else {
                              setField('pronouns', e.target.value)
                            }
                          }}
                          className={inputClass}
                        >
                          <option value="">None</option>
                          <option value="he/him">he/him</option>
                          <option value="she/her">she/her</option>
                          <option value="they/them">they/them</option>
                          <option value="custom">Custom...</option>
                        </select>
                        {pronounsSelectValue === 'custom' && (
                          <input
                            type="text"
                            value={pronounsValue}
                            onChange={(e) => setField('pronouns', e.target.value)}
                            maxLength={30}
                            className={`${inputClass} mt-2`}
                            placeholder="e.g. she/her"
                          />
                        )}
                      </div>
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
                        className={`${inputClass} resize-y`}
                      />
                      <p className="mt-1 text-right text-[11px] text-text-muted">
                        {(draft.bio ?? '').length}/160
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                              {tz.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                        {localTime && (
                          <p className="mt-1 text-[11px] text-text-muted">Your local time: {localTime}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Contact & visibility */}
                <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5 lg:col-start-1 lg:row-start-3">
                  <h2 className="text-[15px] font-semibold text-text-primary">Contact & visibility</h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">Only the fields you share appear on your profile card.</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                        Email
                      </label>
                      <input type="email" value={me?.user?.email ?? ''} readOnly className={`${inputClass} opacity-70`} />
                      <p className="mt-1 text-[11px] text-text-muted">Email changes require verification - coming soon.</p>
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
                </section>
              </div>
            )}

            {tab === 'account' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 max-w-[1600px]">
                <Section title="Password" description="Change your password via the reset flow.">
                  <p className="text-[13px] text-text-secondary">
                    Use the &quot;Forgot password&quot; link on the sign-in page to reset your password.
                  </p>
                </Section>
                <Section title="Active sessions" description="Devices currently signed in.">
                  <p className="text-[13px] text-text-muted">Session management is not available yet.</p>
                </Section>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 max-w-[1600px]">
                <Section title="Theme" description="Follows your system preference.">
                  <p className="text-[13px] text-text-muted">Light / dark theme switching is not available yet.</p>
                </Section>
                <Section title="Density" description="Compact or comfortable spacing.">
                  <p className="text-[13px] text-text-muted">Density options are not available yet.</p>
                </Section>
                <Section title="Motion" description="Reduce animations.">
                  <p className="text-[13px] text-text-muted">Motion options are not available yet.</p>
                </Section>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 max-w-[1600px]">
                <Section title="In-app" description="Notifications shown in the app.">
                  <ul className="divide-y divide-border">
                    {['Mentions', 'Invitations', 'Card moves'].map((label) => (
                      <li key={label} className="flex items-center justify-between py-2.5">
                        <span className="text-[13px] text-text-primary">{label}</span>
                        <span className="text-[11px] text-text-muted">On</span>
                      </li>
                    ))}
                  </ul>
                </Section>
                <Section title="Email" description="Email digests and alerts.">
                  <ul className="divide-y divide-border">
                    {['Weekly digest', 'Mentions', 'Invitations'].map((label) => (
                      <li key={label} className="flex items-center justify-between py-2.5">
                        <span className="text-[13px] text-text-primary">{label}</span>
                        <span className="text-[11px] text-text-muted">On</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            )}

            {tab === 'sharing' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 max-w-[1600px]">
                <Section title="Default visibility" description="Who can see your new boards by default.">
                  <p className="text-[13px] text-text-muted">Default visibility options are not available yet.</p>
                </Section>
                <Section title="Privacy" description="Control what is shared with collaborators.">
                  <p className="text-[13px] text-text-muted">Additional privacy controls are not available yet.</p>
                </Section>
              </div>
            )}

            {tab === 'danger' && (
              <div className="grid grid-cols-1 gap-4 max-w-[1600px]">
                <Section title="Delete account" description="Permanently remove your account and all data.">
                  <p className="text-[13px] text-text-muted">Account deletion is not available yet. Contact support.</p>
                </Section>
              </div>
            )}
          </div>

          {/* Sticky save bar */}
          {dirty && (
            <div className="shrink-0 border-t border-border bg-surface-elevated/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-text-secondary">You have unsaved changes.</span>
                <div className="flex gap-2">
                  <button type="button" className={buttonClass} onClick={handleDiscard}>
                    Discard
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
                    onClick={() => void handleSave()}
                    disabled={saving || usernameAvailable === false}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {saveMessage && !dirty && (
            <p className="px-4 pb-2 text-center text-[12px] text-success-text">{saveMessage}</p>
          )}
        </div>
      </div>

      <Modal open={confirmSaveOpen} onClose={() => setConfirmSaveOpen(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-text-primary">Save profile changes?</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Saving will update your profile and make it visible to collaborators on your boards. You can review the live preview on the right before confirming.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setConfirmSaveOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => { handleDiscard(); setConfirmSaveOpen(false) }}
            >
              Discard
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
              disabled={saving || usernameAvailable === false}
              onClick={() => { setConfirmSaveOpen(false); void handleSave() }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </Modal>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => void handleCroppedUpload(blob)}
        />
      )}
    </div>
  )
}
