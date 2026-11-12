'use client'

import { isDueThisWeek } from '@/lib/kali/utils/dates'
import { useStore } from '@/lib/kali/store/useStore'
import CaptureBox from '../shared/CaptureBox'
import DueSoonList from './DueSoonList'
import RecentBoardsList from './RecentBoardsList'
import PlannerPreview from './PlannerPreview'
import HeroCard from './HeroCard'
import PromoCard from './PromoCard'
import StatCard from './StatCard'
import DashboardSkeleton from './DashboardSkeleton'

export default function DashboardView() {
  const { data, unreadNotificationCount, boardsLoaded } = useStore()

  const boardCount = Object.keys(data.boards).length
  const dueThisWeek = Object.values(data.cards).filter(
    (c) => !c.done && c.dueDate && isDueThisWeek(c.dueDate),
  ).length
  const starredCount = Object.values(data.boards).filter((b) => b.starred).length

  if (!boardsLoaded && boardCount === 0) return <DashboardSkeleton />

  return (
    <div className="scroll-slim h-full overflow-y-auto p-4 sm:p-6 lg:px-8 lg:py-6">
      <div className="animate-rise">
        <h1 className="text-display text-ink-900">Dashboard</h1>
        <p className="mt-1 text-body text-ink-500">Welcome back — here&apos;s what needs attention.</p>
      </div>

      <div className="stagger mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <HeroCard />
        <div className="stagger grid grid-cols-2 gap-4">
          <StatCard tone="green" label="Boards" value={boardCount} />
          <StatCard tone="vanilla" label="Due this week" value={dueThisWeek} />
          <StatCard tone="blue" label="Notifications" value={unreadNotificationCount} />
          <StatCard tone="white" label="Starred boards" value={starredCount} />
        </div>
      </div>

      <div className="animate-rise mt-6 max-w-md" style={{ animationDelay: '120ms' }}>
        <CaptureBox variant="dash" />
      </div>

      <div className="stagger mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-[1fr_320px]">
        <div className="stagger space-y-4">
          <DueSoonList />
          <RecentBoardsList />
        </div>
        <div className="stagger h-max space-y-4">
          <PlannerPreview />
          <PromoCard />
        </div>
      </div>
    </div>
  )
}
