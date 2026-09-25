'use client'

import { useState } from 'react'
import { Plus, Inbox, FolderInput, Sparkles } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'

const SAMPLES = [
  'Sample: prep the Q3 campaign deck',
  'Sample: review the launch landing page',
  'Sample: draft the weekly content post',
  'Sample: reply to designer feedback',
]

const STEPS = [
  { icon: Plus, label: 'Type a task above' },
  { icon: Inbox, label: 'It lands here' },
  { icon: FolderInput, label: 'Move or schedule it' },
]

export default function InboxEmptyState() {
  const addInboxItem = useStore().addInboxItem
  const [index, setIndex] = useState(0)

  const addSample = () => {
    addInboxItem(SAMPLES[index % SAMPLES.length])
    setIndex((i) => i + 1)
  }

  return (
    <div className="animate-in rounded-card bg-base-surface p-8 text-center shadow-card sm:p-10">
      {/* Animated "capture" demo */}
      <div className="relative mx-auto flex h-20 w-24 items-end justify-center">
        <span
          className="absolute left-1/2 top-0 flex w-16 -translate-x-1/2 animate-drop items-center gap-1 rounded-chip border border-border bg-base-surface px-2 py-1.5 shadow-card"
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
          <span className="h-1.5 w-3 rounded-full bg-accent-teal-text" />
        </span>
        <span className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary-hover">
          <Inbox size={22} />
        </span>
      </div>

      <h2 className="mt-5 text-card-title text-ink-900">Your inbox is ready</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-body text-ink-500">
        Anything you jot down in the capture box collects here until you move it to a board or schedule it.
      </p>

      <ol className="mt-6 flex items-center justify-center gap-2 sm:gap-3">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && <span className="h-px w-4 shrink-0 bg-border" aria-hidden="true" />}
            <span className="flex flex-col items-center gap-1.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-accent-teal-bg text-accent-teal-text">
                <Icon size={14} />
              </span>
              <span className="max-w-20 text-[10.5px] font-medium text-ink-500">{label}</span>
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={addSample}
        className="mt-7 inline-flex h-8 items-center gap-1.5 rounded-pill bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
      >
        <Sparkles size={14} />
        Capture a sample task
      </button>
    </div>
  )
}