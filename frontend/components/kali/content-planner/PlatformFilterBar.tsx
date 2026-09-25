'use client'

import type { Platform } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS } from '@/lib/kali/store/schema'
import PlatformIcon from '../social/PlatformIcon'
import type { PlatformFilter } from './types'

const ALL_PLATFORMS: Platform[] = ['facebook', 'instagram', 'youtube', 'tiktok']

interface PlatformFilterBarProps {
  active: PlatformFilter
  onChange: (filter: PlatformFilter) => void
}

export default function PlatformFilterBar({ active, onChange }: PlatformFilterBarProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
          active === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-surface text-text-secondary hover:bg-surface-alt'
        }`}
      >
        All
      </button>
      {ALL_PLATFORMS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={active === p}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-all duration-150 ${
            active === p
              ? 'border-transparent text-white shadow-subtle'
              : 'border border-border bg-surface text-text-secondary hover:bg-surface-alt'
          }`}
          style={active === p ? { background: PLATFORM_COLORS[p] } : undefined}
        >
          <PlatformIcon platform={p} size={11} />
          <span className="hidden sm:inline">{p.charAt(0).toUpperCase() + p.slice(1)}</span>
        </button>
      ))}
    </div>
  )
}