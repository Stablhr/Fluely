'use client'

import AccountConnectionPanel from '../social/AccountConnectionPanel'
import { SettingsCard } from './controls'

/**
 * Social accounts posts can be scheduled to. The same panel as Social
 * Posting's sidebar; a sign-in started here comes back here.
 */
export default function ConnectedAccountsSection() {
  return (
    <div className="stagger grid max-w-[960px] grid-cols-1 gap-4">
      <SettingsCard
        title="Social accounts"
        description="Connect the accounts your workspace schedules posts to. You can add more than one account per platform, such as several Facebook Pages."
      >
        <AccountConnectionPanel returnTo="settings" />
      </SettingsCard>
    </div>
  )
}
