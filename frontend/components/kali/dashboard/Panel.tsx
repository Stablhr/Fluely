'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'

/*
 * Dashboard panel, as composable parts rather than one component with flags:
 *
 *   <Panel>
 *     <Panel.Header title="Due soon" icon={AlarmClock} action={<Panel.Link …/>} />
 *     <Panel.Body>…</Panel.Body>          or   <Panel.Empty …/>
 *   </Panel>
 *
 * Every widget on the dashboard is built from these, so spacing, headings and
 * empty states stay identical across them.
 */

function Root({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-card border border-border bg-surface shadow-card ${className}`}>
      {children}
    </section>
  )
}

function Header({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
}) {
  return (
    <header className="flex items-start gap-3 border-b border-border px-5 py-3.5">
      {Icon && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-surface-alt text-text-secondary">
          <Icon size={15} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-card-title text-text-primary">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </header>
  )
}

function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex-1 px-5 py-4 ${className}`}>{children}</div>
}

/** A header action that goes somewhere ("View all →"). */
function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-primary-text transition-colors duration-150 hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
      <ArrowRight size={13} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}

/** Shown instead of Body when there is nothing to list: what this is, and what to do next. */
function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-card border border-border bg-surface-alt text-text-muted">
        <Icon size={18} aria-hidden />
      </span>
      <p className="mt-3 text-[13px] font-medium text-text-primary">{title}</p>
      <p className="mt-1 max-w-xs text-[12px] text-text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export const Panel = Object.assign(Root, { Header, Body, Empty, Link: HeaderLink })
