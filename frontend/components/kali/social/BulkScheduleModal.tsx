'use client'

import { useState } from 'react'
import { CalendarDays, Loader2, Clock, CheckCircle2, X } from 'lucide-react'
import { Input } from '../shared/Input'
import SectionLabel from '../shared/SectionLabel'
import Button from '../shared/Button'
import { useStore } from '@/lib/kali/store/useStore'
import { COMMON_TIMEZONES, getBrowserTimezone } from '@/lib/kali/utils/timezones'
import type { SocialPost } from '@/lib/kali/store/schema'

export default function BulkScheduleModal({
  posts,
  onClose,
}: {
  posts: SocialPost[]
  onClose: () => void
}) {
  const { scheduleSocialPost, refreshSocialJobs } = useStore()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [timezone, setTimezone] = useState(getBrowserTimezone())
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ ok: number; total: number } | null>(null)

  const scheduleAll = async () => {
    if (!date) return
    setBusy(true)
    let ok = 0
    for (const post of posts) {
      const r = await scheduleSocialPost(post.id, {
        scheduledDate: date,
        scheduledTime: time || undefined,
        timezone,
        repeat: post.repeat,
        repeatUntil: post.repeatUntil,
      })
      if (r.ok) ok += 1
    }
    await refreshSocialJobs()
    setDone({ ok, total: posts.length })
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f1a19]/50" onClick={onClose} />
      <div className="animate-in relative z-10 w-full max-w-md rounded-[14px] border border-border bg-surface p-4 shadow-modal">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text-primary">Schedule {posts.length} post{posts.length === 1 ? '' : 's'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded p-1 text-text-muted hover:bg-surface-alt hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <SectionLabel>Date</SectionLabel>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <SectionLabel>Time</SectionLabel>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
          </div>
          <div>
            <SectionLabel>Timezone</SectionLabel>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
            >
              <option value={getBrowserTimezone()}>Browser timezone ({getBrowserTimezone() || 'UTC'})</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {done ? (
            <div className="flex items-center gap-2 rounded-md bg-success-subtle px-3 py-2 text-sm text-success-text">
              <CheckCircle2 size={15} />
              Scheduled {done.ok} of {done.total}
            </div>
          ) : (
            <p className="flex items-center gap-1 text-xs text-text-muted">
              <Clock size={12} />
              All selected posts will be validated and queued for {date || '(pick a date)'}{time ? ` ${time}` : ''} ({timezone})
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={scheduleAll} disabled={!date || busy || !!done}>
            {busy ? <><Loader2 size={14} className="animate-spin" />Scheduling…</> : done ? 'Done' : 'Schedule All'}
          </Button>
        </div>
      </div>
    </div>
  )
}
