'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Plus } from 'lucide-react'
import type { SocialPost } from '@/lib/kali/store/schema'
import { slotId } from './types'
import ContentPostCard from './ContentPostCard'

interface TimeSlotCellProps {
  date: string
  hour: number
  posts: SocialPost[]
  onPostClick: (post: SocialPost) => void
  onSlotClick: (date: string, hour: number) => void
}

export default function TimeSlotCell({ date, hour, posts, onPostClick, onSlotClick }: TimeSlotCellProps) {
  const id = slotId(date, hour)

  return (
    <Droppable droppableId={id} type="SOCIAL_POST">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`group relative min-h-[56px] border-b border-border/50 px-0.5 py-0.5 transition-colors duration-100 ${
            snapshot.isDraggingOver ? 'bg-primary-subtle/40' : 'hover:bg-surface-alt/40'
          }`}
        >
          {posts.map((post, i) => (
            <ContentPostCard
              key={post.id}
              post={post}
              index={i}
              onClick={() => onPostClick(post)}
            />
          ))}
          {posts.length === 0 && (
            <button
              type="button"
              onClick={() => onSlotClick(date, hour)}
              aria-label={`Add post at hour ${hour}`}
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-100 group-hover:opacity-100"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus size={12} />
              </div>
            </button>
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}