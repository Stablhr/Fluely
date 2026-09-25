'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'

const DEFAULT_SETTINGS = { commentPermission: 'members' as const, selfJoin: false }

export default function SettingsModal({ board, onClose }: { board: Board; onClose: () => void }) {
  const { renameBoard, setBoardSettings } = useStore()
  const [name, setName] = useState(board.name)
  const settings = board.settings ?? DEFAULT_SETTINGS

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== board.name) renameBoard(board.id, trimmed)
    else setName(board.name)
  }

  const inputClass =
    'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="text-[17px] font-semibold text-text-primary">Board settings</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="scroll-slim max-h-[50vh] overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <label htmlFor="settings-board-name" className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
            Board name
          </label>
          <input
            id="settings-board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') setName(board.name)
            }}
            onBlur={commitName}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <div>
          <label htmlFor="settings-comments" className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
            Comments
          </label>
          <select
            id="settings-comments"
            value={settings.commentPermission}
            onChange={(e) =>
              setBoardSettings(board.id, {
                commentPermission: e.target.value as 'members' | 'anyone',
              })
            }
            className={`mt-1.5 ${inputClass}`}
          >
            <option value="members">Board members</option>
            <option value="anyone">Anyone</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-left text-sm font-medium text-text-primary">Self-join</p>
              <p className="text-left text-xs text-text-muted">
                {board.visibility !== 'public'
                  ? 'Only available when board is public'
                  : 'Allow anyone with the link to join'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.selfJoin}
              disabled={board.visibility !== 'public'}
              onClick={() => setBoardSettings(board.id, { selfJoin: !settings.selfJoin })}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ${
                settings.selfJoin ? 'bg-primary' : 'bg-border-strong'
              } ${board.visibility !== 'public' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  settings.selfJoin ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end px-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
