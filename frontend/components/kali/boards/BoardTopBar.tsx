'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Star,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  MoreHorizontal,
  Check,
  Lock,
  Globe,
  Users,
  UserPlus,
} from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import ViewsMenu from './ViewsMenu'
import FilterPanel from './FilterPanel'
import type { BoardFilter } from './FilterPanel'
import type { BoardViewType } from './BoardView'
import ShareModal from './ShareModal'
import VisibilityModal from './VisibilityModal'
import Avatar from '../shared/Avatar'

interface BoardTopBarProps {
  board: Board
  search: string
  onSearch: (value: string) => void
  viewsOpen: boolean
  filterOpen: boolean
  filter: BoardFilter
  activeView: BoardViewType
  onOpenViews: () => void
  onViewChange: (view: BoardViewType) => void
  onOpenFilter: () => void
  onFilterChange: (filter: BoardFilter) => void
  onOpenMenu: () => void
}

function TB({
  children,
  title,
  active,
  onClick,
  className = '',
  accent,
}: {
  children: React.ReactNode
  title: string
  active?: boolean
  onClick?: () => void
  className?: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] disabled:opacity-40 ${
        accent
          ? active
            ? 'text-warning'
            : 'hover:text-warning hover:bg-surface-alt'
          : active
            ? 'bg-primary text-primary-foreground'
            : 'hover:text-text-primary hover:bg-surface-alt'
      } ${className}`}
      style={!active ? { color: 'var(--surface-text-muted)' } : undefined}
    >
      {children}
    </button>
  )
}

export default function BoardTopBar({
  board,
  search,
  onSearch,
  viewsOpen,
  filterOpen,
  filter,
  activeView,
  onOpenViews,
  onViewChange,
  onOpenFilter,
  onFilterChange,
  onOpenMenu,
}: BoardTopBarProps) {
  const { renameBoard, toggleStar, members } = useStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(board.name)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [visOpen, setVisOpen] = useState(false)

  const currentUser = members.find((m) => m.name === 'You') ?? members[0]

  const visIcon = {
    private: Lock,
    workspace: Users,
    public: Globe,
  }[board.visibility]

  const commitRename = () => {
    setEditing(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== board.name) renameBoard(board.id, trimmed)
    else setName(board.name)
  }

  const filterActive = filter.labelIds.length > 0 || filter.memberIds.length > 0

  return (
    <div
      className="relative flex items-center border-b border-border bg-surface px-2 py-2 sm:px-4 sm:py-2.5"
      style={{ minHeight: 52 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
        {/* ── Back ── */}
        <Link
          href="/boards"
          title="Back to boards"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-surface-alt"
        >
          <ChevronLeft size={18} />
        </Link>

        {/* ── Avatar ── */}
        {currentUser && (
          <div className="relative shrink-0">
            <Avatar member={currentUser} size={34} />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3"
              style={{
                background: 'var(--color-success, #33B27A)',
                boxShadow: '0 0 0 2px var(--surface-bg-subtle, #FFFFFF)',
              }}
            />
          </div>
        )}

        {/* ── Board name ── */}
        {editing ? (
          <div className="ml-0.5 flex items-center gap-1 sm:ml-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setName(board.name)
                  setEditing(false)
                }
              }}
              onBlur={commitRename}
              autoFocus
              className="w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20 sm:w-auto sm:text-base"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitRename}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <h2
            onClick={() => {
              setName(board.name)
              setEditing(true)
            }}
            title="Click to rename"
            className="ml-0.5 min-w-0 cursor-text truncate rounded-md px-1.5 py-1 text-sm font-semibold text-text-primary transition-colors duration-150 hover:bg-surface-alt sm:ml-1 sm:text-base"
          >
            {board.name}
          </h2>
        )}

        {/* ── Spacer ── */}
        <div className="min-w-2 flex-1 sm:min-w-4" />

        {/* ── Views ── */}
        <div className="relative hidden sm:block" data-toolbar-menu>
          <TB
            title="Views"
            active={viewsOpen}
            onClick={() => {
              onOpenViews()
            }}
          >
            <LayoutGrid size={17} />
          </TB>
          <ViewsMenu open={viewsOpen} onClose={onOpenViews} activeView={activeView} onViewChange={onViewChange} />
        </div>

        {/* ── Filter ── */}
        <div className="relative" data-toolbar-menu>
          <TB
            title="Filter board"
            active={filterOpen}
            onClick={() => {
              onOpenFilter()
            }}
          >
            <SlidersHorizontal size={17} />
          </TB>
          {filterActive && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
          )}
          <FilterPanel
            board={board}
            filter={filter}
            onChange={onFilterChange}
            open={filterOpen}
            onClose={onOpenFilter}
          />
        </div>

        {/* ── Star ── */}
        <TB
          title={board.starred ? 'Unstar board' : 'Star board'}
          active={board.starred}
          onClick={() => toggleStar(board.id)}
          accent
        >
          <Star size={17} className={board.starred ? 'fill-current' : ''} />
        </TB>

        {/* ── Visibility ── */}
        <div className="hidden sm:block" data-toolbar-menu>
          <TB
            title={`Board visibility: ${board.visibility}`}
            onClick={() => setVisOpen(true)}
          >
            {(() => {
              const Icon = visIcon
              return <Icon size={17} />
            })()}
          </TB>
        </div>

        {/* ── Mobile: Search + More ── */}
        <TB
          title="Search board"
          active={searchOpen}
          onClick={() => setSearchOpen((o) => !o)}
          className="sm:hidden"
        >
          <Search size={17} />
        </TB>

        <TB
          title="More options"
          onClick={() => {
            setSearchOpen(false)
            onSearch('')
            onOpenMenu()
          }}
          className="sm:hidden"
        >
          <MoreHorizontal size={17} />
        </TB>

        {/* ── Desktop: Share + More ── */}
        <button
          type="button"
          title="Share board"
          onClick={() => setShareOpen(true)}
          className="ml-1 hidden items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] sm:inline-flex"
        >
          <UserPlus size={15} />
          <span className="hidden md:inline">Share</span>
        </button>

        <div className="relative hidden sm:block" data-toolbar-menu>
          <TB
            title="More options"
            onClick={() => {
              onOpenMenu()
            }}
          >
            <MoreHorizontal size={17} />
          </TB>
        </div>
      </div>

      {/* ── Mobile search bar ── */}
      {searchOpen && (
        <div
          className="absolute left-0 right-0 top-full z-30 flex items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:hidden"
        >
          <Search size={14} className="text-text-muted" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search this board"
            autoFocus
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false)
              onSearch('')
            }}
            className="text-xs font-semibold text-text-muted"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {shareOpen && <ShareModal board={board} onClose={() => setShareOpen(false)} />}
      {visOpen && <VisibilityModal board={board} onClose={() => setVisOpen(false)} />}
    </div>
  )
}
