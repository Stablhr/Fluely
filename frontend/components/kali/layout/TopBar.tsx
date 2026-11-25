'use client'

import { useStore } from '@/lib/kali/store/useStore'
import { YOU_ID } from '@/lib/kali/store/schema'
import Avatar from '../shared/Avatar'
import NotificationsPopover from './NotificationsPopover'

export default function TopBar() {
  const { data } = useStore()
  const you = data.members[YOU_ID]

  return (
    <header data-topbar className="hidden h-14 shrink-0 items-center gap-3 border-b border-border bg-base-surface px-8 md:flex">
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