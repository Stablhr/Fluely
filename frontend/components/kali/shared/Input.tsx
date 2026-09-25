'use client'

import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const BASE =
  'w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-border disabled:bg-surface-alt disabled:text-text-muted'

const INVALID = 'border-danger focus:border-danger focus:ring-danger/20'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${BASE} ${invalid ? INVALID : 'border-border-strong'} ${className}`}
      {...rest}
    />
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className = '', rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`${BASE} resize-none leading-relaxed ${invalid ? INVALID : 'border-border-strong'} ${className}`}
      {...rest}
    />
  )
})
