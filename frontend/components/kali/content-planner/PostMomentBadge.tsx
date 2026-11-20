'use client'

import { AlertTriangle, BellRing, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import type { SocialPost } from '@/lib/kali/store/schema'
import { formatMoment, postMoment, type PostMomentKind } from './planner-model'

const TONE: Record<PostMomentKind, string> = {
  scheduled: 'bg-primary-subtle text-primary-text',
  publishing: 'bg-primary-subtle text-primary-text',
  posted: 'bg-success-subtle text-success-text',
  partial: 'bg-warning-subtle text-warning-text',
  failed: 'bg-danger-subtle text-danger-text',
  reminder: 'bg-warning-subtle text-warning-text',
}

const ICON: Record<PostMomentKind, typeof Clock> = {
  scheduled: Clock,
  publishing: Loader2,
  posted: CheckCircle2,
  partial: AlertTriangle,
  failed: AlertTriangle,
  reminder: BellRing,
}

/**
 * "Scheduled · Thu, 19 Nov, 10:20 PM" / "Posted · …" / "Failed". Renders
 * nothing for posts still in planning (idea, draft, review).
 */
export default function PostMomentBadge({
  post,
  size = 'sm',
  className = '',
}: {
  post: SocialPost
  size?: 'xs' | 'sm'
  className?: string
}) {
  const moment = postMoment(post)
  if (!moment) return null
  const Icon = ICON[moment.kind]
  const text = moment.at ? `${moment.label} · ${formatMoment(moment.at)}` : moment.label
  return (
    <span
      title={text}
      className={`inline-flex max-w-full items-center gap-1 rounded-full font-semibold ${
        size === 'xs' ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-0.5 text-[11px]'
      } ${TONE[moment.kind]} ${className}`}
    >
      <Icon size={size === 'xs' ? 10 : 11} className={`shrink-0 ${moment.kind === 'publishing' ? 'animate-spin' : ''}`} />
      <span className="truncate">{text}</span>
    </span>
  )
}
