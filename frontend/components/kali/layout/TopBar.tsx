'use client'

import { Bell, Search } from 'lucide-react'
import Link from 'next/link'
import { useStore } from '@/lib/kali/store/useStore'
import Avatar from '../shared/Avatar'

export default function TopBar() {
  const { data, members } = useStore()
  const you = members.find((m) => m.name === 'You') ?? members[0]
  const inboxCount = data.inbox.length

  return (
    <header data-topbar className="hidden h-14 shrink-0 items-center gap-3 border-b border-border bg-base-surface px-8 md:flex">
      <div className="relative w-full max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          type="search"
          placeholder="Search…"
          aria-label="Search"
          className="h-9 w-full rounded-pill bg-base-bg pr-3 pl-9 text-[13px] text-ink-900 outline-none transition-colors duration-150 placeholder:text-ink-500 focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/inbox"
          aria-label="Inbox"
          title="Inbox"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors duration-150 hover:bg-base-surface-alt hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Bell size={17} />
          {inboxCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground">
              {inboxCount}
            </span>
          )}
        </Link>
        {you && (
          <span className="flex items-center gap-2 rounded-pill bg-base-bg py-1 pr-3 pl-1">
            <Avatar member={you} size={26} />
            <span className="text-[13px] font-semibold text-ink-900">{you.name}</span>
          </span>
        )}
      </div>
    </header>
  )
}