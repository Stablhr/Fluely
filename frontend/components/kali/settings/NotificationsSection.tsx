'use client'

import { Bell, Mail } from 'lucide-react'
import type { NotificationChannelPreferences } from '@/lib/api/profileApi'
import { usePreferences } from './usePreferences'
import { SettingsCard, Switch } from './controls'

const EVENTS: { key: keyof NotificationChannelPreferences; label: string; description: string }[] = [
  { key: 'mentions', label: 'Mentions', description: 'Someone @mentions you in a card comment.' },
  {
    key: 'invitationResponses',
    label: 'Invitation responses',
    description: 'Someone accepts or declines your board invitation.',
  },
]

export default function NotificationsSection() {
  const { preferences, update, isLoading } = usePreferences()
  const { inApp, email } = preferences.notifications

  return (
    <div className="stagger grid max-w-[960px] grid-cols-1 gap-4">
      <SettingsCard
        title="Notify me about"
        description="Saved to your account, so it applies on every device."
      >
        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[1fr_64px_64px] items-center gap-2 border-b border-border bg-surface-alt px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">
            <span>Event</span>
            <span className="flex items-center justify-center gap-1"><Bell size={12} />In-app</span>
            <span className="flex items-center justify-center gap-1"><Mail size={12} />Email</span>
          </div>
          {EVENTS.map((event) => (
            <div
              key={event.key}
              className="grid grid-cols-[1fr_64px_64px] items-center gap-2 border-b border-border px-3 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text-primary">{event.label}</p>
                <p className="text-[12px] text-text-muted">{event.description}</p>
              </div>
              <div className="flex justify-center">
                <Switch
                  label={`${event.label} in-app`}
                  checked={inApp[event.key]}
                  disabled={isLoading}
                  onChange={(v) => update({ notifications: { inApp: { [event.key]: v } } })}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  label={`${event.label} by email`}
                  checked={email[event.key]}
                  disabled={isLoading}
                  onChange={(v) => update({ notifications: { email: { [event.key]: v } } })}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-text-muted">
          Board invitations are always delivered, in the app and by email, so you can accept them.
        </p>
      </SettingsCard>
    </div>
  )
}
