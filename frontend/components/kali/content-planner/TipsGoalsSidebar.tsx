'use client'

import { useMemo, useState } from 'react'
import {
  Lightbulb,
  Target,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  CalendarCheck,
  ExternalLink,
  Clock,
  Flame,
  LayoutGrid,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SocialPost, Platform } from '@/lib/kali/store/schema'
import SectionLabel from '../shared/SectionLabel'

interface Tip {
  icon: LucideIcon
  title: string
  body: string
  link?: string
  linkLabel?: string
}

const TIPS: Tip[] = [
  {
    icon: Sparkles,
    title: 'Post consistently',
    body: 'Brands that post 4–7 times per week see up to 2x more engagement. Use the grid to fill gaps in your week.',
  },
  {
    icon: Clock,
    title: 'Time it right',
    body: 'Posting between 11 AM–1 PM and 6–8 PM aligns with peak scroll times. Batch content for those windows.',
  },
  {
    icon: CalendarCheck,
    title: 'Plan ahead',
    body: 'Scheduling 3+ days out reduces last-minute rushed posts and keeps your tone consistent.',
  },
  {
    icon: ExternalLink,
    title: 'Cross-post wisely',
    body: 'Repurpose top-performing content to other platforms. Tailor captions: shorter for TikTok, detailed for YouTube.',
  },
  {
    icon: LayoutGrid,
    title: 'Balance formats',
    body: 'Mix short videos, images, and carousels. Video content tends to drive the highest reach on most platforms.',
  },
  {
    icon: Flame,
    title: 'Reuse what works',
    body: 'Analyze your top 3 posts each month and recreate their structure with fresh topics to keep momentum.',
  },
]

interface Goal {
  label: string
  value: number
  target: number
  unit: string
  display?: string
}

function GoalRow({ goal, color }: { goal: Goal; color: string }) {
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.value / goal.target) * 100)) : 0
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-text-primary">{goal.label}</p>
        <span className="shrink-0 font-mono text-[10.5px] text-text-muted">
          {goal.display ?? `${goal.value}/${goal.target} ${goal.unit}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1 font-mono text-[9.5px] text-text-muted">{pct}% complete</p>
    </div>
  )
}

export default function TipsGoalsSidebar({ activeTab, socialPosts }: {
  activeTab: 'tips' | 'goals'
  socialPosts: SocialPost[]
}) {
  const [tipIndex, setTipIndex] = useState(0)

  const goals = useMemo(() => {
    const scheduledThisWeek = socialPosts.filter((p) => p.status === 'scheduled').length
    const planned = socialPosts.filter((p) => p.status === 'scheduled' || p.status === 'posted')
    const platformsCovered = new Set<Platform>(
      planned.flatMap((p) => p.platforms.filter((x) => x.enabled).map((x) => x.platform)),
    ).size
    const draftCount = socialPosts.filter((p) => p.status === 'draft').length
    const scheduledDays = new Set(
      socialPosts.filter((p) => p.scheduledDate).map((p) => p.scheduledDate as string),
    ).size
    const goalsList: Goal[] = [
      { label: 'Weekly posts', value: scheduledThisWeek, target: 7, unit: 'posts' },
      { label: 'Platforms covered', value: platformsCovered, target: 4, unit: 'platforms' },
      { label: 'Days planned this week', value: scheduledDays, target: 7, unit: 'days' },
      { label: 'Engagement rate target', value: 4.2, target: 5, unit: '%', display: '4.2% / 5%' },
      { label: 'Draft backlog', value: draftCount, target: 5, unit: 'drafts' },
    ]
    return goalsList
  }, [socialPosts])

  const goalColors = ['#3971b8', '#ff0000', '#1877f2', '#e4405f', '#33b27a']
  const tip = TIPS[tipIndex % TIPS.length]
  const TipIcon = tip.icon

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-3">
        <SectionLabel icon={<Target size={12} />}>
          {activeTab === 'tips' ? 'Tips' : 'Goals'}
        </SectionLabel>
      </div>

      {activeTab === 'tips' ? (
        <div className="flex flex-1 flex-col justify-between gap-4 p-3 pt-0">
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <TipIcon size={14} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[12px] font-semibold leading-tight text-text-primary">{tip.title}</h3>
                <p className="mt-1 text-[11.5px] leading-snug text-text-secondary">{tip.body}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setTipIndex((i) => (i - 1 + TIPS.length) % TIPS.length)}
                aria-label="Previous tip"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="flex items-center gap-1">
                {TIPS.map((t, i) => (
                  <button
                    key={t.title}
                    type="button"
                    aria-label={`Go to tip ${i + 1}`}
                    onClick={() => setTipIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-150 ${
                      i === tipIndex % TIPS.length ? 'w-4 bg-primary' : 'w-1.5 bg-border-strong hover:bg-text-muted'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTipIndex((i) => (i + 1) % TIPS.length)}
                aria-label="Next tip"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-text-muted">
              <Lightbulb size={10} />
              Tip {tipIndex + 1} of {TIPS.length}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3 pt-0">
          {goals.map((g, i) => (
            <GoalRow key={g.label} goal={g} color={goalColors[i % goalColors.length]} />
          ))}
          <p className="mt-1 px-0.5 text-[10.5px] leading-snug text-text-muted">
            Goals update automatically as you schedule and publish content.
          </p>
        </div>
      )}
    </div>
  )
}