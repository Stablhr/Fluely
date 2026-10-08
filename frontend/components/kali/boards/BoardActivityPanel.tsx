'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ActivityActionType, BoardActivityDto } from '@/lib/kali/api/boards'
import type { Board, List } from '@/lib/kali/store/schema'
import { formatDateTime } from '@/lib/kali/utils/dates'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

type FeedStatus = 'loading' | 'ready' | 'failed'

function metaText(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function metaFields(meta: Record<string, unknown>): string[] {
  const fields = meta.fields
  return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : []
}

/**
 * One line of human wording per audit entry.
 *
 * The metadata is whatever the backend logged for that action — title, name,
 * role, before/after — so each case reads the few keys it needs and degrades
 * to a generic phrase when one is missing rather than showing `undefined`.
 * List names for a move are looked up from the store, since the log carries
 * ids, not names.
 */
function activityPhrase(entry: BoardActivityDto, lists: Record<string, List>): string {
  const who = entry.actor.name || 'Someone'
  const meta = entry.metadata ?? {}
  const title = metaText(meta, 'title')
  const name = metaText(meta, 'name')
  const quoted = (value: string | null, fallback: string) => (value ? `"${value}"` : fallback)
  const action: ActivityActionType = entry.actionType

  switch (action) {
    case 'board.updated': {
      const fields = metaFields(meta)
      if (fields.includes('name') && name) return `${who} renamed the board to "${name}"`
      if (fields.includes('listOrder')) return `${who} reordered the lists`
      return `${who} updated the board`
    }
    case 'board.visibility_changed':
      return `${who} changed visibility from ${metaText(meta, 'from') ?? 'private'} to ${
        metaText(meta, 'to') ?? 'private'
      }`
    case 'board.deleted':
      return `${who} deleted the board${name ? ` "${name}"` : ''}`
    case 'list.created':
      return `${who} added list ${quoted(name, 'a list')}`
    case 'list.updated':
    case 'list.archived': {
      const fields = metaFields(meta)
      if (fields.includes('cardOrder') && name) return `${who} reordered cards in "${name}"`
      if (fields.includes('listOrder')) return `${who} reordered the lists`
      if (action === 'list.archived') return `${who} archived list ${quoted(name, 'a list')}`
      return `${who} updated list ${quoted(name, 'a list')}`
    }
    case 'list.deleted':
      return `${who} removed list ${quoted(name, 'a list')}`
    case 'card.created':
      return `${who} added card ${quoted(title, 'a card')}`
    case 'card.updated':
      return `${who} edited card ${quoted(title, 'a card')}`
    case 'card.status_changed':
      return `${who} marked ${quoted(title, 'a card')} ${meta.done ? 'done' : 'not done'}`
    case 'card.assigned':
      return `${who} changed the people on ${quoted(title, 'a card')}`
    case 'card.moved': {
      const fromId = metaText(meta, 'fromListId')
      const toId = metaText(meta, 'toListId')
      const fromName = (fromId && lists[fromId]?.name) || 'another list'
      const toName = (toId && lists[toId]?.name) || 'another list'
      return `${who} moved ${quoted(title, 'a card')} from ${fromName} to ${toName}`
    }
    case 'card.archived':
      return `${who} archived ${quoted(title, 'a card')}`
    case 'card.deleted':
      return `${who} deleted card ${quoted(title, 'a card')}`
    case 'collaborator.invited':
      return `${who} invited ${metaText(meta, 'email') ?? 'someone'} as ${
        metaText(meta, 'role') ?? 'a member'
      }`
    case 'collaborator.role_changed':
      return `${who} changed a role from ${metaText(meta, 'from') ?? 'viewer'} to ${
        metaText(meta, 'to') ?? 'editor'
      }`
    case 'collaborator.removed':
      return `${who} removed ${metaText(meta, 'email') ?? 'a member'} from the board`
    case 'collaborator.accepted':
      return `${who} joined as ${metaText(meta, 'role') ?? 'a member'}`
    default:
      return `${who} updated the board`
  }
}

/**
 * The board's activity feed.
 *
 * The server's audit log is the source of truth: page 1 is pulled when the
 * modal opens and realtime events append to the same store as they land, so
 * both sessions read one feed. The pre-existing local `board.activity` entries
 * are only a fallback for a failed pull, and the loading/empty states are
 * distinct so a slow request never looks like an empty board.
 */
export default function BoardActivityPanel({ board, onClose }: { board: Board; onClose: () => void }) {
  const { activityByBoard, loadBoardActivity, data } = useStore()
  const [status, setStatus] = useState<FeedStatus>('loading')

  useEffect(() => {
    let cancelled = false
    // `status` starts at 'loading' on mount — this panel opens fresh each
    // time — so only the async outcomes below touch state.
    loadBoardActivity(board.id)
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
    }
  }, [board.id, loadBoardActivity])

  const entries = activityByBoard[board.id] ?? []
  const lists = data.lists
  const showLocal = entries.length === 0 && board.activity.length > 0 && status !== 'ready'

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="flex items-start justify-between px-6 pt-5">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Activity</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{board.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close activity"
          className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="scroll-slim max-h-[50vh] overflow-y-auto px-6 py-5">
        {entries.length > 0 ? (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="min-w-0 break-words text-sm text-text-primary">
                  {activityPhrase(entry, lists)}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : showLocal ? (
          <ul className="space-y-2">
            {board.activity.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="min-w-0 break-words text-sm text-text-primary">{item.text}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
                  {formatDateTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : status === 'loading' ? (
          <p className="rounded-md bg-surface-alt px-3 py-3 text-center text-xs text-text-muted">
            Loading activity…
          </p>
        ) : status === 'failed' ? (
          <p className="rounded-md bg-surface-alt px-3 py-3 text-center text-xs text-text-muted">
            Activity could not be loaded. Reopen this panel to try again.
          </p>
        ) : (
          <p className="rounded-md bg-surface-alt px-3 py-3 text-center text-xs text-text-muted">
            No activity yet.
          </p>
        )}
      </div>

      <div className="flex justify-end px-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
