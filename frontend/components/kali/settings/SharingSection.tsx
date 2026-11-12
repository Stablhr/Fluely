'use client'

import { Globe, Lock, Users } from 'lucide-react'
import type { BoardVisibilityPreference } from '@/lib/api/profileApi'
import { usePreferences } from './usePreferences'
import { SettingsCard } from './controls'

const OPTIONS: {
  value: BoardVisibilityPreference
  label: string
  description: string
  icon: typeof Lock
}[] = [
  { value: 'private', label: 'Private', description: 'Only you and people you invite.', icon: Lock },
  { value: 'workspace', label: 'Workspace', description: 'Everyone in your workspace can view it.', icon: Users },
  { value: 'public', label: 'Public', description: 'Anyone with the link can view it.', icon: Globe },
]

export default function SharingSection({ onOpenProfile }: { onOpenProfile: () => void }) {
  const { preferences, update, isLoading } = usePreferences()
  const current = preferences.defaultBoardVisibility

  return (
    <div className="stagger grid max-w-[960px] grid-cols-1 gap-4">
      <SettingsCard
        title="Default board visibility"
        description="New boards start with this. You can change any board later from its menu."
      >
        <div role="radiogroup" aria-label="Default board visibility" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OPTIONS.map(({ value, label, description, icon: Icon }) => {
            const selected = current === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={isLoading}
                onClick={() => !selected && update({ defaultBoardVisibility: value })}
                className={`flex items-start gap-3 rounded-card border p-3 text-left transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  selected
                    ? 'border-primary bg-primary-subtle ring-1 ring-primary'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    selected ? 'bg-primary text-primary-foreground' : 'bg-surface-alt text-text-secondary'
                  }`}
                >
                  <Icon size={15} />
                </span>
                <span>
                  <span className="block text-[13px] font-medium text-text-primary">{label}</span>
                  <span className="block text-[12px] text-text-muted">{description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Profile privacy" description="Choose who can see your email and phone number.">
        <p className="text-[13px] text-text-secondary">
          These controls live with your contact details.{' '}
          <button type="button" onClick={onOpenProfile} className="font-medium text-primary-text hover:underline">
            Open Profile → Contact &amp; visibility
          </button>
        </p>
      </SettingsCard>
    </div>
  )
}
