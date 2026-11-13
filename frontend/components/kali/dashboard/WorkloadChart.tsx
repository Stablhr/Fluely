'use client'

import { BarChart3 } from 'lucide-react'
import { Panel } from './Panel'
import type { DayLoad } from './useDashboardData'

/**
 * Tasks due on each of the next seven days, as bars. Discrete daily counts read
 * better as bars than as a line, the value is printed on every bar so nothing
 * depends on hover, and a one-sentence summary carries the same information
 * for screen readers.
 */
export default function WorkloadChart({ week }: { week: DayLoad[] }) {
  const total = week.reduce((n, d) => n + d.count, 0)
  const max = Math.max(1, ...week.map((d) => d.count))
  const busiest = week.reduce((best, d) => (d.count > best.count ? d : best), week[0])

  const summary =
    total === 0
      ? 'Nothing is due in the next seven days.'
      : `${total} task${total === 1 ? '' : 's'} due in the next seven days; the busiest day is ${busiest.weekday} ${busiest.day} with ${busiest.count}.`

  return (
    <Panel>
      <Panel.Header
        icon={BarChart3}
        title="Workload"
        description="Tasks due over the next seven days"
        action={<Panel.Link href="/schedule">Open schedule</Panel.Link>}
      />
      <Panel.Body>
        <p className="sr-only">{summary}</p>
        <div aria-hidden className="grid h-44 grid-cols-7 items-end gap-2 sm:gap-3">
          {week.map((d, i) => {
            const pct = d.count === 0 ? 0 : Math.max(8, (d.count / max) * 100)
            return (
              <div key={d.iso} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className={`text-[11px] font-medium tabular-nums ${d.count ? 'text-text-secondary' : 'text-text-muted'}`}>
                  {d.count}
                </span>
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-[5px] ${d.isToday ? 'bg-primary' : 'bg-primary/25'}`}
                    style={{
                      height: d.count === 0 ? 2 : `${pct}%`,
                      transformOrigin: 'bottom',
                      animation: `bar-grow 520ms var(--ease-out) ${120 + i * 45}ms backwards`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div aria-hidden className="mt-2 grid grid-cols-7 gap-2 border-t border-border pt-2 sm:gap-3">
          {week.map((d) => (
            <div key={d.iso} className="text-center leading-tight">
              <span className={`block text-[11px] ${d.isToday ? 'font-semibold text-primary-text' : 'text-text-muted'}`}>
                {d.isToday ? 'Today' : d.weekday}
              </span>
              <span className={`block text-[12px] tabular-nums ${d.isToday ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                {d.day}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-text-muted" aria-hidden>
          {summary}
        </p>
      </Panel.Body>
    </Panel>
  )
}
