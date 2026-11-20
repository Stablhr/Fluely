'use client'

import { flushSync } from 'react-dom'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useThemePreference } from '@/lib/theme/useTheme'
import type { ThemePreference } from '@/lib/theme/theme'

const OPTIONS: { id: ThemePreference; label: string; hint: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', hint: 'Bright surfaces', icon: Sun },
  { id: 'dark', label: 'Dark', hint: 'Easier in low light', icon: Moon },
  { id: 'system', label: 'System', hint: 'Match your device', icon: Monitor },
]

/**
 * A miniature of the app frame, drawn in the palette it previews rather than in
 * the current theme's tokens, so each card shows what you get.
 */
function Preview({ variant }: { variant: ThemePreference }) {
  const light = { canvas: '#f7f8fa', side: '#ffffff', card: '#ffffff', line: '#e3e6eb', text: '#cdd2da' }
  const dark = { canvas: '#0c0e12', side: '#14171d', card: '#1e222b', line: '#262b34', text: '#3a414e' }

  const pane = (p: typeof light, clip?: string) => (
    <div className="absolute inset-0 flex" style={{ background: p.canvas, clipPath: clip }}>
      <div className="w-[26%] border-r p-1.5" style={{ background: p.side, borderColor: p.line }}>
        <div className="h-1.5 w-3 rounded-sm bg-primary" />
        <div className="mt-2 h-1 w-full rounded-sm" style={{ background: p.text }} />
        <div className="mt-1 h-1 w-3/4 rounded-sm" style={{ background: p.text }} />
      </div>
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-1.5 w-1/2 rounded-sm" style={{ background: p.text }} />
        <div className="flex gap-1.5">
          <div className="h-7 flex-1 rounded border" style={{ background: p.card, borderColor: p.line }} />
          <div className="h-7 flex-1 rounded border" style={{ background: p.card, borderColor: p.line }} />
        </div>
        <div className="h-1.5 w-8 rounded-sm bg-primary" />
      </div>
    </div>
  )

  return (
    <div className="relative h-20 overflow-hidden rounded-md border border-border">
      {variant === 'dark' ? pane(dark) : pane(light)}
      {variant === 'system' && pane(dark, 'polygon(100% 0, 100% 100%, 0 100%)')}
    </div>
  )
}

export default function ThemePicker() {
  const { preference, resolved, setPreference } = useThemePreference()

  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ id, label, hint, icon: Icon }) => {
          const selected = preference === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={(e) => {
                // Spread the new theme from the pointer; keyboard presses
                // (detail 0) start from the centre of the card instead.
                const rect = e.currentTarget.getBoundingClientRect()
                const origin =
                  e.detail > 0
                    ? { x: e.clientX, y: e.clientY }
                    : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                // flushSync so the picker's own "selected" state is part of the
                // snapshot the transition animates to, not a frame later.
                setPreference(id, origin, (apply) => flushSync(apply))
              }}
              className={`rounded-card border bg-surface p-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong'
              }`}
            >
              <Preview variant={id} />
              <span className="mt-2.5 flex items-center gap-2 px-0.5">
                <Icon size={14} className="shrink-0 text-text-secondary" />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-text-primary">{label}</span>
                  <span className="block text-[11px] text-text-muted">{hint}</span>
                </span>
                {selected && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[12px] text-text-muted">
        {preference === 'system'
          ? `Following your device — currently ${resolved}.`
          : 'Saved on this browser.'}
      </p>
    </div>
  )
}
