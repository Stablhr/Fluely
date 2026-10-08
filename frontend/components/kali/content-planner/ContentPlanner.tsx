'use client'

import { useCallback, useMemo, useState } from 'react'
import { LayoutGrid, CalendarRange, Table2, Plus, BarChart3, Lightbulb } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { Platform, SocialPostStatus } from '@/lib/kali/store/schema'
import Button from '../shared/Button'
import PlatformOverview from './PlatformOverview'
import PostDetailPanel from './PostDetailPanel'
import ContentPlannerCalendar from './ContentPlannerCalendar'
import ContentPlannerBoard from './ContentPlannerBoard'
import ContentPlannerTable from './ContentPlannerTable'
import EngagementInsightsPanel from './EngagementInsightsPanel'
import TipsGoalsSidebar from './TipsGoalsSidebar'
import PlatformFilterBar from './PlatformFilterBar'
import { enabledPlatforms } from './planner-model'
import type { PlatformFilter, SidebarTab } from './types'

type ViewId = 'calendar' | 'board' | 'table'

const VIEWS: { id: ViewId; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'calendar', label: 'Calendar', Icon: CalendarRange },
  { id: 'board', label: 'Board', Icon: LayoutGrid },
  { id: 'table', label: 'Table', Icon: Table2 },
]

/** What the editor should prefill when it opens in create mode. */
interface CreateIntent {
  date?: string
  time?: string
}

export default function ContentPlanner() {
  const { socialPosts, addSocialPost } = useStore()

  const [view, setView] = useState<ViewId>('calendar')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab | null>(null)
  // null = editor closed. `undefined` in the intent = create mode.
  const [editing, setEditing] = useState<string | null | undefined>(undefined)
  const [intent, setIntent] = useState<CreateIntent>({})

  const closePanel = useCallback(() => {
    setEditing(undefined)
    setIntent({})
  }, [])

  const openCreate = useCallback((next: CreateIntent = {}) => {
    setIntent(next)
    setEditing(null)
  }, [])

  const openPost = useCallback((id: string) => {
    setIntent({})
    setEditing(id)
  }, [])

  /* One filtered list feeds the overview and all three views, so switching tabs
     or toggling a platform can never desync what the counts say from what the
     grid shows. */
  const filtered = useMemo(
    () =>
      platformFilter === 'all'
        ? socialPosts
        : socialPosts.filter((p) => enabledPlatforms(p).includes(platformFilter as Platform)),
    [socialPosts, platformFilter],
  )

  const handleCreateIn = useCallback(
    (status: SocialPostStatus) => {
      // Honour the column the user clicked: seed a real post straight away so
      // the card is already in the right stage, then hand it to the editor.
      const created = addSocialPost({
        title: '',
        caption: '',
        platforms: [
          {
            platform: 'instagram',
            enabled: true,
            status: 'pending',
            caption: '',
            hashtags: [],
            mentions: [],
            visibility: 'public',
          },
        ],
        media: [],
        tags: [],
        status,
        repeat: 'none',
      })
      setIntent({})
      setEditing(created.id)
    },
    [addSocialPost],
  )

  const toggleSidebar = (tab: SidebarTab) =>
    setSidebarTab((prev) => (prev === tab ? null : tab))

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5 sm:px-4">
        <h1 className="font-heading text-lg font-semibold text-text-primary sm:text-xl">Social Posting</h1>

        <nav aria-label="Planner view" className="ml-2 flex items-center gap-0.5 rounded-lg bg-surface-alt p-0.5">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150 ${
                view === id
                  ? 'bg-surface text-text-primary shadow-subtle'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden xl:block">
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
              onClick={() => toggleSidebar('tips')}
              aria-pressed={sidebarTab === 'tips'}
              title="Toggle tips and goals"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                sidebarTab === 'tips'
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              <Lightbulb size={15} />
            </button>
          </div>

          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus size={14} />
            New post
          </Button>
        </div>
      </header>

      <div className="shrink-0 px-3 pt-3 sm:px-4">
        <PlatformOverview posts={socialPosts} active={platformFilter} onSelect={setPlatformFilter} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === 'calendar' && (
            <ContentPlannerCalendar posts={filtered} onOpenPost={openPost} onCreateOn={(date) => openCreate({ date })} />
          )}
          {view === 'board' && (
            <ContentPlannerBoard posts={filtered} onOpenPost={openPost} onCreateIn={handleCreateIn} />
          )}
          {view === 'table' && <ContentPlannerTable posts={filtered} onOpenPost={openPost} />}
        </div>

        {sidebarTab && (
          <aside className="hidden h-full w-[240px] shrink-0 flex-col border-l border-border bg-surface md:flex lg:w-[270px]">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-2 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {sidebarTab === 'engagement' ? 'Engagement' : 'Tips'}
              </span>
              <button
                type="button"
                onClick={() => setSidebarTab(null)}
                aria-label="Close sidebar"
                className="rounded-md px-1 py-0.5 text-[11px] font-semibold text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
              >
                Close
              </button>
            </div>
            {sidebarTab === 'engagement' ? (
              <EngagementInsightsPanel socialPosts={socialPosts} />
            ) : (
              <TipsGoalsSidebar activeTab="tips" socialPosts={socialPosts} />
            )}
          </aside>
        )}
      </div>

      {editing !== undefined && (
        <PostDetailPanel
          /* Remount per target so the editor always opens on a clean draft
             rather than carrying the previous post's fields over. */
          key={editing ?? `new:${intent.date ?? ''}:${intent.time ?? ''}`}
          postId={editing}
          defaultDate={intent.date}
          defaultTime={intent.time}
          onClose={closePanel}
        />
      )}
    </div>
  )
}
