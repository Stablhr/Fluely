'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { useCountUp } from '@/lib/kali/hooks/useCountUp'

/**
 * One headline number. The whole card links to where you would act on it.
 * `attention` is passed only by the KPI that can go wrong (overdue): it adds a
 * danger tint *and* keeps the icon and hint text, so the state never rests on
 * color alone.
 */
export default function KpiCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  attention = false,
}: {
  href: string
  label: string
  value: number
  hint: string
  icon: LucideIcon
  attention?: boolean
}) {
  const shown = useCountUp(value)
  return (
    <Link
      href={href}
      className={`hover-lift group flex flex-col rounded-card border bg-surface p-4 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5 ${
        attention ? 'border-danger/40' : 'border-border hover:border-border-strong'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-text-secondary">{label}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-chip ${
            attention ? 'bg-danger-subtle text-danger-text' : 'bg-surface-alt text-text-muted group-hover:text-primary-text'
          } transition-colors duration-150`}
        >
          <Icon size={15} aria-hidden />
        </span>
      </span>
      {/* The animated digits are hidden from assistive tech, which reads the
          final value instead of an in-between frame. */}
      <span className="mt-2 text-stat text-text-primary">
        <span aria-hidden>{shown}</span>
        <span className="sr-only">{value}</span>
      </span>
      <span className={`mt-0.5 truncate text-[12px] ${attention ? 'font-medium text-danger-text' : 'text-text-muted'}`}>
        {hint}
      </span>
    </Link>
  )
}
