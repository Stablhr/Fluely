'use client'

import { useMemo } from 'react'
import { Eye, ThumbsUp, BarChart3, TrendingUp, Clock3, CalendarHeart, Trophy, Activity } from 'lucide-react'
import type { SocialPost, Platform } from '@/lib/kali/store/schema'
import { PLATFORM_COLORS } from '@/lib/kali/store/schema'
import SectionLabel from '../shared/SectionLabel'
import PlatformIcon from '../social/PlatformIcon'
import { generateAllMockAnalytics, computeSummary } from '@/lib/kali/utils/analytics'

function SummaryCard({ label, value, icon: Icon, hint, accent }: {
  label: string
  value: string
  icon: typeof Eye
  hint?: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between">
        <Icon size={13} className={accent ?? 'text-primary'} />
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-lg font-bold leading-tight text-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-text-muted">{hint}</p>}
    </div>
  )
}

const PLATFORM_ORDER: Platform[] = ['facebook', 'instagram', 'youtube', 'tiktok']

const AUDIENCE_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
const AUDIENCE_LEVELS = [1, 2, 3, 1, 2, 4, 5, 3, 2, 2, 2, 3, 2, 3, 5, 6, 8, 7, 6, 4, 3, 2, 1]

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function EngagementInsightsPanel({ socialPosts }: { socialPosts: SocialPost[] }) {
  const summarized = useMemo(() => {
    const posted = socialPosts.filter((p) => p.status === 'posted')
    const all = generateAllMockAnalytics(posted)
    return computeSummary(posted, all)
  }, [socialPosts])

  const hasData = summarized.totalReach > 0
  const engagementRate = (summarized.avgEngagementRate * 100).toFixed(1)

  const bestTimes = useMemo(() => {
    const buckets: Record<number, number> = {}
    for (let h = 6; h <= 22; h += 1) buckets[h] = 0
    for (const p of socialPosts) {
      if (!p.scheduledTime) continue
      const h = Number(p.scheduledTime.split(':')[0])
      if (buckets[h] !== undefined) buckets[h] += 1
    }
    return Object.entries(buckets)
      .map(([hour, count]) => ({ hour: Number(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((b) => {
        const h = b.hour
        return h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`
      })
  }, [socialPosts])

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div>
        <SectionLabel icon={<Activity size={12} />}>Engagement</SectionLabel>
        <p className="mt-1 text-[11px] text-text-muted">Last 7 days · demo data</p>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong p-6 text-center">
          <BarChart3 size={22} className="text-text-muted" />
          <p className="text-xs text-text-muted">
            No published posts yet. Publish content to see engagement insights here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard label="Reach" value={formatNum(summarized.totalReach)} icon={Eye} />
            <SummaryCard
              label="Engagement"
              value={formatNum(summarized.totalEngagements)}
              icon={ThumbsUp}
              accent="text-success-text"
            />
            <SummaryCard
              label="Impressions"
              value={formatNum(summarized.totalImpressions)}
              icon={BarChart3}
              accent="text-info-text"
            />
            <SummaryCard
              label="Eng. Rate"
              value={`${engagementRate}%`}
              icon={TrendingUp}
              accent="text-warning-text"
            />
          </div>

          <div>
            <SectionLabel>Platform Breakdown</SectionLabel>
            <div className="mt-2 space-y-1.5">
              {PLATFORM_ORDER.map((platform) => {
                const row = summarized.platformBreakdown.find((pb) => pb.platform === platform)
                const max = Math.max(1, ...summarized.platformBreakdown.map((pb) => pb.reach))
                const reach = row?.reach ?? 0
                const pct = Math.max(4, Math.round((reach / max) * 100))
                return (
                  <div key={platform} className="flex items-center gap-2">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: PLATFORM_COLORS[platform] }}
                    >
                      <PlatformIcon platform={platform} size={9} />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: PLATFORM_COLORS[platform] }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-[10px] text-text-muted">
                      {formatNum(reach)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <SectionLabel icon={<Clock3 size={12} />}>Audience Activity</SectionLabel>
            <p className="mt-1 text-[10.5px] text-text-muted">Follower activity by hour of day</p>
            <div className="mt-2 flex items-end gap-0.5">
              {AUDIENCE_HOURS.map((h, i) => {
                const level = AUDIENCE_LEVELS[i]
                const height = 12 + level * 5
                return (
                  <div
                    key={h}
                    title={`${h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}`}
                    className="flex-1 rounded-t-sm bg-primary/45"
                    style={{ height }}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <SectionLabel icon={<CalendarHeart size={12} />}>Best Time to Post</SectionLabel>
            <p className="mt-1 text-[11px] leading-snug text-text-secondary">
              Based on your schedule, your highest-impact windows are{' '}
              <span className="font-semibold text-primary">
                {bestTimes.length > 0 ? bestTimes.join(', ') : 'mornings & evenings'}
              </span>
              . Aim to publish within these slots for maximum visibility.
            </p>
          </div>

          <div>
            <SectionLabel icon={<Trophy size={12} />}>Top Performing Post</SectionLabel>
            {summarized.topPosts.length > 0 ? (
              <div className="mt-2 rounded-lg border border-border bg-surface p-2.5">
                <p className="truncate text-xs font-medium text-text-primary">
                  {summarized.topPosts[0].post.title || 'Untitled'}
                </p>
                <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-text-muted">
                  <span>{formatNum(summarized.topPosts[0].reach)} reach</span>
                  <span>{(summarized.topPosts[0].engagementRate * 100).toFixed(1)}% rate</span>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-text-muted">No posts yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}