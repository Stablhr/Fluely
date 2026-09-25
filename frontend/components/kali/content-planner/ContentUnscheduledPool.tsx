'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Inbox } from 'lucide-react'
import type { SocialPost } from '@/lib/kali/store/schema'
import ContentPostCard from './ContentPostCard'

interface ContentUnscheduledPoolProps {
  posts: SocialPost[]
  onPostClick: (post: SocialPost) => void
}

export default function ContentUnscheduledPool({ posts, onPostClick }: ContentUnscheduledPoolProps) {
  return (
    <Droppable droppableId="unscheduled-pool" type="SOCIAL_POST">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          aria-label="Unscheduled posts"
          className={`flex w-[170px] shrink-0 flex-col self-stretch rounded-lg p-2 sm:w-[190px] sm:p-2.5 ${
            snapshot.isDraggingOver
              ? 'bg-primary-subtle/60 ring-2 ring-inset ring-primary'
              : 'ring-1 ring-border'
          }`}
        >
          <div className="flex items-center gap-1.5 px-1 pb-2">
            <Inbox size={13} className="text-text-muted" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-secondary">
              Unscheduled
            </h2>
            <span className="ml-auto font-mono text-[10px] text-text-muted">{posts.length}</span>
          </div>
          <div className="scroll-slim flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {posts.map((post, i) => (
              <ContentPostCard
                key={post.id}
                post={post}
                index={i}
                compact
                onClick={() => onPostClick(post)}
              />
            ))}
            {posts.length === 0 && (
              <p className="px-1 py-4 text-center text-[11px] text-text-muted" role="status">
                All posts scheduled
              </p>
            )}
          </div>
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}