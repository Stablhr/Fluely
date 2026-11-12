'use client'

import { Rows2, Rows3, Sparkles, Pause, Monitor } from 'lucide-react'
import { useDisplayPreferences } from '@/lib/theme/useTheme'
import ThemePicker from './ThemePicker'
import { Segmented, SettingRow, SettingsCard } from './controls'

export default function AppearanceSection() {
  const { motion, density, setMotion, setDensity } = useDisplayPreferences()

  return (
    <div className="stagger grid max-w-[960px] grid-cols-1 gap-4">
      <SettingsCard title="Theme" description="Choose how the app looks on this device.">
        <ThemePicker />
      </SettingsCard>

      <SettingsCard title="Layout and motion" description="Saved on this browser.">
        <div className="divide-y divide-border">
          <SettingRow label="Density" description="Compact tightens spacing so more fits on screen.">
            <Segmented
              ariaLabel="Density"
              value={density}
              onChange={setDensity}
              options={[
                { value: 'comfortable', label: 'Comfortable', icon: <Rows2 size={13} /> },
                { value: 'compact', label: 'Compact', icon: <Rows3 size={13} /> },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="Motion"
            description="System follows your device's reduce-motion setting."
          >
            <Segmented
              ariaLabel="Motion"
              value={motion}
              onChange={setMotion}
              options={[
                { value: 'system', label: 'System', icon: <Monitor size={13} /> },
                { value: 'reduce', label: 'Reduced', icon: <Pause size={13} /> },
                { value: 'full', label: 'Full', icon: <Sparkles size={13} /> },
              ]}
            />
          </SettingRow>
        </div>
      </SettingsCard>
    </div>
  )
}
