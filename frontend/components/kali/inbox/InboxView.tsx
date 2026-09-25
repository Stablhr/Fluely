'use client'

import { useState } from 'react'
import { Trash2, FolderInput, CalendarPlus } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { formatDateTime } from '@/lib/kali/utils/dates'
import CaptureBox from '../shared/CaptureBox'
import InboxActionModal from './InboxActionModal'
import InboxEmptyState from './InboxEmptyState'

export default function InboxView() {
  const { data, dismissInboxItem } = useStore()
  const [action, setAction] = useState<{ itemId: string; mode: 'move' | 'schedule' } | null>(null)

  return (
    <div className="scroll-slim mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Inbox</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Quick captures land here until you move them to a board or schedule them.
      </p>

      <div className="mt-4 sm:mt-6">
        <CaptureBox variant="dash" />
      </div>

      {data.inbox.length === 0 ? (
        <div className="mt-4 sm:mt-6">
          <InboxEmptyState />
        </div>
      ) : (
        <ul className="mt-4 space-y-2 sm:mt-6">
          {data.inbox.map((item) => (
            <li
              key={item.id}
              className="animate-in flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-border-strong sm:gap-3 sm:px-4 sm:py-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary" title={item.text}>
                {item.text}
              </span>
              <span className="hidden shrink-0 font-mono text-[10.5px] text-text-muted sm:block">
                {formatDateTime(item.createdAt)}
              </span>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={() => setAction({ itemId: item.id, mode: 'move' })}
                  title="Move to board"
                  className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover"
                >
                  <FolderInput size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setAction({ itemId: item.id, mode: 'schedule' })}
                  title="Schedule"
                  className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover"
                >
                  <CalendarPlus size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => dismissInboxItem(item.id)}
                  title="Dismiss"
                  className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {action && (
        <InboxActionModal
          itemId={action.itemId}
          mode={action.mode}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  )
}
