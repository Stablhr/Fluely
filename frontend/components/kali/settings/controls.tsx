'use client'

import type { ReactNode } from 'react'

/** A titled settings card. `tone="danger"` is for destructive sections. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  tone = 'default',
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={`overflow-hidden rounded-card border bg-surface shadow-card ${
        tone === 'danger' ? 'border-danger/40' : 'border-border'
      }`}
    >
      <div className="p-4 sm:p-5">
        <h3 className={`text-[15px] font-semibold ${tone === 'danger' ? 'text-danger-text' : 'text-text-primary'}`}>
          {title}
        </h3>
        {description && <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-alt/60 px-4 py-3 sm:px-5">
          {footer}
        </div>
      )}
    </section>
  )
}

/** One labelled setting with its control on the right (stacked on mobile). */
export function SettingRow({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string
  description?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text-primary">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[12px] text-text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
        checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface-alt'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)] ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md border border-border bg-surface-alt p-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[12px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary ${
              selected
                ? 'bg-surface text-text-primary shadow-subtle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export const settingsInputClass =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20'

export const settingsPrimaryButtonClass =
  'btn-sheen inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

export const settingsSecondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

export const settingsDangerButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-danger-button px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'
