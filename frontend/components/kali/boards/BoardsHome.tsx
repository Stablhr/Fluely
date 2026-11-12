'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Columns3, Plus, Star } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import CreateBoardModal from './CreateBoardModal'
import BoardsHomeSkeleton from './BoardsHomeSkeleton'

function boardBgStyle(bg: string): React.CSSProperties {
  if (!bg) return { background: 'var(--color-surface-alt)' }
  if (bg.startsWith('data:')) return { background: `url(${bg}) center/cover no-repeat` }
  return { background: bg }
}

export default function BoardsHome() {
  const { data, toggleStar, boardsLoaded } = useStore()
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const boards = Object.values(data.boards).sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt),
  )

  if (!boardsLoaded && boards.length === 0) return <BoardsHomeSkeleton />

  const countLabel =
    boards.length === 0 ? 'Your projects live here.' : `${boards.length} board${boards.length === 1 ? '' : 's'}`

  return (
    <div className="scroll-slim h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="animate-rise flex items-center justify-between">
        <div>
          <h1 className="text-display text-text-primary">Boards</h1>
          <p className="mt-1 text-body text-text-muted">{countLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-sheen inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] sm:px-3.5 sm:py-2"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Create board</span>
          <span className="sm:hidden">Create</span>
        </button>
      </div>

      {boards.length === 0 ? (
        <div className="animate-rise mt-10 flex flex-col items-center rounded-hero border border-dashed border-border-strong p-8 text-center sm:p-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-card border border-border bg-surface text-primary-text">
            <Columns3 size={20} />
          </span>
          <p className="mt-4 text-card-title text-text-primary">Create your first board</p>
          <p className="mt-1 max-w-sm text-body text-text-muted">
            Start from a template for a project or a social content pipeline.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-sheen mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus size={16} />
            Create board
          </button>
        </div>
      ) : (
        <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {boards.map((board) => (
            <div
              key={board.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/boards/${board.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push(`/boards/${board.id}`)
              }}
              className="hover-lift group relative cursor-pointer overflow-hidden rounded-card border border-border bg-surface shadow-card hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* The board's color is an accent band, not the whole tile. */}
              <div className="h-14 sm:h-16" style={boardBgStyle(board.background)} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStar(board.id)
                }}
                title={board.starred ? 'Unstar' : 'Star'}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/45 opacity-0 transition-opacity duration-150 hover:bg-black/60 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Star
                  size={15}
                  className={board.starred ? 'fill-warning text-warning' : 'text-white'}
                />
              </button>
              <div className="px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-text-primary">{board.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-text-muted">
                  {board.access === 'owner'
                    ? 'Owned by you'
                    : board.access === 'viewer'
                      ? 'Shared · view only'
                      : 'Shared with you'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateBoardModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
