'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, CalendarDays, ListTodo, Plus, Send } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { YOU_ID } from '@/lib/kali/store/schema'
import CreateBoardModal from '../boards/CreateBoardModal'
import DashboardSkeleton from './DashboardSkeleton'
import DueSoonList from './DueSoonList'
import KpiCard from './KpiCard'
import RecentBoardsList from './RecentBoardsList'
import UpcomingPosts from './UpcomingPosts'
import WorkloadChart from './WorkloadChart'
import { useDashboardData } from './useDashboardData'

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function DashboardView() {
  const { data, boardsLoaded } = useStore()
  const d = useDashboardData()
  const [creating, setCreating] = useState(false)

  if (!boardsLoaded && Object.keys(data.boards).length === 0) return <DashboardSkeleton />

  const now = new Date()
  const firstName = (data.members[YOU_ID]?.name ?? '').trim().split(/\s+/)[0]
  const today = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="scroll-slim h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:px-8 lg:py-7">
        <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-text-muted">{today}</p>
            <h1 className="mt-1 text-balance text-display text-text-primary">
              {greeting(now)}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/schedule"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-2 text-[13px] font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-primary"
            >
              <CalendarDays size={15} aria-hidden />
              View schedule
            </Link>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="btn-sheen inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus size={15} aria-hidden />
              New board
            </button>
          </div>
        </header>

        <h2 className="sr-only">Overview</h2>
        <div className="stagger mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            href="/boards"
            icon={ListTodo}
            label="Open tasks"
            value={d.openCount}
            hint={d.openCount ? `Across ${plural(d.boardsWithOpen, 'board')}` : 'Nothing open'}
          />
          <KpiCard
            href="/schedule"
            icon={CalendarClock}
            label="Due this week"
            value={d.dueThisWeekCount}
            hint={d.dueTodayCount ? `${d.dueTodayCount} due today` : 'None due today'}
          />
          <KpiCard
            href="/schedule"
            icon={AlertTriangle}
            label="Overdue"
            value={d.overdueCount}
            hint={d.overdueCount ? 'Needs attention' : 'Nothing overdue'}
            attention={d.overdueCount > 0}
          />
          <KpiCard
            href="/content-planner"
            icon={Send}
            label="Scheduled posts"
            value={d.postsThisWeekCount}
            hint="Next 7 days"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="stagger flex min-w-0 flex-col gap-4">
            <WorkloadChart week={d.week} />
            <DueSoonList groups={d.dueGroups} boards={d.boards} />
          </div>
          <div className="stagger flex min-w-0 flex-col gap-4">
            <UpcomingPosts posts={d.upcomingPosts} />
            <RecentBoardsList boards={d.recentBoards} />
          </div>
        </div>
      </div>

      <CreateBoardModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
