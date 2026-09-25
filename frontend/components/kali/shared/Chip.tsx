'use client'

import { X } from 'lucide-react'
import type { Label } from '@/lib/kali/store/schema'
import { getAccessibleColors } from '@/lib/kali/utils/contrast'

interface LabelChipProps {
  label: Label
  onRemove?: () => void
  className?: string
}

export default function LabelChip({ label, onRemove, className = '' }: LabelChipProps) {
  const fg = getAccessibleColors(label.color)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={{ background: label.color, color: fg.foreground, border: `1px solid ${fg.border}` }}
    >
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          aria-label={`Remove label ${label.name}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  )
}
