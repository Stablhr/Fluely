'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Clock, Handshake, X } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { useToast } from '@/components/kali/shared/useToastState'
import type { AppNotification, AppNotificationType } from '@/lib/kali/store/useStore'

const ICONS: Record<AppNotificationType, typeof Bell> = {
  board_invitation: Handshake,
  board_invitation_accepted: Check,
  board_invitation_declined: X,
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString()
}

function headline(notification: AppNotification): string {
  const who = notification.actorName || 'Someone'
  const board = notification.boardName || 'a board'
  switch (notification.type) {
    case 'board_invitation':
      return `${who} invited you to ${board}`
    case 'board_invitation_accepted':
      return `${who} accepted your invitation to ${board}`
    case 'board_invitation_declined':
      return `${who} declined your invitation to ${board}`
  }
}

/**
 * Raises a toast for a notification this browser has not seen before.
 *
 * Seeded silently on the first sync — those rows may be hours old, and
 * announcing them on page load would be noise. Only what arrives afterwards
 * (the other party answering while this tab is open) is worth a toast.
 */
function useNewNotificationToasts(notifications: AppNotification[]) {
  const { toast } = useToast()
  const seenRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(notifications.map((n) => n.id))
      return
    }
    const seen = seenRef.current
    const fresh = notifications.filter((n) => !seen.has(n.id))
    for (const notification of fresh) {
      seen.add(notification.id)
      if (notification.type === 'board_invitation') {
        toast(headline(notification), 'info')
      } else {
        toast(headline(notification), 'success')
      }
    }
  }, [notifications, toast])
}

export default function NotificationsPopover() {
  const {
    notifications,
    unreadNotificationCount,
    pendingInvitations,
    markNotificationRead,
    markAllNotificationsRead,
    respondToInvitation,
  } = useStore()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [answeringId, setAnsweringId] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)

  useNewNotificationToasts(notifications)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const answer = async (
    notification: AppNotification,
    decision: 'accepted' | 'declined',
  ) => {
    if (!notification.collaboratorId || answeringId) return
    setAnsweringId(notification.id)
    try {
      // The store removes the row optimistically, so it is already gone by the
      // time this resolves; no separate mark-read call is needed — the server
      // deletes the card when the invitation is answered.
      await respondToInvitation(notification.collaboratorId, decision)
      toast(
        decision === 'accepted'
          ? `You joined ${notification.boardName || 'the board'}.`
          : `Invitation to ${notification.boardName || 'the board'} declined.`,
        decision === 'accepted' ? 'success' : 'info',
      )
    } catch {
      // The store has already surfaced the reason in the error slot and put
      // the row back.
    } finally {
      setAnsweringId(null)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadNotificationCount > 0
            ? `Notifications, ${unreadNotificationCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors duration-150 hover:bg-base-surface-alt hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell size={17} />
        {unreadNotificationCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground">
            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-[80] w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-base-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[13px] font-semibold text-ink-900">
              Notifications
            </span>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllNotificationsRead()}
                className="text-[12px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-ink-500">
                You&apos;re all caught up.
              </div>
            )}

            {notifications.map((notification) => {
              const Icon = ICONS[notification.type]
              const isInvitation = notification.type === 'board_invitation'
              const isAnswering = answeringId === notification.id
              // The pending list is the source of truth: buttons only render
              // while the invitation itself is unanswered, so a stale row (an
              // in-flight poll, or data from before the delete-on-answer change)
              // can never offer Accept/Decline for a decision already made.
              const isStillPending =
                isInvitation &&
                notification.collaboratorId !== null &&
                pendingInvitations.some(
                  (p) => p.id === notification.collaboratorId,
                )
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 ${
                    notification.read ? '' : 'bg-primary/5'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      notification.read
                        ? 'bg-base-surface-alt text-ink-500'
                        : 'bg-primary/15 text-primary'
                    }`}
                  >
                    <Icon size={14} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-ink-900">
                      {headline(notification)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
                      <Clock size={10} />
                      {relativeTime(notification.createdAt)}
                    </p>

                    {isStillPending && notification.collaboratorId && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={isAnswering}
                          onClick={() => void answer(notification, 'accepted')}
                          className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-55"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={isAnswering}
                          onClick={() => void answer(notification, 'declined')}
                          className="rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-base-surface-alt disabled:opacity-55"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {!isInvitation && notification.type === 'board_invitation_accepted' && (
                      <Link
                        href={`/boards/${notification.boardId}`}
                        onClick={() => {
                          void markNotificationRead(notification.id)
                          setOpen(false)
                        }}
                        className="mt-2 inline-block text-[12px] font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        Open board
                      </Link>
                    )}
                  </div>

                  {/* Invitation rows are only actionable via Accept/Decline,
                      so the mark-as-read affordance is for the rest. */}
                  {!notification.read && !isInvitation && (
                    <button
                      type="button"
                      onClick={() => void markNotificationRead(notification.id)}
                      aria-label="Mark as read"
                      title="Mark as read"
                      className="mt-1 rounded p-1 text-ink-500 transition-colors hover:bg-base-surface-alt hover:text-ink-900"
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
