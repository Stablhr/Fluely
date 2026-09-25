'use client'

import { Clock } from 'lucide-react'
import { formatDate, getUrgency } from '@/lib/kali/utils/dates'
import type { Urgency } from '@/lib/kali/utils/dates'

const STYLES: Record<Exclude<Urgency, 'none'>, string> = {
  normal: 'bg-surface-alt text-text-secondary',
  soon: 'bg-warning-subtle text-warning-text',
  overdue: 'bg-danger-subtle text-danger-text',
}

export default function DueBadge({ due, className = '' }: { due: string; className?: string }) {
  const urgency = getUrgency(due)
  if (urgency === 'none') return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${STYLES[urgency]} ${className}`}
    >
      <Clock size={10} />
      {formatDate(due)}
    </span>
  )
}
