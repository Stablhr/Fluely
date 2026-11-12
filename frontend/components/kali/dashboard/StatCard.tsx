'use client'

import type { ReactNode } from 'react'

export type StatTone = 'blue' | 'green' | 'vanilla' | 'white'

/* Every stat sits on the same neutral card; the tone only colors the small
   marker beside the label, so a row of stats reads as one set rather than a
   row of colored blocks. See frontend/Design.md §4.2. */
const MARKERS: Record<StatTone, string> = {
  blue: 'bg-primary',
  green: 'bg-success',
  vanilla: 'bg-warning',
  white: 'bg-text-muted',
}

interface StatCardProps {
  tone: StatTone
  label: string
  value: number
  icon?: ReactNode
  className?: string
}

export default function StatCard({ tone, label, value, icon, className = '' }: StatCardProps) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-5 text-text-primary shadow-card transition-shadow duration-150 hover:shadow-card-hover ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
          <span className={`h-2 w-2 rounded-full ${MARKERS[tone]}`} aria-hidden />
          {label}
        </span>
        {icon}
      </div>
      <p className="text-stat mt-3">{value}</p>
    </div>
  )
}
