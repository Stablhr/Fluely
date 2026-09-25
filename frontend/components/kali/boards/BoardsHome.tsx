'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import CreateBoardModal from './CreateBoardModal'

function boardBgStyle(bg: string): React.CSSProperties {
  if (!bg) return { background: 'var(--color-surface-alt)' }
  if (bg.startsWith('data:')) return { background: `url(${bg}) center/cover no-repeat` }
  return { background: bg }
}

export default function BoardsHome() {
  const { data, toggleStar } = useStore()
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const boards = Object.values(data.boards).sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt),
  )

  return (
    <div className="scroll-slim h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary sm:text-2xl">Boards</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] sm:px-3.5 sm:py-2"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Create board</span>
          <span className="sm:hidden">Create</span>
        </button>
      </div>

      {boards.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-border p-8 text-center sm:p-12">
          <p className="text-sm font-medium text-text-secondary">
            No boards yet — create one from a template to get started.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {boards.map((board) => (
            <div
              key={board.id}
              onClick={() => router.push(`/boards/${board.id}`)}
              className="group relative h-24 cursor-pointer overflow-hidden rounded-xl shadow-card ring-1 ring-border transition-shadow duration-150 hover:shadow-card-hover sm:h-28"
              style={boardBgStyle(board.background)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStar(board.id)
                }}
                title={board.starred ? 'Unstar' : 'Star'}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-brand-ink/45 opacity-0 transition-opacity duration-150 hover:bg-brand-ink/60 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Star
                  size={15}
                  className={board.starred ? 'fill-warning text-warning' : 'text-white'}
                />
              </button>
              <span className="absolute bottom-2 left-2 right-2 truncate rounded-pill bg-brand-ink/55 px-2.5 py-1 text-sm font-semibold text-brand-ivory">
                {board.name}
              </span>
            </div>
          ))}
        </div>
      )}

      <CreateBoardModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
