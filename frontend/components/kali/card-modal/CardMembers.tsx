'use client'

import { useEffect, useState } from 'react'
import { Users, Check, Lock } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { YOU_ID } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import SectionLabel from '../shared/SectionLabel'
import Avatar from '../shared/Avatar'

export default function CardMembers({
  card,
  readOnly = false,
}: {
  card: Card
  readOnly?: boolean
}) {
  const store = useStore()
  const [open, setOpen] = useState(false)

  const board = store.data.boards[card.boardId]
  const hasServerBoard = Boolean(board?.ownerId && board.revision !== null)

  useEffect(() => {
    if (!hasServerBoard) return
    // The roster is board-scoped: owner plus accepted collaborators. Loading it
    // here makes a card opened directly render and assign the right people even
    // if the board view's own load has not finished.
    void store.loadCollaborators(card.boardId)
  }, [card.boardId, hasServerBoard, store.loadCollaborators])

  const canAssign = store.canManage(card.boardId) && !readOnly
  const boardMembers = store.getBoardMembers(card.boardId)
  const memberById = new Map(boardMembers.map((member) => [member.id, member]))

  const resolveMember = (id: string) => {
    const direct = memberById.get(id)
    if (direct) return direct
    if (store.currentUserId && id === store.currentUserId) {
      return memberById.get(YOU_ID) ?? store.data.members[YOU_ID]
    }
    return store.data.members[id]
  }

  const assigned = Array.from(
    new Map(
      card.memberIds
        .map((id) => resolveMember(id))
        .filter(Boolean)
        .map((member) => [member!.id, member!]),
    ).values(),
  )

  const isAssigned = (memberId: string) => {
    if (card.memberIds.includes(memberId)) return true
    if (store.currentUserId) {
      if (memberId === YOU_ID && card.memberIds.includes(store.currentUserId)) {
        return true
      }
      if (memberId === store.currentUserId && card.memberIds.includes(YOU_ID)) {
        return true
      }
    }
    return false
  }

  const toggle = (memberId: string) => {
    if (!canAssign) return
    store.setCardMember(card.id, memberId, !isAssigned(memberId))
  }

  return (
    <section>
      <SectionLabel icon={<Users size={14} />}>Members</SectionLabel>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {assigned.length === 0 ? (
          <span className="text-xs text-text-muted">No members</span>
        ) : (
          assigned.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-alt py-0.5 pl-0.5 pr-2"
            >
              <Avatar member={member} size={20} />
              <span className="max-w-[10rem] truncate text-xs font-medium text-text-primary">
                {member.name}
              </span>
            </span>
          ))
        )}
      </div>

      {!canAssign && (
        <p
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-text-muted"
          title="Only the board owner can assign members."
        >
          <Lock size={11} />
          Only the board owner can assign members.
        </p>
      )}

      {canAssign && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-2 text-xs font-semibold text-primary-hover hover:underline"
        >
          {open ? 'Done' : assigned.length > 0 ? 'Edit members' : 'Assign members'}
        </button>
      )}

      {canAssign && open && (
        <div className="animate-in mt-2 space-y-0.5 rounded-lg border border-border-strong bg-surface-elevated p-1.5 shadow-subtle">
          {boardMembers.map((member) => {
            const active = isAssigned(member.id)
            const isYou =
              member.id === YOU_ID ||
              Boolean(store.currentUserId && member.id === store.currentUserId)
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(member.id)}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-surface-alt"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar member={member} size={20} />
                  <span className="min-w-0 truncate text-sm font-medium text-text-primary">
                    {member.name}
                    {isYou && (
                      <span className="ml-1 text-text-muted">(you)</span>
                    )}
                  </span>
                </span>
                <span
                  className={`ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-strong'
                  }`}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            )
          })}

          {boardMembers.length <= 1 && (
            <p className="px-1.5 pb-1 pt-2 text-[11px] leading-snug text-text-muted">
              Invite collaborators from the board&apos;s Share menu to assign
              them to cards.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
