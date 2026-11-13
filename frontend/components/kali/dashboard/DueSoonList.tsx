'use client'

import Link from 'next/link'
import { AlarmClock, AlertCircle, CalendarClock, CheckCircle2, Circle } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { formatDate } from '@/lib/kali/utils/dates'
import { Panel } from './Panel'
import type { DueGroup } from './useDashboardData'

const GROUP_STYLE: Record<DueGroup['key'], { icon: typeof Circle; text: string }> = {
  overdue: { icon: AlertCircle, text: 'text-danger-text' },
  today: { icon: CalendarClock, text: 'text-warning-text' },
  upcoming: { icon: Circle, text: 'text-text-muted' },
}

/** Open tasks with a due date, grouped Overdue → Today → Upcoming. */
export default function DueSoonList({
  groups,
  boards,
}: {
  groups: DueGroup[]
  boards: Record<string, Board>
}) {
  return (
    <Panel>
      <Panel.Header
        icon={AlarmClock}
        title="Due soon"
        description="Open tasks, most urgent first"
        action={<Panel.Link href="/boards">All boards</Panel.Link>}
      />
      {groups.length === 0 ? (
        <Panel.Empty
          icon={CheckCircle2}
          title="You're all caught up"
          description="No open tasks have a due date. Add due dates on cards to see them here."
        />
      ) : (
        <div className="flex-1 py-1">
          {groups.map((group) => {
            const style = GROUP_STYLE[group.key]
            const Icon = style.icon
            return (
              <div key={group.key}>
                <h3 className={`flex items-center gap-1.5 px-5 pb-1 pt-3 text-label uppercase ${style.text}`}>
                  <Icon size={12} aria-hidden />
                  {group.label}
                  <span className="text-text-muted">· {group.cards.length}</span>
                </h3>
                <ul>
                  {group.cards.map((card) => {
                    const board = boards[card.boardId]
                    return (
                      <li key={card.id}>
                        <Link
                          href={`/boards/${card.boardId}?card=${card.id}`}
                          className="group flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-text-primary group-hover:text-primary-text">
                              {card.title}
                            </span>
                            {board && <span className="block truncate text-[12px] text-text-muted">{board.name}</span>}
                          </span>
                          <span className={`shrink-0 text-[12px] font-medium tabular-nums ${style.text}`}>
                            {group.key === 'today' ? 'Today' : formatDate(card.dueDate!)}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
