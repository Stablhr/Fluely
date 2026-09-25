'use client'

import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { addDays, startOfWeek, toISODate } from '@/lib/kali/utils/dates'

const W = 200
const H = 48
const PAD = 3

interface DayPoint {
  iso: string
  count: number
  label: string
  short: string
  x: number
  y: number
}

export default function HeroCard() {
  const { data } = useStore()

  const points = useMemo<DayPoint[]>(() => {
    const weekStart = startOfWeek()
    const step = (W - PAD * 2) / 6
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      const iso = toISODate(date)
      const count = Object.values(data.cards).filter(
        (c) => !c.archived && !c.done && c.dueDate === iso,
      ).length
      return { iso, count, label: date.toLocaleDateString('en-US', { weekday: 'short' }), short: date.toLocaleDateString('en-US', { weekday: 'narrow' }) }
    })
    const max = Math.max(1, ...days.map((d) => d.count))
    return days.map((d, i) => ({
      ...d,
      x: PAD + i * step,
      y: H - PAD - (d.count / max) * (H - PAD * 2),
    }))
  }, [data.cards])

  const total = points.reduce((acc, d) => acc + d.count, 0)
  const peak = points.reduce((best, d) => (d.count > best.count ? d : best), points[0])
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`

  return (
    <div className="flex flex-col rounded-card bg-base-surface p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-accent-teal-bg text-accent-teal-text">
          <TrendingUp size={14} />
        </span>
        <span className="text-label uppercase text-ink-500">Due next 7 days</span>
        {total > 0 && (
          <span className="ml-auto rounded-pill bg-accent-teal-bg px-2 py-0.5 text-[11px] font-semibold text-accent-teal-text">
            Peak {peak.label} · {peak.count}
          </span>
        )}
      </div>

      <p className="mt-4 text-stat text-ink-900">{total}</p>
      <p className="mt-1 text-body text-ink-500">
        {total === 0 ? 'Nothing scheduled this week.' : `${total} task${total === 1 ? '' : 's'} due across the next week.`}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-5 h-14 w-full"
        role="img"
        aria-label="Number of tasks due per day for the next seven days"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hero-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--color-accent-teal-text)', stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-accent-teal-text)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {points.map((p) => (
          <circle
            key={p.iso}
            cx={p.x}
            cy={p.y}
            r={2.5}
            className="fill-accent-teal-text"
          >
            <title>{`${p.short} ${new Date(p.iso + 'T00:00:00').getDate()} · ${p.count} task${p.count === 1 ? '' : 's'}`}</title>
          </circle>
        ))}
        <polygon points={area} fill="url(#hero-spark-fill)" />
        <polyline
          points={line}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-accent-teal-text"
        />
      </svg>

      <div className="mt-2 flex justify-between px-[1.5%]">
        {points.map((p) => (
          <span key={p.iso} className="text-[10px] font-medium text-ink-500">
            {p.short}
          </span>
        ))}
      </div>
    </div>
  )
}