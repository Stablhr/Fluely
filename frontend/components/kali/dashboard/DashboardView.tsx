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

export default function DashboardView() {
  const { data } = useStore()

  const boardCount = Object.keys(data.boards).length
  const dueThisWeek = Object.values(data.cards).filter(
    (c) => !c.done && c.dueDate && isDueThisWeek(c.dueDate),
  ).length
  const inboxCount = data.inbox.length
  const starredCount = Object.values(data.boards).filter((b) => b.starred).length

  return (
    <div className="scroll-slim h-full overflow-y-auto p-4 sm:p-6 lg:px-8 lg:py-6">
      <h1 className="text-display text-ink-900">Dashboard</h1>
      <p className="mt-1 text-body text-ink-500">Welcome back — here&apos;s what needs attention.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <HeroCard />
        <div className="grid grid-cols-2 gap-4">
          <StatCard tone="purple" label="Boards" value={boardCount} />
          <StatCard tone="green" label="Due this week" value={dueThisWeek} />
          <StatCard tone="yellow" label="Inbox unread" value={inboxCount} />
          <StatCard tone="teal" label="Starred boards" value={starredCount} />
        </div>
      </div>

      <div className="mt-6 max-w-md">
        <CaptureBox variant="dash" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <DueSoonList />
          <RecentBoardsList />
        </div>
        <div className="h-max space-y-4">
          <PlannerPreview />
          <PromoCard />
        </div>
      </div>
    </div>
  )
}