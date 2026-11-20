'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Unlink, Loader2, AlertTriangle, Info, BellRing, Plus } from 'lucide-react'
import {
  isReminderAccount,
  socialAccountsApi,
  type ConnectReturn,
  type PlatformSummary,
  type SocialAccount,
} from '@/lib/kali/api/social-accounts'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { PLATFORM_COLORS, type Platform } from '@/lib/kali/store/schema'
import Button from '../shared/Button'
import { useToast } from '../shared/useToastState'
import PlatformIcon from './PlatformIcon'

/**
 * Connected accounts for the workspace, one row per platform.
 *
 * "Connect" sends the browser through the platform's own sign-in and back to
 * the planner (`?social=connected|error`). A platform whose app keys are not
 * set on the server yet connects a demo account instead, so scheduling can be
 * tried end to end. Platforms in dry-run mode run every step except the final
 * post, which is simulated.
 */

const MODE_BADGE: Record<PlatformSummary['mode'], { label: string; className: string; title: string } | null> = {
  live: null,
  dryrun: {
    label: 'Dry run',
    className: 'bg-warning-bg text-warning-text',
    title: 'Posts are simulated until this platform approves the app',
  },
  disabled: null,
}

const STATUS_CLASS: Record<SocialAccount['status'], string> = {
  active: 'bg-success-bg text-success-text',
  expired: 'bg-warning-bg text-warning-text',
  revoked: 'bg-danger-bg text-danger-text',
  error: 'bg-danger-bg text-danger-text',
}

/** Query keys the platform's sign-in sends back (backend `accounts.service.ts`). */
const CONNECT_OUTCOME_PARAMS = ['social', 'platform', 'count', 'message'] as const

