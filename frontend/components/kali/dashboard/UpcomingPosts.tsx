'use client'

import Link from 'next/link'
import { CalendarRange, Send } from 'lucide-react'
import type { SocialPost } from '@/lib/kali/store/schema'
import { formatDate } from '@/lib/kali/utils/dates'
import PlatformIcon from '../social/PlatformIcon'
import { Panel } from './Panel'

const STATUS_LABEL: Partial<Record<SocialPost['status'], string>> = {
  idea: 'Idea',
  draft: 'Draft',
  in_review: 'In review',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
}

function when(post: SocialPost): string {
  const date = post.scheduledDate ? formatDate(post.scheduledDate) : ''
  return post.scheduledTime ? `${date} · ${post.scheduledTime}` : date
}

/** The next social posts on the calendar, so content sits next to the work. */
export default function UpcomingPosts({ posts }: { posts: SocialPost[] }) {
  return (
    <Panel>
      <Panel.Header
        icon={Send}
        title="Upcoming posts"
        action={<Panel.Link href="/content-planner">Planner</Panel.Link>}
      />
      {posts.length === 0 ? (
        <Panel.Empty
          icon={CalendarRange}
          title="No posts scheduled"
          description="Plan your next post in the content planner."
          action={
            <Link
              href="/content-planner"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[12px] font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
            >
              Open planner
            </Link>
          }
        />
      ) : (
        <ul className="flex-1 py-1">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href="/content-planner"
                className="group flex items-start gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="mt-0.5 flex shrink-0 -space-x-1">
                  {post.platforms
                    .filter((p) => p.enabled)
                    .slice(0, 3)
                    .map((p) => (
                    <span
                      key={p.platform}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-surface-alt"
                    >
                      <PlatformIcon platform={p.platform} size={12} />
                    </span>
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text-primary group-hover:text-primary-text">
                    {post.title || 'Untitled post'}
                  </span>
                  <span className="block truncate text-[12px] text-text-muted">
                    {when(post)}
                    {STATUS_LABEL[post.status] ? ` · ${STATUS_LABEL[post.status]}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
