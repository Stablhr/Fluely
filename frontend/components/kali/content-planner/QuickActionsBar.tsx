'use client'

import { Plus, Link2, CalendarClock } from 'lucide-react'
import Button from '../shared/Button'

interface QuickActionsBarProps {
  onNewPost: () => void
  onConnectAccount: () => void
  onBulkSchedule: () => void
}

export default function QuickActionsBar({ onNewPost, onConnectAccount, onBulkSchedule }: QuickActionsBarProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="primary" size="sm" onClick={onNewPost}>
        <Plus size={14} />
        <span className="hidden sm:inline">New Post</span>
      </Button>
      <Button variant="secondary" size="sm" onClick={onBulkSchedule}>
        <CalendarClock size={13} />
        <span className="hidden sm:inline">Schedule</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onConnectAccount}>
        <Link2 size={13} />
        <span className="hidden sm:inline">Connect</span>
      </Button>
    </div>
  )
}