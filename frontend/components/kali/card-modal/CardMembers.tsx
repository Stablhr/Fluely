'use client'

import { useState } from 'react'
import { Users, Check } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import SectionLabel from '../shared/SectionLabel'
import Avatar from '../shared/Avatar'

export default function CardMembers({ card }: { card: Card }) {
  const store = useStore()
  const [open, setOpen] = useState(false)

  const toggle = (memberId: string) => {
    const has = card.memberIds.includes(memberId)
    const memberIds = has
      ? card.memberIds.filter((id) => id !== memberId)
      : [...card.memberIds, memberId]
    store.updateCard(card.id, { memberIds })
    const member = store.data.members[memberId]
    store.addActivity(card.id, has ? `unassigned ${member?.name ?? 'a member'}` : `assigned ${member?.name ?? 'a member'}`)
  }

  const assigned = card.memberIds
    .map((id) => store.data.members[id])
    .filter(Boolean)

  return (
    <section>
      <SectionLabel icon={<Users size={14} />}>Members</SectionLabel>

      <div className="mt-2 flex flex-wrap gap-1">
        {assigned.length === 0 ? (
          <span className="text-xs text-text-muted">No members</span>
        ) : (
          assigned.map((m) => <Avatar key={m.id} member={m} size={22} />)
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 text-xs font-semibold text-primary-hover hover:underline"
      >
        {open ? 'Done' : 'Assign members'}
      </button>

      {open && (
        <div className="animate-in mt-2 space-y-0.5 rounded-lg border border-border-strong bg-surface-elevated p-1.5 shadow-subtle">
          {store.members.map((member) => {
            const active = card.memberIds.includes(member.id)
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member.id)}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-surface-alt"
              >
                <span className="flex items-center gap-2">
                  <Avatar member={member} size={20} />
                  <span className="text-sm font-medium text-text-primary">{member.name}</span>
                </span>
                {active && <Check size={14} className="text-primary-hover" />}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
