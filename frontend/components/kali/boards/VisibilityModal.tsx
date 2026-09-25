'use client'

import { X, Check } from 'lucide-react'
import type { Board, Visibility } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

const OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: 'private', label: 'Private', description: 'Only you can view this board.' },
  { value: 'workspace', label: 'Workspace', description: 'Visible to members of your local workspace.' },
  { value: 'public', label: 'Public', description: 'Anyone with the link can view this board.' },
]

export default function VisibilityModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const setBoardVisibility = useStore().setBoardVisibility

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text-primary">Board visibility</h2>
            <p className="mt-0.5 text-sm text-text-secondary">{board.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close visibility"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {OPTIONS.map((option) => {
            const active = board.visibility === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setBoardVisibility(board.id, option.value)
                  onClose()
                }}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left ring-1 transition-colors duration-150 ${
                  active ? 'bg-primary-subtle ring-primary' : 'ring-border-strong hover:bg-surface-alt'
                }`}
              >
                <span className="flex-1">
                  <span className={`block text-sm font-semibold ${active ? 'text-primary-hover' : 'text-text-primary'}`}>
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-secondary">{option.description}</span>
                </span>
                {active && <Check size={16} className="text-primary-hover" />}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
