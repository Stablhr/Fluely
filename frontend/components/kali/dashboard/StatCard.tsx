'use client'

import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

export type StatTone = 'purple' | 'green' | 'yellow' | 'teal'

const TONES: Record<StatTone, string> = {
  purple: 'bg-accent-purple-bg',
  green: 'bg-accent-green-bg',
  yellow: 'bg-accent-yellow-bg',
  teal: 'bg-accent-teal-bg',
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
      className={`rounded-card ${TONES[tone]} p-5 shadow-card transition-shadow duration-150 hover:shadow-card-hover ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-label uppercase text-ink-500">{label}</span>
        {icon ?? <MoreHorizontal size={16} className="text-ink-500" />}
      </div>
      <p className="mt-2 text-stat text-ink-900">{value}</p>
    </div>
  )
}