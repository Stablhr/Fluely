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
    <div className="rounded-card border border-border bg-surface p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-accent-green-bg">
          <CalendarDays size={14} className="text-accent-green-text" />
        </span>
        <h2 className="text-label uppercase text-ink-500">This week</h2>
        <Link
          href="/schedule"
          className="ml-auto text-xs font-medium text-primary-text hover:underline"
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
            ? 'bg-primary text-primary-foreground'
            : count > 0
              ? 'bg-primary-subtle text-text-primary'
              : 'bg-surface-alt text-text-primary'
          const dotClass = count > 0
            ? isToday ? 'bg-primary-foreground' : 'bg-primary'
            : isToday ? 'bg-primary-foreground/40' : 'bg-ink-300'
          return (
            <Link
              key={toISODate(day)}
              href="/schedule"
              title={`${count} card${count === 1 ? '' : 's'} on ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
              className={`flex flex-col items-center rounded-chip px-0.5 py-1.5 transition-[box-shadow] duration-150 hover:ring-1 hover:ring-border-strong sm:px-1 sm:py-2 ${chipClass}`}
            >
              <span className={`text-[9px] font-semibold uppercase sm:text-[10px] ${isToday ? 'text-primary-foreground/75' : 'text-ink-500'}`}>
                {dayLetter}
              </span>
              <span className="text-xs font-medium tabular-nums sm:text-sm">{day.getDate()}</span>
              <span className={`mt-0.5 h-1 w-1 rounded-full sm:mt-1 sm:h-1.5 sm:w-1.5 ${dotClass}`} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}