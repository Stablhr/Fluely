'use client'

import { useState } from 'react'
import { getAccessibleColors } from '@/lib/kali/utils/contrast'

const TEST_COLORS = [
  '#FFFFFF', '#000000', '#14B8A6', '#0F766E', '#CCFBF1',
  '#FDE047', '#EF4444', '#7C3AED', '#1E293B', '#F8FAFC',
  '#FF8B5E', '#F6C453', '#3B82F6', '#E879F9', '#33B27A',
]

export default function ContrastTestPage() {
  const [custom, setCustom] = useState('#14B8A6')
  const customResult = getAccessibleColors(custom)

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-2 text-2xl font-semibold text-text-primary">Contrast Test Page</h1>
      <p className="mb-8 text-text-secondary">WCAG contrast ratio verification for the adaptive theme system.</p>

      <div className="mb-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">Custom Color</h2>
        <div className="flex items-center gap-3">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-36 rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="text-sm text-text-secondary">
            Ratio: <strong>{customResult.contrastRatio.toFixed(2)}:1</strong>
            {customResult.contrastRatio >= 4.5 ? ' ✅ AA' : customResult.contrastRatio >= 3 ? ' ⚠️ AA Large' : ' ❌ Fail'}
          </div>
        </div>
        <div
          className="mt-3 flex h-20 w-80 items-center justify-center rounded-lg p-4 font-semibold"
          style={{ background: custom, color: customResult.foreground, border: `2px solid ${customResult.border}` }}
        >
          <span>The quick brown fox jumps over the lazy dog</span>
        </div>
        <div className="mt-2 flex gap-4 font-mono text-xs text-text-muted">
          <span>Foreground: {customResult.foreground}</span>
          <span>Muted: {customResult.foregroundMuted}</span>
          <span>Faint: {customResult.foregroundFaint}</span>
          <span>Border: {customResult.border}</span>
          <span>Dark: {customResult.isDark ? 'yes' : 'no'}</span>
        </div>
      </div>

      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">Test Grid</h2>
      <div className="grid grid-cols-3 gap-4">
        {TEST_COLORS.map((color) => {
          const r = getAccessibleColors(color)
          return (
            <div key={color}>
              <div
                className="flex h-24 items-center justify-center rounded-lg p-4 font-semibold"
                style={{ background: color, color: r.foreground, border: `2px solid ${r.border}` }}
              >
                <span className="text-center text-sm">The quick brown fox</span>
              </div>
              <div className="mt-1 flex justify-between px-1 font-mono text-[11px] text-text-muted">
                <span>{color}</span>
                <span>{r.contrastRatio.toFixed(1)}:1 {r.contrastRatio >= 4.5 ? '✅' : r.contrastRatio >= 3 ? '⚠️' : '❌'}</span>
              </div>
              <div className="flex gap-2 px-1 font-mono text-[10px] text-text-muted">
                <span>fg:{r.foreground}</span>
                <span>icon:{r.icon}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
