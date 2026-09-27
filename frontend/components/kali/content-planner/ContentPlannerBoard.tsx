'use client'

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useMemo } from 'react'
import { Plus, GripVertical } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import type { SocialPost } from '@/lib/kali/store/schema'
import { formatDate } from '@/lib/kali/utils/dates'
import PlatformIcon from '../social/PlatformIcon'
import {
  POST_COLUMNS,
  columnForStatus,
  enabledPlatforms,
  platformColor,
  postDate,
  postThumbnail,
  postTitle,
  type PostColumn,
} from './planner-model'

export interface ContentPlannerBoardProps {
  posts: SocialPost[]
  onOpenPost: (id: string) => void
  /** New post, prefilled with the column's stage. */
  onCreateIn: (status: PostColumn['primary']) => void
}

export default function ContentPlannerBoard({ posts, onOpenPost, onCreateIn }: ContentPlannerBoardProps) {
  const { updateSocialPost } = useStore()

  const grouped = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const column of POST_COLUMNS) map.set(column.id, [])
    for (const post of posts) {
      map.get(columnForStatus(post.status))?.push(post)
    }
    // Within a column, dated work floats to the top and the rest is by recency.
    for (const list of map.values()) {
      list.sort((a, b) => {
        const da = postDate(a)
        const db = postDate(b)
        if (da && db) return da.localeCompare(db)
        if (da) return -1
        if (db) return 1
        return b.updatedAt.localeCompare(a.updatedAt)
      })
    }
    return map
  }, [posts])

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result
    // Dropped outside a column, or back where it started.
    if (!destination || destination.droppableId === source.droppableId) return
    const column = POST_COLUMNS.find((c) => c.id === destination.droppableId)
    if (!column) return
    updateSocialPost(draggableId, { status: column.primary })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="scroll-slim flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
        {POST_COLUMNS.map((column) => {
          const columnPosts = grouped.get(column.id) ?? []
          return (
            <section
              key={column.id}
              className="flex w-[268px] shrink-0 flex-col rounded-2xl border border-border bg-surface-alt/50"
              aria-label={column.label}
            >
              <header className="flex shrink-0 items-center gap-2 px-2.5 py-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${column.dot}`} />
                <h3 className="text-[12px] font-semibold text-text-primary">{column.label}</h3>
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                  {columnPosts.length}
                </span>
                <button
                  type="button"
                  onClick={() => onCreateIn(column.primary)}
                  aria-label={`Add post to ${column.label}`}
                  className="ml-auto rounded p-0.5 text-text-muted transition-colors duration-150 hover:bg-surface hover:text-text-primary"
                >
                  <Plus size={14} />
                </button>
              </header>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`scroll-slim min-h-[120px] flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors duration-150 ${
                      snapshot.isDraggingOver ? 'bg-primary-subtle/60' : ''
                    }`}
                  >
                    {columnPosts.length === 0 && !snapshot.isDraggingOver && (
                      <p className="px-1 py-4 text-center text-[11px] text-text-muted">
                        Nothing here yet.
                      </p>
                    )}

                    {columnPosts.map((post, index) => (
                      <BoardCard
                        key={post.id}
                        post={post}
                        index={index}
                        onOpen={() => onOpenPost(post.id)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          )
        })}
      </div>
    </DragDropContext>
  )
}

function BoardCard({ post, index, onOpen }: { post: SocialPost; index: number; onOpen: () => void }) {
  const platforms = enabledPlatforms(post)
  const date = postDate(post)
  const thumb = postThumbnail(post)
  // Single-platform posts carry that platform's colour; multi-platform ones fall
  // back to the ink brown so the accent never implies the wrong destination.
  const accent = platforms.length === 1 ? platformColor(platforms[0]) : '#8a9068'

  return (
    <Draggable draggableId={post.id} index={index}>
      {(provided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`overflow-hidden rounded-xl border bg-surface transition-shadow duration-150 ${
            snapshot.isDragging
              ? 'border-primary shadow-modal ring-2 ring-primary/30'
              : 'border-border hover:border-border-strong hover:shadow-subtle'
          }`}
          style={provided.draggableProps.style}
        >
          <span className="block h-1 w-full" style={{ background: accent }} />
          <div className="p-2.5">
            <div className="flex items-start gap-1.5">
              <button
                type="button"
                onClick={onOpen}
                className="min-w-0 flex-1 text-left"
                aria-label={`Edit post: ${postTitle(post)}`}
              >
                <h4 className="line-clamp-2 text-[12px] font-semibold leading-snug text-text-primary">
                  {postTitle(post)}
                </h4>
              </button>
              <span
                aria-hidden
                className="shrink-0 cursor-grab text-text-muted active:cursor-grabbing"
                {...provided.dragHandleProps}
              >
                <GripVertical size={12} />
              </span>
            </div>

            {thumb && (
              <img
                src={thumb}
                alt=""
                className="mt-2 h-20 w-full rounded-md object-cover"
                loading="lazy"
              />
            )}

            {post.tags.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
                {post.tags.length > 3 && (
                  <span className="text-[9px] font-semibold text-text-muted">+{post.tags.length - 3}</span>
                )}
              </p>
            )}

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1">
                {platforms.map((platform) => (
                  <span
                    key={platform}
                    title={platform}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                    style={{ background: platformColor(platform) }}
                  >
                    <PlatformIcon platform={platform} size={9} />
                  </span>
                ))}
              </p>
              {date && (
                <p className="truncate font-mono text-[10px] text-text-muted">
                  {post.scheduledTime ? `${formatDate(date)} ${post.scheduledTime}` : formatDate(date)}
                </p>
              )}
            </div>
          </div>
        </article>
      )}
    </Draggable>
  )
}