export default function AccountConnectionPanel({ returnTo = 'planner' }: { returnTo?: ConnectReturn }) {
  const { toast } = useToast()
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /** Platform whose "not set up yet" note is open. */
  const [setupFor, setSetupFor] = useState<Platform | null>(null)
  /** Platform whose "add a reminder account" form is open, and its name field. */
  const [reminderFor, setReminderFor] = useState<Platform | null>(null)
  const [reminderName, setReminderName] = useState('')

  const load = useCallback(async () => {
    try {
      const [summaries, rows] = await Promise.all([socialAccountsApi.platforms(), socialAccountsApi.list()])
      setPlatforms(summaries.filter((p) => p.mode !== 'disabled'))
      setAccounts(rows)
      setLoadError(null)
    } catch (error) {
      setLoadError(getFriendlyErrorMessage(error, 'Could not load connected accounts'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; state is set after the request
    void load()
  }, [load])

  // Back from a platform's sign-in: report the outcome once (after the
  // platform names have loaded), then drop those query keys -- keeping others,
  // like Settings' `?tab=` -- so a reload stays quiet.
  useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get('social')
    if (!outcome || platforms.length === 0) return
    const platform = url.searchParams.get('platform') as Platform | null
    const name = platforms.find((p) => p.platform === platform)?.label ?? 'the account'
    if (outcome === 'connected') {
      const count = Number(url.searchParams.get('count') ?? '1')
      toast(count > 1 ? `Connected ${count} ${name} accounts` : `Connected ${name}`, 'success', { duration: 6000 })
    } else {
      toast(url.searchParams.get('message') || `Could not connect ${name}`, 'error', { duration: 8000 })
    }
    for (const key of CONNECT_OUTCOME_PARAMS) url.searchParams.delete(key)
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [platforms, toast])

  async function connect(platform: PlatformSummary, demo = false) {
    // A real account needs the platform's app keys on the server; until then
    // explain that instead of starting a sign-in that cannot work.
    if (!demo && !platform.configured) {
      setSetupFor((open) => (open === platform.platform ? null : platform.platform))
      return
    }
    setBusy(platform.platform)
    try {
      const result = await socialAccountsApi.connect(platform.platform, returnTo, { demo })
      if (result.demo) {
        setSetupFor(null)
        toast(`Connected a demo ${platform.label} account`, 'success')
        await load()
        setBusy(null)
        return
      }
      // Leaves the app; the platform sends the browser back to the planner.
      window.location.assign(result.url)
    } catch (error) {
      toast(getFriendlyErrorMessage(error, `Could not connect ${platform.label}`), 'error')
      setBusy(null)
    }
  }

  async function addReminder(platform: PlatformSummary) {
    const name = reminderName.trim() || 'My personal profile'
    setBusy(`reminder:${platform.platform}`)
    try {
      await socialAccountsApi.addReminder(platform.platform, name)
      toast(`Added "${name}". At each post's time, Fluely reminds you to post it yourself.`, 'success', {
        duration: 6000,
      })
      setReminderFor(null)
      setReminderName('')
      await load()
      // Desktop notifications make reminders reach you in another tab.
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission().catch(() => {})
      }
    } catch (error) {
      toast(getFriendlyErrorMessage(error, 'Could not add the reminder account'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(account: SocialAccount, label: string) {
    if (!confirm(`Disconnect ${account.accountName}? Posts already scheduled to it will fail until it is reconnected.`)) {
      return
    }
    setBusy(account.id)
    try {
      await socialAccountsApi.delete(account.id)
      toast(`Disconnected ${account.accountName} (${label})`, 'success')
      await load()
    } catch (error) {
      toast(getFriendlyErrorMessage(error, 'Could not disconnect the account'), 'error')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    )
  }

  if (loadError) {
    return <p className="p-3 text-[13px] text-danger-text">{loadError}</p>
  }

  return (
    <div className="space-y-2">
      {platforms.map((platform) => {
        const rows = accounts.filter((a) => a.platform === platform.platform)
        // "Dry run" is shown only until a real account is connected; after
        // that the row is about that account, not the platform's test mode.
        const hasRealAccount = rows.some((a) => !a.demo && !isReminderAccount(a))
        const badge = hasRealAccount ? null : MODE_BADGE[platform.mode]
        return (
          <section key={platform.platform} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <PlatformIcon
                  platform={platform.platform}
                  size={16}
                  style={{ color: PLATFORM_COLORS[platform.platform] }}
                />
                <span className="text-[13px] font-semibold text-text-primary">{platform.label}</span>
                {badge && (
                  <span
                    title={badge.title}
                    className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
                {!platform.configured && (
                  <span className="whitespace-nowrap rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                    Not set up
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => connect(platform)}
                disabled={busy !== null}
                aria-label={`${rows.length > 0 ? 'Add' : 'Connect'} ${platform.label} account`}
                aria-expanded={platform.configured ? undefined : setupFor === platform.platform}
              >
                {busy === platform.platform ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                {rows.length > 0 ? 'Add' : 'Connect'}
              </Button>
            </div>

            {setupFor === platform.platform && (
              <div className="mt-2 flex gap-2 rounded-md border border-border bg-surface-alt px-3 py-2.5 text-[12px] leading-relaxed text-text-secondary">
                <Info size={14} className="mt-0.5 shrink-0 text-text-muted" />
                <div className="min-w-0 space-y-2">
                  <p>
                    Connecting a real {platform.label} account needs Fluely&apos;s {platform.label} app keys on the
                    server, which haven&apos;t been added yet. Whoever runs this workspace sets them up once
                    (see <code className="text-[11px]">docs/SOCIAL_SCHEDULING_SETUP.md</code>); after that, this
                    button opens {platform.label}&apos;s own sign-in.
                  </p>
                  <button
                    type="button"
                    onClick={() => connect(platform, true)}
                    disabled={busy !== null}
                    className="font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    Use a demo account for now
                  </button>
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {rows.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-alt px-2.5 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {account.profileImageUrl ? (
                        <img src={account.profileImageUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                      ) : null}
                      <span className="truncate text-[12px] text-text-primary">{account.accountName}</span>
                      {account.demo && (
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                          Demo
                        </span>
                      )}
                      {isReminderAccount(account) && (
                        <span
                          title="Fluely reminds you at the post's time; you post it yourself"
                          className="inline-flex items-center gap-0.5 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold text-warning-text"
                        >
                          <BellRing size={10} />
                          Reminder
                        </span>
                      )}
                      {account.status !== 'active' && (
                        <span
                          title={account.lastError}
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[account.status]}`}
                        >
                          <AlertTriangle size={10} />
                          {account.status === 'expired' ? 'Reconnect' : account.status}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => disconnect(account, platform.label)}
                      disabled={busy !== null}
                      aria-label={`Disconnect ${account.accountName}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-danger-bg hover:text-danger-text disabled:opacity-50"
                    >
                      {busy === account.id ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
                      Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {reminderFor === platform.platform ? (
              <form
                className="mt-2 space-y-2 rounded-md border border-border bg-surface-alt px-3 py-2.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  void addReminder(platform)
                }}
              >
                <p className="text-[12px] leading-relaxed text-text-secondary">
                  For an account Fluely can&apos;t post to for you
                  {platform.platform === 'facebook' ? ', like your personal profile (Facebook only lets apps post to Pages)' : ''}.
                  At the post&apos;s time you get a reminder with the caption ready to copy.
                </p>
                <div className="flex gap-2">
                  <input
                    value={reminderName}
                    onChange={(e) => setReminderName(e.target.value)}
                    placeholder="My personal profile"
                    aria-label={`Name for the ${platform.label} reminder account`}
                    maxLength={120}
                    autoFocus
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] text-text-primary"
                  />
                  <Button size="sm" variant="primary" type="submit" disabled={busy !== null}>
                    {busy === `reminder:${platform.platform}` ? <Loader2 size={12} className="animate-spin" /> : null}
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setReminderFor(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setReminderFor(platform.platform)
                  setReminderName('')
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-primary"
              >
                <Plus size={11} />
                Add a reminder account (you post it yourself)
              </button>
            )}
          </section>
        )
      })}
      <p className="px-1 pt-1 text-[11px] leading-relaxed text-text-muted">
        Accounts are shared with everyone in your workspace.
      </p>
    </div>
  )
}
