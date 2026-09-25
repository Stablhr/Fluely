'use client'

import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

export type StatTone = 'blue' | 'green' | 'vanilla' | 'white'

/* Flat brand color blocks, not tinted washes. Blue carries ivory text; the
   lighter blocks carry ink. See frontend/Design.md §4.2. */
const TONES: Record<StatTone, string> = {
  blue: 'bg-brand-blue text-brand-ivory',
  green: 'bg-brand-green text-brand-ink',
  vanilla: 'bg-brand-vanilla text-brand-ink',
  white: 'bg-surface text-brand-ink border border-border',
}

interface StatCardProps {
  tone: StatTone
  label: string
  value: number
  icon?: ReactNode
  className?: string
}

export default function StatCard({ tone, label, value, icon, className = '' }: StatCardProps) {
  const onBlue = tone === 'blue'

  return (
    <div className={`rounded-card p-5 transition-shadow duration-150 ${TONES[tone]} ${className}`}>
      <div className="flex items-center justify-between">
        <span className={`text-label uppercase ${onBlue ? 'text-brand-ivory/70' : 'text-brand-ink/60'}`}>{label}</span>
        {icon ?? <MoreHorizontal size={16} className={onBlue ? 'text-brand-ivory/70' : 'text-brand-ink/50'} />}
      </div>
      <p className="text-stat mt-2">{value}</p>
    </div>
  )
}