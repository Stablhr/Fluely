'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { ThemeMode } from '@/lib/kali/store/schema'
import { useThemeMode } from '@/lib/kali/hooks/useThemeMode'

const THEME_OPTIONS: { value: ThemeMode; icon: typeof Sun; label: string; hint: string }[] = [
  { value: 'light', icon: Sun, label: 'Light', hint: 'Bright surfaces with dark text.' },
  { value: 'dark', icon: Moon, label: 'Dark', hint: 'Dimmed surfaces for low-light work.' },
]

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function SettingsView() {
  const { data, socialPosts, setDarkMode } = useStore()
  const mode = useThemeMode()

  const stats = [
    { label: 'Boards', value: Object.keys(data.boards).length },
    { label: 'Lists', value: Object.keys(data.lists).length },
    { label: 'Cards', value: Object.keys(data.cards).length },
    { label: 'Inbox', value: data.inbox.length },
    { label: 'Posts', value: socialPosts.length },
  ]

  return (
    <div className="scroll-slim mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Settings</h1>
      <p className="mt-1 text-sm text-text-secondary">Preferences for this workspace and your account.</p>

      <div className="mt-4 space-y-4 sm:mt-6">
        <Section title="Appearance" description="Applies to this browser only. Your choice is remembered on this device.">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map(({ value, icon: Icon, label, hint }) => {
              const active = mode === value

              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDarkMode(value)}
                  className={`flex flex-col items-start gap-1.5 rounded-card border px-3 py-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active
                      ? 'border-primary bg-primary-subtle'
                      : 'border-border bg-surface-alt hover:border-border-strong'
                  }`}
                >
                  <span className="flex w-full items-center gap-2">
                    <Icon size={16} className={active ? 'text-primary' : 'text-text-muted'} />
                    <span className={`text-[13px] font-semibold ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {label}
                    </span>
                    {active && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-primary">On</span>}
                  </span>
                  <span className="text-[12px] leading-snug text-text-muted">{hint}</span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Storage" description="Your boards, cards, and scheduled posts are kept in this browser.">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-chip bg-surface-alt px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-text-muted">{stat.label}</dt>
                <dd className="font-mono text-[15px] font-semibold text-text-primary">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Monitor size={13} />
            Signing out keeps this data here. Clear your browser storage to remove it.
          </p>
        </Section>
      </div>
    </div>
  )
}
