'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover disabled:hover:bg-primary',
  secondary:
    'border border-border-strong bg-surface text-text-primary hover:bg-surface-alt disabled:hover:bg-surface',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary disabled:hover:bg-transparent disabled:hover:text-text-secondary',
  danger: 'bg-danger-button text-white hover:brightness-95 disabled:hover:brightness-100',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-9 gap-2 px-3.5 text-sm',
}

/** Shared button — Design.md §15.1. Solid fills, subtle borders, no glow/shadow. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
        VARIANTS[variant]
      } ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
