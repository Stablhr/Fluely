'use client'

import { Search } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { YOU_ID } from '@/lib/kali/store/schema'
import Avatar from '../shared/Avatar'
import NotificationsPopover from './NotificationsPopover'

export default function TopBar() {
  const { data } = useStore()
  const you = data.members[YOU_ID]

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
        <NotificationsPopover />
        {you && (
          <span className="flex items-center gap-2 rounded-pill bg-base-bg py-1 pr-3 pl-1" title={you.name}>
            <Avatar member={you} size={26} />
            <span className="max-w-40 truncate text-[13px] font-semibold text-ink-900">{you.name}</span>
          </span>
        )}
      </div>
    </header>
  )
}