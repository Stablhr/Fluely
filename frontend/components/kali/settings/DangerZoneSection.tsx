'use client'

import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { deleteMyAccount } from '@/lib/api/profileApi'
import { useMeQuery } from '@/lib/hooks/auth/useMeQuery'
import { clearData } from '@/lib/kali/store/storage'
import Modal from '@/components/kali/shared/Modal'
import { passwordErrorMessage } from './AccountSection'
import {
  SettingsCard,
  settingsDangerButtonClass,
  settingsInputClass,
  settingsSecondaryButtonClass,
} from './controls'

const CONSEQUENCES = [
  'Boards you own, with their lists, cards, comments, and files',
  'Your profile, avatar, notifications, and mentions',
  'Your access to boards other people shared with you',
]

function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: me } = useMeQuery()
  const [password, setPassword] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = password.length > 0 && typed === 'DELETE' && !busy

  const close = () => {
    if (busy) return
    setPassword('')
    setTyped('')
    setError(null)
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canDelete) return
    setBusy(true)
    setError(null)
    try {
      await deleteMyAccount({ password })
      // Drop everything this browser cached for the account, then leave with a
      // full navigation so no in-memory state survives.
      clearData(me?.user.id)
      queryClient.clear()
      window.location.replace('/sign-in')
    } catch (err) {
      setError(passwordErrorMessage(err, 'Could not delete your account.'))
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} className="h-auto! max-w-md">
      <form onSubmit={submit} className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-danger-subtle text-danger-text">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h3 className="text-[16px] font-semibold text-text-primary">Delete your account?</h3>
            <p className="mt-1 text-[13px] text-text-secondary">This can&apos;t be undone. It permanently deletes:</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 pl-12 text-[13px] text-text-secondary">
          {CONSEQUENCES.map((c) => (
            <li key={c} className="list-disc">{c}</li>
          ))}
        </ul>
        <p className="mt-3 pl-12 text-[12px] text-text-muted">
          A workspace you own that has other members is handed to its longest-standing member.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="del-password" className="mb-1 block text-[12px] font-medium text-text-secondary">
              Your password
            </label>
            <input
              id="del-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={settingsInputClass}
            />
          </div>
          <div>
            <label htmlFor="del-confirm" className="mb-1 block text-[12px] font-medium text-text-secondary">
              Type <span className="font-mono font-semibold text-text-primary">DELETE</span> to confirm
            </label>
            <input
              id="del-confirm"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={settingsInputClass}
            />
          </div>
          {error && (
            <p role="alert" className="animate-in rounded-md bg-danger-subtle px-3 py-2 text-[12px] font-medium text-danger-text">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={close} disabled={busy} className={settingsSecondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={!canDelete} className={settingsDangerButtonClass}>
            <Trash2 size={14} />
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function DangerZoneSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className="stagger grid max-w-[960px] grid-cols-1 gap-4">
      <SettingsCard
        tone="danger"
        title="Delete account"
        description="Permanently remove your account and everything you own."
        footer={
          <button type="button" onClick={() => setOpen(true)} className={settingsDangerButtonClass}>
            <Trash2 size={14} />
            Delete account…
          </button>
        }
      >
        <p className="text-[13px] text-text-secondary">
          Boards you own are deleted for everyone on them. Comments and files you added to other
          people&apos;s boards stay with those boards.
        </p>
      </SettingsCard>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
