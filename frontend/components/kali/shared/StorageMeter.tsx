'use client'

import { HardDrive } from 'lucide-react'

function estimateLocalStorageUsage(): { used: number; total: number } {
  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key) ?? ''
        total += key.length + value.length
      }
    }
    // Estimate in bytes (UTF-16 = 2 bytes per char)
    const usedBytes = total * 2
    const totalBytes = 5 * 1024 * 1024 // 5 MB typical limit
    return { used: usedBytes, total: totalBytes }
  } catch {
    return { used: 0, total: 5 * 1024 * 1024 }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function StorageMeter({ collapsed }: { collapsed?: boolean }) {
  const { used, total } = estimateLocalStorageUsage()
  const pct = Math.min((used / total) * 100, 100)
  const isWarning = pct > 80

  if (collapsed) {
    return (
      <div className="flex justify-center px-1 pb-2" title={`Storage: ${formatBytes(used)} / ${formatBytes(total)}`}>
        <HardDrive size={14} className={isWarning ? 'text-warning-text' : 'text-[var(--surface-text-muted)]'} />
      </div>
    )
  }

  return (
    <div className="rounded-md px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--surface-text-muted)]">
        <HardDrive size={11} className={isWarning ? 'text-warning-text' : ''} />
        <span className="font-medium">Storage</span>
        <span className="ml-auto font-mono">{formatBytes(used)} / {formatBytes(total)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-bg-subtle)]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isWarning ? 'bg-warning' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-label={`Storage usage: ${pct.toFixed(0)}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        />
      </div>
    </div>
  )
}
