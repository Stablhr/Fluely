'use client'

import { useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cloneElement } from 'react'

/**
 * A small text tooltip above its trigger. It appears on hover *and* on
 * keyboard focus (never hover-only), after a short delay so it doesn't flicker
 * when the pointer passes over, and it is wired to the trigger with
 * `aria-describedby` so screen readers read it too.
 *
 * The trigger must be a single focusable element that accepts
 * `aria-describedby` (a button or link).
 */
export default function Tooltip({
  content,
  children,
}: {
  content: ReactNode
  children: ReactElement<{ 'aria-describedby'?: string }>
}) {
  const id = useId()
  return (
    <span className="group/tip relative inline-flex">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-[240px] -translate-x-1/2 translate-y-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] leading-snug text-white opacity-0 shadow-medium transition-[opacity,transform] duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-hover/tip:delay-300 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 dark:bg-slate-100 dark:text-slate-900"
      >
        {content}
        <span
          aria-hidden
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-100"
        />
      </span>
    </span>
  )
}
