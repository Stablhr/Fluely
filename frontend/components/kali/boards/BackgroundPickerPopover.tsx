'use client'

import { useEffect, useRef } from 'react'
import { BOARD_BACKGROUNDS } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'

export default function BackgroundPickerPopover({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const { data, setBoardBackground } = useStore()
  const board = data.boards[boardId]
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [onClose])

  return (
    <div ref={ref} className="animate-in absolute right-0 top-8 z-30 w-44 rounded-lg border border-border-strong bg-surface-elevated p-2 shadow-subtle">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
        Board background
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {BOARD_BACKGROUNDS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => {
              setBoardBackground(boardId, color)
              onClose()
            }}
            className={`h-8 rounded-md ring-2 ring-surface transition-transform duration-150 active:scale-[0.98] ${
              board?.background === color ? 'ring-offset-1 ring-primary' : ''
            }`}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}
