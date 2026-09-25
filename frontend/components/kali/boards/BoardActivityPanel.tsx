'use client'

import { X } from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { formatDateTime } from '@/lib/kali/utils/dates'
import Modal from '../shared/Modal'

export default function BoardActivityPanel({ board, onClose }: { board: Board; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="flex items-start justify-between px-6 pt-5">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">Activity</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{board.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close activity"
          className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={16} />
        </button>
      </div>

      <div className="scroll-slim max-h-[50vh] overflow-y-auto px-6 py-5">
        {board.activity.length === 0 ? (
          <p className="rounded-md bg-surface-alt px-3 py-3 text-center text-xs text-text-muted">
            No activity yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {board.activity.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="min-w-0 break-words text-sm text-text-primary">{item.text}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
                  {formatDateTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
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
