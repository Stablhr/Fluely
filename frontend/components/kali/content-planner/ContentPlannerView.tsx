'use client'

import { useState, useCallback, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { CalendarRange, ChevronLeft, ChevronRight, BarChart3, Lightbulb, GripVertical, X } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { SocialPost } from '@/lib/kali/store/schema'
import { addDays, formatDate, startOfWeek, toISODate } from '@/lib/kali/utils/dates'
import ComposeModal from '../social/ComposeModal'
import PostDetailModal from '../social/PostDetailModal'
import BulkScheduleModal from '../social/BulkScheduleModal'
import AccountConnectionPanel from '../social/AccountConnectionPanel'
import ContentUnscheduledPool from './ContentUnscheduledPool'
import WeeklyTimeGrid from './WeeklyTimeGrid'
import PlatformFilterBar from './PlatformFilterBar'
import QuickActionsBar from './QuickActionsBar'
import EngagementInsightsPanel from './EngagementInsightsPanel'
import TipsGoalsSidebar from './TipsGoalsSidebar'
import { hourToTime, parseSlotId } from './types'
import type { PlatformFilter, SidebarTab } from './types'

const DAY_COUNT = 7
const MIN_CALENDAR_WIDTH = 820

export default function ContentPlannerView() {
  const { socialPosts, moveSocialPost } = useStore()
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek())
  const [composeOpen, setComposeOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null)
  const [composeDate, setComposeDate] = useState<string | undefined>()
  const [composeTime, setComposeTime] = useState<string | undefined>()
  const [detailPostId, setDetailPostId] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab | null>('engagement')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)

  const [calendarWidth, setCalendarWidth] = useState<number | null>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const handleDragStart = useCallback(
    (e: ReactMouseEvent) => {
      isDragging.current = true
      dragStartX.current = e.clientX
      dragStartWidth.current = calendarWidth ?? MIN_CALENDAR_WIDTH
      e.preventDefault()

      const handleMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const delta = ev.clientX - dragStartX.current
        const newWidth = Math.max(MIN_CALENDAR_WIDTH, dragStartWidth.current + delta)
        setCalendarWidth(newWidth)
      }

      const handleUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [calendarWidth],
  )

  const days = Array.from({ length: DAY_COUNT }, (_, i) => addDays(weekStart, i))

  const filteredPosts = socialPosts.filter((p) => {
    if (platformFilter === 'all') return true
    return p.platforms.some((x) => x.enabled && x.platform === platformFilter)
  })

  const poolPosts = filteredPosts
    .filter((p) => !p.scheduledDate)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const gridPosts = filteredPosts.filter((p) => p.scheduledDate)

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result
    if (!destination) return
    const destId = destination.droppableId

    if (destId === 'unscheduled-pool') {
      moveSocialPost(draggableId, '')
      return
    }

    const slot = destId.startsWith('slot_') ? parseSlotId(destId) : null
    if (!slot) return
    moveSocialPost(draggableId, slot.date, hourToTime(slot.hour))
  }

  const openCompose = (date?: string, time?: string) => {
    setEditingPost(null)
    setComposeDate(date)
    setComposeTime(time)
    setComposeOpen(true)
  }

  const handleSlotClick = (date: string, hour: number) => {
    openCompose(date, hourToTime(hour))
  }

  const handlePostClick = (post: SocialPost) => {
    setDetailPostId(post.id)
  }

  const handleEditFromDetail = (post: SocialPost) => {
    setDetailPostId(null)
    setEditingPost(post)
    setComposeDate(undefined)
    setComposeTime(undefined)
    setComposeOpen(true)
  }

  const handleCloseCompose = () => {
    setComposeOpen(false)
    setEditingPost(null)
    setComposeDate(undefined)
    setComposeTime(undefined)
  }

  const toggleSidebar = (tab: SidebarTab) => {
    setSidebarTab((prev) => (prev === tab ? null : tab))
  }

  const weekLabel = `${formatDate(toISODate(days[0]))} – ${formatDate(toISODate(days[6]))}`
  const showBulk = bulkOpen && filteredPosts.some((p) => !p.scheduledDate)
  const navButtonClass =
    'flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover active:scale-[0.98]'

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={18} className="shrink-0 text-primary" />
          <h1 className="text-lg font-semibold text-text-primary sm:text-xl">Content Planner</h1>
        </div>

        <div className="ml-1 flex items-center gap-1 sm:ml-2">
          <button
            type="button"
            className={navButtonClass}
            title="Previous week"
            aria-label="Go to previous week"
            onClick={() => setWeekStart((w) => addDays(w, -DAY_COUNT))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek())}
            aria-label="Go to current week"
            className="rounded-md px-2 py-1 text-xs font-semibold text-primary-hover transition-colors duration-150 hover:bg-primary-subtle active:scale-[0.98]"
          >
            Today
          </button>
          <button
            type="button"
            className={navButtonClass}
            title="Next week"
            aria-label="Go to next week"
            onClick={() => setWeekStart((w) => addDays(w, DAY_COUNT))}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <span className="ml-1 font-mono text-[11px] text-text-secondary sm:ml-2">{weekLabel}</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden min-w-0 xl:block">
            <PlatformFilterBar active={platformFilter} onChange={setPlatformFilter} />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleSidebar('engagement')}
              aria-pressed={sidebarTab === 'engagement'}
              title="Toggle engagement insights"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                sidebarTab === 'engagement'
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              <BarChart3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => toggleSidebar(sidebarTab === 'tips' || sidebarTab === 'goals' ? sidebarTab : 'tips')}
              aria-pressed={sidebarTab === 'tips' || sidebarTab === 'goals'}
              title="Toggle tips and goals"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                sidebarTab === 'tips' || sidebarTab === 'goals'
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              <Lightbulb size={15} />
            </button>
          </div>

          <QuickActionsBar
            onNewPost={() => openCompose()}
            onBulkSchedule={() => setBulkOpen(true)}
            onConnectAccount={() => setAccountsOpen(true)}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="scroll-slim flex h-full min-h-0 gap-3 overflow-x-auto p-3">
            <ContentUnscheduledPool posts={poolPosts} onPostClick={handlePostClick} />
            <div
              className="flex shrink-0 items-center"
              onMouseDown={handleDragStart}
              title="Drag to resize calendar"
            >
              <div className="mx-0.5 flex h-8 w-1.5 cursor-col-resize items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border hover:text-text-secondary">
                <GripVertical size={12} />
              </div>
            </div>
            <WeeklyTimeGrid
              days={days}
              posts={gridPosts}
              onPostClick={handlePostClick}
              onSlotClick={handleSlotClick}
              style={calendarWidth != null ? { width: calendarWidth, flex: 'none' } : undefined}
            />
          </div>
        </DragDropContext>

        {sidebarTab && (
          <aside className="hidden h-full w-[240px] shrink-0 flex-col border-l border-border bg-surface md:flex lg:w-[270px]">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSidebarTab('engagement')}
                  aria-pressed={sidebarTab === 'engagement'}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                    sidebarTab === 'engagement'
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  Engagement
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('tips')}
                  aria-pressed={sidebarTab === 'tips'}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                    sidebarTab === 'tips'
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  Tips
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('goals')}
                  aria-pressed={sidebarTab === 'goals'}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                    sidebarTab === 'goals'
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  Goals
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSidebarTab(null)}
                aria-label="Close sidebar"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>

            {sidebarTab === 'engagement' ? (
              <EngagementInsightsPanel socialPosts={socialPosts} />
            ) : (
              <TipsGoalsSidebar activeTab={sidebarTab} socialPosts={socialPosts} />
            )}
          </aside>
        )}
      </div>

      {composeOpen && (
        <ComposeModal
          post={editingPost}
          initialDate={composeDate}
          initialTime={composeTime}
          onClose={handleCloseCompose}
        />
      )}

      {detailPostId && (
        <PostDetailModal
          postId={detailPostId}
          onClose={() => setDetailPostId(null)}
          onEdit={handleEditFromDetail}
        />
      )}

      {showBulk && (
        <BulkScheduleModal
          posts={filteredPosts.filter((p) => !p.scheduledDate)}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {accountsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="animate-in w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-modal">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Connected Accounts</h2>
              <button
                type="button"
                onClick={() => setAccountsOpen(false)}
                aria-label="Close connected accounts"
                className="rounded p-1 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>
            <AccountConnectionPanel />
          </div>
        </div>
      )}
    </div>
  )
}