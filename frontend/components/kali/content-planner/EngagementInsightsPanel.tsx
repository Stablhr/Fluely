'use client'

import { useMemo } from 'react'
import { Activity, BarChart3, CalendarHeart } from 'lucide-react'
import type { SocialPost } from '@/lib/kali/store/schema'
import SectionLabel from '../shared/SectionLabel'

/**
 * What the planner can say truthfully about published posts. Reach and
 * engagement are not read from LinkedIn or Facebook yet, so instead of
 * inventing numbers the panel says so; the posting-time hint comes from the
 * person's own schedule.
 */
export default function EngagementInsightsPanel({ socialPosts }: { socialPosts: SocialPost[] }) {
  const publishedCount = socialPosts.filter((p) => p.status === 'posted').length

  const bestTimes = useMemo(() => {
    const buckets: Record<number, number> = {}
    for (const p of socialPosts) {
      if (!p.scheduledTime) continue
      const h = Number(p.scheduledTime.split(':')[0])
      if (Number.isInteger(h)) buckets[h] = (buckets[h] ?? 0) + 1
    }
    return Object.entries(buckets)
      .map(([hour, count]) => ({ hour: Number(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ hour: h }) => (h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`))
  }, [socialPosts])

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div>
        <SectionLabel icon={<Activity size={12} />}>Engagement</SectionLabel>
        <p className="mt-1 text-[11px] text-text-muted">
          {publishedCount === 1 ? '1 post published' : `${publishedCount} posts published`}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong p-6 text-center">
        <BarChart3 size={22} className="text-text-muted" aria-hidden="true" />
        <p className="text-xs text-text-muted">
          Reach and engagement aren&apos;t connected yet. They&apos;ll show here once Fluely reads them from
          LinkedIn and Facebook.
        </p>
      </div>

      {bestTimes.length > 0 && (
        <div>
          <SectionLabel icon={<CalendarHeart size={12} />}>Your usual posting times</SectionLabel>
          <p className="mt-1 text-[11px] leading-snug text-text-secondary">
            You schedule most often at <span className="font-semibold text-primary">{bestTimes.join(', ')}</span>.
          </p>
        </div>
      )}
    </div>
  )
}
