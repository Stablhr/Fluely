'use client'

import { useState } from 'react'
import { Check, Circle, LogOut, Mail } from 'lucide-react'
import { changePassword } from '@/lib/api/authApi'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { useMeQuery } from '@/lib/hooks/auth/useMeQuery'
import { useSignOut } from '@/lib/hooks/auth/useSignOut'
import { useToast } from '@/components/kali/shared/useToastState'
import {
  SettingsCard,
  settingsInputClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from './controls'

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'A special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

/** The API answers a wrong password with the sign-in code, whose stock copy mentions email/phone. */
export function passwordErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && (err as { code?: string }).code === 'INVALID_CREDENTIALS') {
    return 'That password is incorrect.'
  }
  return getFriendlyErrorMessage(err, fallback)
}

function ChangePasswordCard() {
  const { toast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rulesMet = RULES.every((r) => r.test(next))
  const matches = next.length > 0 && next === confirm
  const canSubmit = current.length > 0 && rulesMet && matches && !saving

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await changePassword({ currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      toast('Password updated', 'success')
    } catch (err) {
      setError(passwordErrorMessage(err, 'Could not change your password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <SettingsCard
        title="Password"
        description="Use a strong password you don't use anywhere else."
        footer={
          <button type="submit" disabled={!canSubmit} className={settingsPrimaryButtonClass}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        }
      >
        <div className="grid gap-3 sm:max-w-md">
          <div>
            <label htmlFor="pw-current" className="mb-1 block text-[12px] font-medium text-text-secondary">
              Current password
            </label>
            <input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={settingsInputClass}
            />
          </div>
          <div>
            <label htmlFor="pw-new" className="mb-1 block text-[12px] font-medium text-text-secondary">
              New password
            </label>
            <input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={settingsInputClass}
              aria-describedby="pw-rules"
            />
            <ul id="pw-rules" className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {RULES.map((rule) => {
                const ok = rule.test(next)
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-[12px] transition-colors duration-200 ${
                      ok ? 'text-success-text' : 'text-text-muted'
                    }`}
                  >
                    {ok ? <Check size={12} /> : <Circle size={10} />}
                    {rule.label}
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-1 block text-[12px] font-medium text-text-secondary">
              Confirm new password
            </label>
            <input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={settingsInputClass}
            />
            {confirm.length > 0 && !matches && (
              <p className="mt-1 text-[12px] text-danger-text">Passwords don&apos;t match.</p>
            )}
          </div>
          {error && (
            <p role="alert" className="animate-in rounded-md bg-danger-subtle px-3 py-2 text-[12px] font-medium text-danger-text">
              {error}
            </p>
          )}
        </div>
      </SettingsCard>
    </form>
  )
}

export default function AccountSection() {
  const { data: me } = useMeQuery()
  const { signOut, isPending } = useSignOut()

  return (
    <div className="stagger grid max-w-[960px] grid-cols-1 gap-4">
      <SettingsCard title="Sign-in email" description="The address you sign in with and receive notifications at.">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-alt text-text-secondary">
            <Mail size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-text-primary">{me?.user.email ?? '—'}</p>
            <p className="text-[12px] text-text-muted">Changing your email isn&apos;t available yet.</p>
          </div>
        </div>
      </SettingsCard>

      <ChangePasswordCard />

      <SettingsCard
        title="Session"
        description="Changing your password doesn't sign out your other devices."
        footer={
          <button type="button" onClick={() => void signOut()} disabled={isPending} className={settingsSecondaryButtonClass}>
            <LogOut size={14} />
            {isPending ? 'Signing out…' : 'Sign out of this device'}
          </button>
        }
      >
        <p className="text-[13px] text-text-secondary">
          You&apos;re signed in on this browser. Sign out here when you&apos;re on a shared computer.
        </p>
      </SettingsCard>
    </div>
  )
}
