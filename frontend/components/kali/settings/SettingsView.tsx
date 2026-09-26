'use client'

import { Monitor } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
      <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function SettingsView() {
  const { data, socialPosts } = useStore()

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
