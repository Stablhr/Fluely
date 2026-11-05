'use client'

import { ListChecks } from 'lucide-react'
import type { Card } from '@/lib/kali/store/schema'
import { formatDateTime } from '@/lib/kali/utils/dates'
import SectionLabel from '../shared/SectionLabel'
import RichText from '../shared/RichText'

export default function CardActivity({ card }: { card: Card }) {
  return (
    <section>
      <SectionLabel icon={<ListChecks size={14} />}>Activity</SectionLabel>
      {card.activity.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">No activity yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {card.activity.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
              <RichText as="span" text={item.text} className="min-w-0 text-sm text-text-primary" />
              <span className="font-mono text-[10.5px] text-text-muted">
                {formatDateTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
