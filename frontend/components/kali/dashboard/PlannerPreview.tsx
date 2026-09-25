'use client'

import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { addDays, startOfWeek, toISODate } from '@/lib/kali/utils/dates'

export default function PlannerPreview() {
  const { data } = useStore()

  const weekStart = startOfWeek()
  const today = toISODate(new Date())
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const countFor = (date: Date) =>
    Object.values(data.cards).filter(
      (c) => !c.archived && c.dueDate === toISODate(date),
    ).length

  return (
    <div className="rounded-card bg-base-surface p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-accent-green-bg">
          <CalendarDays size={14} className="text-accent-green-text" />
        </span>
        <h2 className="text-label uppercase text-ink-500">This week</h2>
        <Link
          href="/schedule"
          className="ml-auto text-xs font-semibold text-accent-teal-text hover:underline"
        >
          Open schedule
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((day) => {
          const count = countFor(day)
          const isToday = toISODate(day) === today
          const dayLetter = day.toLocaleDateString('en-US', { weekday: 'narrow' })
          const chipClass = isToday
            ? 'bg-sidebar-bg text-white shadow-card'
            : count > 0
              ? 'bg-accent-teal-bg text-ink-900 shadow-card'
              : 'bg-base-surface-alt text-ink-900 shadow-card'
          const dotClass = count > 0
            ? isToday ? 'bg-white' : 'bg-accent-teal-text'
            : isToday ? 'bg-white/40' : 'bg-ink-300'
          return (
            <Link
              key={toISODate(day)}
              href="/schedule"
              title={`${count} card${count === 1 ? '' : 's'} on ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
              className={`flex flex-col items-center rounded-chip px-0.5 py-1.5 transition-shadow duration-150 hover:shadow-card-hover sm:px-1 sm:py-2 ${chipClass}`}
            >
              <span className={`text-[9px] font-semibold uppercase sm:text-[10px] ${isToday ? 'text-white/70' : 'text-ink-500'}`}>
                {dayLetter}
              </span>
              <span className="font-mono text-xs font-medium sm:text-sm">{day.getDate()}</span>
              <span className={`mt-0.5 h-1 w-1 rounded-full sm:mt-1 sm:h-1.5 sm:w-1.5 ${dotClass}`} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}