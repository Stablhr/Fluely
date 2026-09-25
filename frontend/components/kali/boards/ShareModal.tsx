'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  UserPlus,
  Link2,
  Copy,
  Check,
  Lock,
  ChevronDown,
} from 'lucide-react'
import type { Board, ShareRole } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'
import Avatar from '../shared/Avatar'

const ROLE_OPTIONS: ShareRole[] = ['admin', 'member', 'observer']

const ROLE_LABELS: Record<ShareRole, string> = {
  admin: 'Admin',
  member: 'Member',
  observer: 'Observer',
}

const ROLE_DESCRIPTIONS: Record<ShareRole, string> = {
  admin: 'Full control over the board, including managing members.',
  member: 'Can edit cards, lists, and board content.',
  observer: 'View only — cannot make changes.',
}

export default function ShareModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const { addShare, removeShare, updateShareRole, members, createShareLink } = useStore()

  const currentUser = members.find((m) => m.name === 'You') ?? members[0]

  const [name, setName] = useState('')
  const [role, setRole] = useState<ShareRole>('member')
  const [linkCopied, setLinkCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members')
  const [openPermId, setOpenPermId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const permRef = useRef<HTMLDivElement>(null)

  const shares = board.shares ?? []

  useEffect(() => {
    if (!openPermId) return
    const handler = (e: MouseEvent) => {
      if (permRef.current && !permRef.current.contains(e.target as Node)) {
        setOpenPermId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPermId])

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setErrorMsg('Please enter a name or email.')
      return
    }
    if (shares.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('This person is already a member of this board.')
      return
    }
    addShare(board.id, trimmed, role)
    setName('')
    setRole('member')
    setErrorMsg('')
  }

  const handleCreateLink = () => {
    createShareLink(board.id)
  }

  const shareUrl = board.shareLink
    ? `${window.location.origin}/boards/${board.id}?token=${board.shareLink.token}`
    : `${window.location.origin}/boards/${board.id}`

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  const handleRoleChange = (shareId: string, newRole: ShareRole) => {
    updateShareRole(board.id, shareId, newRole)
    setOpenPermId(null)
  }

  const inputClass =
    'rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <Modal open onClose={onClose} className="max-w-lg !h-auto !max-h-[85dvh]">
      <div className="flex max-h-[85dvh] flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">Share board</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share board"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-slim">
          {/* ── Invite form ── */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1">
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (errorMsg) setErrorMsg('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                  placeholder="Email address or name"
                  className={`w-full ${inputClass}`}
                />
                {errorMsg && (
                  <p className="mt-1.5 text-xs text-danger-text">{errorMsg}</p>
                )}
              </div>
              <div className="flex gap-2 sm:block">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as ShareRole)}
                  className={`${inputClass} min-w-[110px]`}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={add}
                  disabled={!name.trim()}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-[38px]"
                >
                  <UserPlus size={15} />
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* ── Share link ── */}
          <div className="mx-5 rounded-lg border border-border bg-surface-alt p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface">
                <Link2 size={16} className="text-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">Share this board with a link</p>
                {board.shareLink?.enabled ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text-secondary">
                      {shareUrl}
                    </span>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
                    >
                      {linkCopied ? (
                        <>
                          <Check size={13} className="text-success" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateLink}
                    className="mt-1.5 text-sm font-medium text-primary-text transition-colors duration-150 hover:underline dark:text-primary-hover"
                  >
                    Create link
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="mt-4 flex items-center gap-1 border-b border-border px-5" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'members'}
              onClick={() => setActiveTab('members')}
              className={`px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                activeTab === 'members'
                  ? 'border-b-2 border-primary text-primary-text dark:text-primary-hover'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Board members ({shares.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'requests'}
              onClick={() => setActiveTab('requests')}
              className={`px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                activeTab === 'requests'
                  ? 'border-b-2 border-primary text-primary-text dark:text-primary-hover'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Join requests
            </button>
          </div>

          {/* ── Tab content ── */}
          <div className="px-5 py-3" role="tabpanel">
            {activeTab === 'members' && (
              <>
                {shares.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-secondary">
                    No members yet. Invite someone above to get started.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {shares.map((share) => {
                      const isYou = currentUser && share.name === currentUser.name
                      return (
                        <div
                          key={share.id}
                          className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-surface-alt"
                        >
                          <Avatar
                            member={{
                              id: share.id,
                              name: share.name,
                              color: '#3971B8',
                            }}
                            size={34}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {share.name}
                              {isYou && <span className="ml-1 text-xs text-text-secondary">(you)</span>}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {ROLE_LABELS[share.role]}
                            </p>
                          </div>
                          <div className="relative shrink-0" ref={openPermId === share.id ? permRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setOpenPermId(openPermId === share.id ? null : share.id)}
                              aria-expanded={openPermId === share.id}
                              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
                            >
                              {ROLE_LABELS[share.role]}
                              <ChevronDown size={13} />
                            </button>
                            {openPermId === share.id && (
                              <div className="animate-in absolute right-0 top-full z-30 mt-1 w-36 rounded-lg border border-border-strong bg-surface-elevated p-1 shadow-subtle">
                                {ROLE_OPTIONS.map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleRoleChange(share.id, r)}
                                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                                      share.role === r
                                        ? 'font-semibold text-primary-hover bg-primary-subtle'
                                        : 'text-text-primary hover:bg-surface-alt'
                                    }`}
                                  >
                                    {ROLE_LABELS[r]}
                                  </button>
                                ))}
                                <div className="my-1 border-t border-border" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeShare(board.id, share.id)
                                    setOpenPermId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger-text transition-colors duration-150 hover:bg-danger-subtle"
                                >
                                  <Lock size={13} />
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'requests' && (
              <p className="py-6 text-center text-sm text-text-secondary">
                No pending join requests.
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            {ROLE_DESCRIPTIONS[role]} Collaborators are stored locally — real accounts and sync arrive
            with a future backend.
          </p>
        </div>
      </div>
    </Modal>
  )
}
